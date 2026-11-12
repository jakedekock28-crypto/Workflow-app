import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { useStore } from '../../store/useStore';
import type { AppData } from '../../types';
import { applyCloudData, cloudApiBase, cloudRequest, clearCloudBaseline, clearPendingCloudSync, clearCloudSession, collectionPath, collectionStateKey, exportLocalData, mergePendingCloudData, readCloudBaseline, readCloudSession, readPendingCloudSync, saveCloudBaseline, savePendingCloudSync, saveCloudSession, type CloudSession, type SyncCollection } from '../../lib/cloud/client';

type CloudSnapshot = Pick<AppData, 'areas' | 'sections' | 'events' | 'tasks' | 'templates' | 'people' | 'groups' | 'messageTemplates' | 'notificationLogs'>;
const collections = Object.keys(collectionStateKey) as SyncCollection[];
const snapshotStore = (): CloudSnapshot => {
  const state = useStore.getState();
  return { areas: state.areas, sections: state.sections, events: state.events, tasks: state.tasks, templates: state.templates, people: state.people, groups: state.groups, messageTemplates: state.messageTemplates, notificationLogs: state.notificationLogs };
};
const asSnapshot = (data: Partial<AppData>): CloudSnapshot => ({ areas: data.areas ?? [], sections: data.sections ?? [], events: data.events ?? [], tasks: data.tasks ?? [], templates: data.templates ?? [], people: data.people ?? [], groups: data.groups ?? [], messageTemplates: data.messageTemplates ?? [], notificationLogs: data.notificationLogs ?? [] });
const dataCount = (data: Partial<AppData>) => ['areas', 'sections', 'events', 'tasks', 'templates', 'people', 'groups', 'messageTemplates', 'notificationLogs'].reduce((sum, key) => sum + ((data[key as keyof AppData] as unknown[] | undefined)?.length ?? 0), 0);

export default function CloudAccountPanel({ visible }: { visible: boolean }) {
  const [token, setToken] = useState(readCloudSession());
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [baseline, setBaseline] = useState<CloudSnapshot | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const firstSignIn = useRef(false);
  const syncPause = useRef(false);
  const storeImport = useStore(state => state.importData);

  useEffect(() => {
    setPortalTarget(visible ? document.getElementById('cloud-account-slot') : null);
  }, [visible]);

  useEffect(() => {
    if (!cloudApiBase) return;
    void cloudRequest<{ turnstileSiteKey: string }>('/auth/config').then(config => setSiteKey(config.turnstileSiteKey)).catch(reason => setError(reason.message));
  }, []);

  const installCloudCopy = useCallback((data: Partial<AppData>) => {
    syncPause.current = true;
    storeImport(applyCloudData(data, exportLocalData(useStore.getState())));
    syncPause.current = false;
  }, [storeImport]);

  useEffect(() => {
    if (!token) { setLoaded(false); return; }
    let active = true;
    void (async () => {
      try {
        const me = await cloudRequest<{ user: { email: string } }>('/auth/me', token);
        const previousAccount = localStorage.getItem('workflow-cloud-account');
        if (previousAccount && previousAccount !== me.user.email) {
          clearPendingCloudSync();
          clearCloudBaseline();
          firstSignIn.current = false;
          setStatus('Account changed. Loaded the selected account without carrying over another account’s pending changes.');
        }
        localStorage.setItem('workflow-cloud-account', me.user.email);
        const response = await cloudRequest<Partial<AppData>>('/api/data', token);
        let cloudData: Partial<AppData> = response;
        let remoteBaseline: Partial<AppData> = response;
        const pending = readPendingCloudSync();
        if (pending) cloudData = mergePendingCloudData(response, pending.baseline, pending.current);
        if (!pending && firstSignIn.current && dataCount(response) === 0) {
          const local = exportLocalData(useStore.getState());
          if (dataCount(local) > 0 && confirm('Your account has no cloud data yet. Copy this device’s current Workflow data to the account? Choose Cancel to start with an empty cloud account.')) {
            const imported = await cloudRequest<{ data: Partial<AppData> }>('/api/import', token, { method: 'POST', body: JSON.stringify(local) });
            cloudData = imported.data;
            remoteBaseline = imported.data;
            clearPendingCloudSync();
            setStatus('This device’s data was imported to your account.');
          }
        }
        firstSignIn.current = false;
        if (!active) return;
        installCloudCopy(cloudData);
        setBaseline(asSnapshot(remoteBaseline));
        setAccountEmail(me.user.email);
        setLoaded(true);
        setError('');
      } catch (reason) {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : 'Could not load cloud data.';
        setError(message);
        if (message.toLowerCase().includes('session')) { clearCloudSession(); setToken(null); }
        else { const cachedBaseline = readCloudBaseline(); if (cachedBaseline && !firstSignIn.current) { setBaseline(asSnapshot(cachedBaseline)); setLoaded(true); setStatus('Offline. Your local copy is available; edits will sync when you reconnect.'); } }
      }
    })();
    return () => { active = false; };
  }, [token, installCloudCopy, connectionAttempt]);

  useEffect(() => {
    const retry = () => setConnectionAttempt(value => value + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    if (!token || !loaded) return;
    let last = baseline ?? snapshotStore();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let flushing = false;
    let dirty = false;
    const flush = async () => {
      if (flushing || !dirty) return;
      dirty = false;
      flushing = true;
      const current = snapshotStore();
      try {
        for (const collection of collections) {
          const key = collectionStateKey[collection] as keyof CloudSnapshot;
          const before = last[key] as Array<{ id: string }>;
          const after = current[key] as Array<{ id: string }>;
          const previous = new Map(before.map(item => [item.id, item]));
          const next = new Map(after.map(item => [item.id, item]));
          for (const [id, item] of next) {
            if (JSON.stringify(previous.get(id)) === JSON.stringify(item)) continue;
            await cloudRequest(collectionPath(collection, id), token, { method: 'PUT', body: JSON.stringify(item) });
          }
          for (const id of previous.keys()) {
            if (!next.has(id)) await cloudRequest(collectionPath(collection, id), token, { method: 'DELETE' });
          }
        }
        last = current;
        saveCloudBaseline(current);
        if (JSON.stringify(snapshotStore()) === JSON.stringify(current)) clearPendingCloudSync();
        else { dirty = true; savePendingCloudSync({ baseline: last, current: snapshotStore() }); }
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined; }
        setStatus('Cloud data is up to date.');
        setError('');
      } catch (reason) {
        dirty = true;
        savePendingCloudSync({ baseline: last, current: snapshotStore() });
        setError(reason instanceof Error ? reason.message : 'Cloud sync failed. Your changes remain saved on this device and will retry.');
        retryTimer = setTimeout(() => { void flush(); }, 5000);
      } finally {
        flushing = false;
        if (dirty && !retryTimer) void flush();
      }
    };
    const unsubscribe = useStore.subscribe(() => {
      if (syncPause.current) return;
      dirty = true;
      savePendingCloudSync({ baseline: last, current: snapshotStore() });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, 500);
    });
    const retryOnline = () => { if (dirty) void flush(); };
    dirty = JSON.stringify(last) !== JSON.stringify(snapshotStore());
    if (dirty) { savePendingCloudSync({ baseline: last, current: snapshotStore() }); void flush(); }
    window.addEventListener('online', retryOnline);
    return () => {
      unsubscribe();
      window.removeEventListener('online', retryOnline);
      if (timer) clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [token, loaded, baseline]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const magicToken = params.get('magic');
    if (!magicToken || !cloudApiBase) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    firstSignIn.current = true;
    setStatus('Checking your sign-in link…');
    void cloudRequest<CloudSession>('/auth/verify', undefined, { method: 'POST', body: JSON.stringify({ token: magicToken }) })
      .then(session => { saveCloudSession(session.token); setToken(session.token); setAccountEmail(session.user.email); setStatus('Signed in. Loading your account…'); })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'This sign-in link could not be used.'));
  }, []);

  async function requestLink(event: React.FormEvent) {
    event.preventDefault();
    setError(''); setStatus('Requesting a secure sign-in link…');
    try {
      const response = await cloudRequest<{ message: string }>('/auth/request-link', undefined, { method: 'POST', body: JSON.stringify({ email: email.trim(), turnstileToken }) });
      setStatus(response.message);
      setTurnstileToken('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not request a sign-in link.');
      setStatus('');
    }
  }

  async function logout() {
    if (token) await cloudRequest('/auth/logout', token, { method: 'POST' }).catch(() => undefined);
    clearCloudSession(); setToken(null); setLoaded(false); setAccountEmail(''); setStatus('Signed out. This device keeps its local copy.');
  }

  if (!portalTarget) return null;
  return createPortal(<section className="settings-section cloud-account"><div className="section-title"><div><span className="eyebrow">OPTIONAL ACCOUNT</span><h2>Cloud sync</h2></div></div>
    {!cloudApiBase ? <p className="settings-copy">Cloud mode becomes available after the Worker URL is added to the site build. Local mode and local backups continue to work.</p> : token && loaded ? <><p className="settings-copy">Signed in as <b>{accountEmail}</b>. The account is the source of truth. Changes are saved on this device and sync when a connection is available.</p><p className="muted">The session stays in this browser for up to seven days. Signing out keeps the local cache.</p><button className="text-button" onClick={()=>void logout()}>Sign out of cloud mode</button></> : <form onSubmit={requestLink}><p className="settings-copy">Local mode stays available without an account. Sign in to sync this device to your account; first sign-in offers to import your local data.</p><label className="field-label">Email address<input type="email" required autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} /></label>{siteKey&&<Turnstile siteKey={siteKey} options={{ action: 'workflow_login' }} onSuccess={setTurnstileToken} onExpire={()=>setTurnstileToken('')} />}{!siteKey&&<p className="muted">The sign-in security check is not configured yet.</p>}<button className="primary-button" type="submit" disabled={!turnstileToken}>Email me a sign-in link</button></form>}
    {status&&<p className="muted" role="status">{status}</p>}{error&&<p className="danger-text" role="alert">{error}</p>}
  </section>, portalTarget);
}
