import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import type { AppData } from '../../types';
import { applyCloudData, cloudApiBase, cloudRequest, clearCloudCache, clearCloudSession, collectionPath, collectionStateKey, exportWorkspaceData, mergePendingCloudData, readCloudBaseline, readCloudSession, readPendingCloudSync, readWorkspaceId, saveCloudBaseline, savePendingCloudSync, saveCloudSession, saveWorkspaceId, type CloudSession, type CloudWorkspace, type SyncCollection, type WorkspaceData } from '../../lib/cloud/client';

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, unknown>) => void } } };
  }
  interface ImportMetaEnv { readonly VITE_GOOGLE_CLIENT_ID?: string }
}

const snapshotStore = () => exportWorkspaceData(useStore.getState() as AppData);
const dataCount = (data: Partial<WorkspaceData>) => ['people', 'groups', 'tasks', 'templates'].reduce((sum, key) => sum + ((data[key as keyof WorkspaceData] as unknown[] | undefined)?.length ?? 0), 0);
const roleLabel = (role: CloudWorkspace['role']) => role[0].toUpperCase() + role.slice(1);

export default function CloudAccountPanel({ visible, onWorkspaceRole }: { visible: boolean; onWorkspaceRole?: (role: CloudWorkspace['role'] | null) => void }) {
  const [token, setToken] = useState(readCloudSession());
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '');
  const [email, setEmail] = useState('');
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState(readWorkspaceId());
  const [members, setMembers] = useState<Array<{ id: string; email: string; role: string; status: string }>>([]);
  const [invites, setInvites] = useState<Array<{ id: string; email: string; role: string; expiresAt: string }>>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'delegator' | 'member'>('member');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [baseline, setBaseline] = useState<WorkspaceData | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const firstSignIn = useRef(false);
  const syncPause = useRef(false);
  const importOffered = useRef(false);
  const storeImport = useStore(state => state.importData);

  useEffect(() => setPortalTarget(visible ? document.getElementById('cloud-account-slot') : null), [visible]);
  useEffect(() => {
    if (!cloudApiBase) return;
    void cloudRequest<{ googleClientId: string }>('/auth/config').then(config => setClientId(config.googleClientId)).catch(reason => setError(reason.message));
  }, []);

  const signInWithCredential = useCallback(async (credential: string) => {
    setError(''); setStatus('Checking Google sign-in…');
    try {
      const result = await cloudRequest<CloudSession>('/auth/google', undefined, { method: 'POST', body: JSON.stringify({ credential }) });
      saveCloudSession(result.token); setToken(result.token); setEmail(result.user.email); firstSignIn.current = true; setStatus('Signed in. Loading workspaces…');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Google sign-in failed.'); setStatus(''); }
  }, []);
  useEffect(() => {
    if (!clientId || !cloudApiBase || !portalTarget) return;
    let active = true;
    const init = () => {
      if (!active || !window.google) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: response => { void signInWithCredential(response.credential); } });
      const target = document.getElementById('google-sign-in-button');
      if (target) window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', width: 280 });
    };
    if (window.google) init();
    else {
      let script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
      if (!script) { script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true; script.dataset.googleIdentity = 'true'; document.head.append(script); }
      script.addEventListener('load', init);
      return () => { active = false; script?.removeEventListener('load', init); };
    }
    return () => { active = false; };
  }, [clientId, portalTarget, signInWithCredential]);

  const installCloudCopy = useCallback((data: Partial<WorkspaceData>) => {
    syncPause.current = true;
    storeImport(applyCloudData(data, useStore.getState() as AppData));
    syncPause.current = false;
  }, [storeImport]);

  const loadWorkspace = useCallback(async (id: string, currentToken: string, currentWorkspaces: CloudWorkspace[]) => {
    const selected = currentWorkspaces.find(item => item.id === id);
    if (!selected) throw new Error('You are not an active member of that workspace.');
    saveWorkspaceId(id); setWorkspaceId(id); setLoaded(false); onWorkspaceRole?.(selected.role);
    const result = await cloudRequest<WorkspaceData>('/api/data', currentToken, {}, id);
    let installed: Partial<WorkspaceData> = result;
    let remoteBaseline: Partial<WorkspaceData> = result;
    const pending = readPendingCloudSync(id);
    if (pending) installed = mergePendingCloudData(result, pending.baseline, pending.current);
    if (firstSignIn.current && ['owner', 'admin'].includes(selected.role) && !importOffered.current && dataCount(result) === 0) {
      importOffered.current = true;
      const local = snapshotStore();
      if (dataCount(local) > 0 && confirm('This workspace is empty. Copy this browser’s current tasks and email contact roster into it?')) {
        const imported = await cloudRequest<{ data: WorkspaceData }>('/api/import', currentToken, { method: 'POST', body: JSON.stringify(local) }, id);
        installed = imported.data; remoteBaseline = imported.data;
        clearCloudCache(id); setStatus('This browser’s tasks and email contacts were imported into the workspace.');
      }
    }
    firstSignIn.current = false;
    installCloudCopy(installed);
    const snapshot = remoteBaseline as WorkspaceData;
    setBaseline(snapshot); saveCloudBaseline(id, snapshot); setLoaded(true); setError('');
  }, [installCloudCopy, onWorkspaceRole]);

  const refreshManagement = useCallback(async (currentToken: string, id: string, role: CloudWorkspace['role']) => {
    if (!['owner', 'admin'].includes(role)) { setMembers([]); setInvites([]); return; }
    const [memberResult, inviteResult] = await Promise.all([
      cloudRequest<{ members: typeof members }>('/api/workspace/members', currentToken, {}, id),
      cloudRequest<{ invites: typeof invites }>('/api/workspace/invites', currentToken, {}, id),
    ]);
    setMembers(memberResult.members); setInvites(inviteResult.invites);
  }, []);

  useEffect(() => {
    if (!token) { setLoaded(false); onWorkspaceRole?.(null); return; }
    let active = true;
    void (async () => {
      try {
        const me = await cloudRequest<{ user: { email: string } }>('/auth/me', token);
        if (!active) return;
        setEmail(me.user.email);
        const available = await cloudRequest<{ workspaces: CloudWorkspace[] }>('/api/workspaces', token);
        if (!active) return;
        setWorkspaces(available.workspaces);
        if (!available.workspaces.length) throw new Error('No active workspace is linked to this account.');
        const pendingInvite = new URLSearchParams(location.hash.replace(/^#/, '')).get('invite');
        if (pendingInvite) {
          history.replaceState(null, '', `${location.pathname}${location.search}`);
          const joined = await cloudRequest<{ workspaceId: string }>('/api/invites/accept', token, { method: 'POST', body: JSON.stringify({ token: pendingInvite }) });
          const updated = await cloudRequest<{ workspaces: CloudWorkspace[] }>('/api/workspaces', token);
          setWorkspaces(updated.workspaces);
          await loadWorkspace(joined.workspaceId, token, updated.workspaces);
          setStatus('You joined the shared workspace.');
          return;
        }
        const chosen = available.workspaces.find(item => item.id === readWorkspaceId()) ?? available.workspaces[0];
        await loadWorkspace(chosen.id, token, available.workspaces);
        await refreshManagement(token, chosen.id, chosen.role);
      } catch (reason) {
        if (!active) return;
        const message = reason instanceof Error ? reason.message : 'Could not load your workspace.';
        setError(message);
        if (message.toLowerCase().includes('session')) { clearCloudSession(); setToken(null); }
        else { const id = readWorkspaceId(); const cached = id ? readCloudBaseline(id) : null; if (cached) { setBaseline(cached as WorkspaceData); installCloudCopy(cached); setLoaded(true); setStatus('Offline. This workspace’s cached tasks are available until you reconnect.'); } }
      }
    })();
    return () => { active = false; };
  }, [token, connectionAttempt, installCloudCopy, loadWorkspace, onWorkspaceRole, refreshManagement]);

  useEffect(() => {
    const retry = () => setConnectionAttempt(value => value + 1);
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => { window.removeEventListener('online', retry); window.removeEventListener('focus', retry); };
  }, []);

  useEffect(() => {
    if (!token || !loaded || !workspaceId || !baseline) return;
    const selected = workspaces.find(item => item.id === workspaceId);
    if (!selected) return;
    let last = baseline;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let flushing = false; let dirty = false;
    const collections: SyncCollection[] = ['owner', 'admin'].includes(selected.role) ? Object.keys(collectionStateKey) as SyncCollection[] : ['tasks'];
    const flush = async () => {
      if (flushing || !dirty) return;
      dirty = false; flushing = true;
      const current = snapshotStore();
      try {
        for (const collection of collections) {
          const key = collectionStateKey[collection];
          const before = (last[key] ?? []) as Array<{ id: string }>;
          const after = (current[key] ?? []) as Array<{ id: string }>;
          const previous = new Map(before.map(item => [item.id, item])); const next = new Map(after.map(item => [item.id, item]));
          for (const [id, item] of next) if (JSON.stringify(previous.get(id)) !== JSON.stringify(item)) await cloudRequest(collectionPath(collection, id), token, { method: 'PUT', body: JSON.stringify(item) }, workspaceId);
          if (['owner', 'admin'].includes(selected.role) || collection === 'tasks' && selected.role === 'delegator') {
            for (const id of previous.keys()) if (!next.has(id)) await cloudRequest(collectionPath(collection, id), token, { method: 'DELETE' }, workspaceId);
          }
        }
        last = current; setBaseline(current); saveCloudBaseline(workspaceId, current);
        if (JSON.stringify(snapshotStore()) === JSON.stringify(current)) clearCloudCache(workspaceId);
        else { dirty = true; savePendingCloudSync(workspaceId, { baseline: last, current: snapshotStore() }); }
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined; }
        setStatus('Workspace sync is up to date.'); setError('');
      } catch (reason) {
        dirty = true; savePendingCloudSync(workspaceId, { baseline: last, current: snapshotStore() });
        setError(reason instanceof Error ? reason.message : 'Sync failed. Your local copy will retry when connected.');
        retryTimer = setTimeout(() => { void flush(); }, 8000);
      } finally { flushing = false; if (dirty && !retryTimer) void flush(); }
    };
    const unsubscribe = useStore.subscribe(() => {
      if (syncPause.current) return;
      dirty = true; savePendingCloudSync(workspaceId, { baseline: last, current: snapshotStore() });
      if (timer) clearTimeout(timer); timer = setTimeout(() => { void flush(); }, 500);
    });
    dirty = JSON.stringify(last) !== JSON.stringify(snapshotStore());
    if (dirty) { savePendingCloudSync(workspaceId, { baseline: last, current: snapshotStore() }); void flush(); }
    const retry = () => { if (dirty) void flush(); };
    window.addEventListener('online', retry); window.addEventListener('focus', retry);
    return () => { unsubscribe(); window.removeEventListener('online', retry); window.removeEventListener('focus', retry); if (timer) clearTimeout(timer); if (retryTimer) clearTimeout(retryTimer); };
  }, [token, loaded, workspaceId, baseline, workspaces]);

  const selectedWorkspace = workspaces.find(item => item.id === workspaceId);
  async function reloadWorkspaces(preferId?: string) {
    if (!token) return;
    const result = await cloudRequest<{ workspaces: CloudWorkspace[] }>('/api/workspaces', token);
    setWorkspaces(result.workspaces);
    const chosen = result.workspaces.find(item => item.id === (preferId ?? workspaceId)) ?? result.workspaces[0];
    if (chosen) await loadWorkspace(chosen.id, token, result.workspaces);
    if (chosen) await refreshManagement(token, chosen.id, chosen.role);
  }
  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault(); if (!newWorkspaceName.trim() || !token) return;
    try { const result = await cloudRequest<{ workspace: CloudWorkspace }>('/api/workspaces', token, { method: 'POST', body: JSON.stringify({ name: newWorkspaceName.trim() }) }); setNewWorkspaceName(''); await reloadWorkspaces(result.workspace.id); setStatus('Workspace created.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create workspace.'); }
  }
  async function createInvite(event: React.FormEvent) {
    event.preventDefault(); if (!token || !workspaceId) return;
    try {
      const result = await cloudRequest<{ link: string; invite: { id: string } }>('/api/workspace/invites', token, { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) }, workspaceId);
      setInviteEmail('');
      try { await navigator.clipboard.writeText(result.link); setStatus('Single-use invite link copied. Share it yourself with the invited person.'); }
      catch { prompt('Copy this invite link and share it yourself:', result.link); }
      if (selectedWorkspace) await refreshManagement(token, workspaceId, selectedWorkspace.role);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create invite.'); }
  }
  async function changeRole(memberId: string, role: string) {
    if (!token || !workspaceId) return;
    try { await cloudRequest(`/api/workspace/members/${encodeURIComponent(memberId)}`, token, { method: 'PATCH', body: JSON.stringify({ role }) }, workspaceId); if (selectedWorkspace) await refreshManagement(token, workspaceId, selectedWorkspace.role); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not change this role.'); }
  }
  async function removeMember(memberId: string, memberEmail: string) {
    if (!token || !workspaceId || !confirm(`Remove ${memberEmail} from this workspace? Their linked contact information and assignments will be removed.`)) return;
    try { await cloudRequest(`/api/workspace/members/${encodeURIComponent(memberId)}`, token, { method: 'DELETE' }, workspaceId); if (selectedWorkspace) await refreshManagement(token, workspaceId, selectedWorkspace.role); setStatus('Member removed.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove member.'); }
  }
  async function logout() {
    if (token) await cloudRequest('/auth/logout', token, { method: 'POST' }).catch(() => undefined);
    clearCloudSession(); setToken(null); setLoaded(false); setWorkspaces([]); setEmail(''); onWorkspaceRole?.(null); setStatus('Signed out. This browser keeps its local copy.');
  }
  async function deleteAccount() {
    if (!token || !confirm('Delete your Workflow account? Your membership and personal data will be removed. This may require you to transfer ownership or remove other workspace members first.')) return;
    try { await cloudRequest('/auth/account', token, { method: 'DELETE' }); clearCloudSession(); setToken(null); setLoaded(false); setWorkspaces([]); onWorkspaceRole?.(null); setStatus('Account deleted.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete account.'); }
  }
  async function deleteWorkspace() {
    if (!token || !workspaceId || !confirm('Delete this workspace and all its tasks, contacts, invites, and audit records? This cannot be undone.')) return;
    try { await cloudRequest('/api/workspace', token, { method: 'DELETE' }, workspaceId); clearCloudCache(workspaceId); await reloadWorkspaces(); setStatus('Workspace deleted.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete workspace.'); }
  }
  async function exportWorkspace() {
    if (!token || !workspaceId) return;
    try {
      const result = await cloudRequest<{ data: WorkspaceData; exportedAt: string }>('/api/export', token, {}, workspaceId);
      const file = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = `workflow-workspace-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not export workspace data.'); }
  }
  async function updateVisibility(value: boolean) {
    if (!token || !workspaceId || !selectedWorkspace) return;
    try { await cloudRequest('/api/workspace', token, { method: 'PATCH', body: JSON.stringify({ membersSeeAllTasks: value }) }, workspaceId); setWorkspaces(list => list.map(item => item.id === workspaceId ? { ...item, settings: { ...item.settings, membersSeeAllTasks: value } } : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update workspace settings.'); }
  }
  async function updateTimezone() {
    if (!token || !workspaceId || !selectedWorkspace) return;
    const timezone = prompt('Workspace time zone (for example Australia/Sydney)', selectedWorkspace.timezone)?.trim();
    if (!timezone || timezone === selectedWorkspace.timezone) return;
    try { await cloudRequest('/api/workspace', token, { method: 'PATCH', body: JSON.stringify({ timezone }) }, workspaceId); setWorkspaces(list => list.map(item => item.id === workspaceId ? { ...item, timezone } : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the time zone.'); }
  }
  async function updateRetention() {
    if (!token || !workspaceId || !selectedWorkspace || !['owner', 'admin'].includes(selectedWorkspace.role)) return;
    const raw = prompt('Audit log retention in days (30–365)', String(selectedWorkspace.settings.auditRetentionDays));
    if (raw === null) return;
    const auditRetentionDays = Number(raw);
    if (!Number.isInteger(auditRetentionDays) || auditRetentionDays < 30 || auditRetentionDays > 365) { setError('Enter a whole number from 30 to 365.'); return; }
    try { await cloudRequest('/api/workspace', token, { method: 'PATCH', body: JSON.stringify({ auditRetentionDays }) }, workspaceId); setWorkspaces(list => list.map(item => item.id === workspaceId ? { ...item, settings: { ...item.settings, auditRetentionDays } } : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update audit retention.'); }
  }
  async function transferOwnership(memberId: string, memberEmail: string) {
    if (!token || !workspaceId || !confirm(`Transfer ownership to ${memberEmail}? You will become an Admin.`)) return;
    try { await cloudRequest('/api/workspace/transfer', token, { method: 'POST', body: JSON.stringify({ memberId }) }, workspaceId); await reloadWorkspaces(workspaceId); setStatus('Workspace ownership transferred.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not transfer ownership.'); }
  }
  async function deleteCompletedTasks() {
    if (!token || !workspaceId || !confirm('Permanently delete all completed tasks in this workspace?')) return;
    try {
      const result = await cloudRequest<{ deleted: number }>('/api/tasks/completed', token, { method: 'DELETE' }, workspaceId);
      const tasks = useStore.getState().tasks.filter(task => task.status !== 'done');
      syncPause.current = true; useStore.setState({ tasks }); syncPause.current = false;
      setStatus(`${result.deleted} completed task${result.deleted === 1 ? '' : 's'} deleted.`);
      await loadWorkspace(workspaceId, token, workspaces);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete completed tasks.'); }
  }

  if (!portalTarget) return null;
  return createPortal(<section className="settings-section cloud-account"><div className="section-title"><div><span className="eyebrow">OPTIONAL ACCOUNT</span><h2>Workspaces</h2></div></div>
    {!cloudApiBase ? <p className="settings-copy">Workspace sync is unavailable until the Worker URL and Google sign-in client ID are configured. Local mode and local backups continue to work.</p> : !token ? <div><p className="settings-copy">Sign in with Google to create a workspace or join one with an invite link. Google sign-in uses your name, email, and Google account identifier only.</p><div id="google-sign-in-button"/><small className="muted">Use the same Google account that received your invite.</small></div> : <>
      <p className="settings-copy">Signed in as <b>{email}</b>. Workspace records are shared with active members according to their role.</p>
      <div className="form-grid"><label className="field-label">Current workspace<select value={workspaceId ?? ''} onChange={e=>{const id=e.target.value;const chosen=workspaces.find(item=>item.id===id);if(!token||!chosen)return;void loadWorkspace(id,token,workspaces).then(()=>refreshManagement(token,id,chosen.role)).catch(reason=>setError(reason.message));}}>{workspaces.map(item=><option key={item.id} value={item.id}>{item.name} · {roleLabel(item.role)}</option>)}</select></label></div>
      <form className="inline-add" onSubmit={createWorkspace}><input required maxLength={100} placeholder="New workspace name" value={newWorkspaceName} onChange={event=>setNewWorkspaceName(event.target.value)}/><button className="primary-button">Create workspace</button></form>
      {selectedWorkspace&&<><p className="muted">Your role: {roleLabel(selectedWorkspace.role)} · Workspace time zone: {selectedWorkspace.timezone} <button className="text-button" onClick={()=>void updateTimezone()}>Change</button></p><p className="privacy-warning" role="note"><b>Privacy reminder</b><span>Do not enter details about children or minors. Do not put sensitive or operational information in task text.</span></p>
      {['owner','admin'].includes(selectedWorkspace.role)&&<><label className="choice-row"><input type="checkbox" checked={selectedWorkspace.settings.membersSeeAllTasks} onChange={event=>void updateVisibility(event.target.checked)}/> Members may view all workspace tasks (default: off)</label><form className="inline-add" onSubmit={createInvite}><input type="email" required placeholder="Invitee email address" value={inviteEmail} onChange={event=>setInviteEmail(event.target.value)}/><select value={inviteRole} onChange={event=>setInviteRole(event.target.value as typeof inviteRole)}><option value="member">Member</option><option value="delegator">Delegator</option>{selectedWorkspace.role==='owner'&&<option value="admin">Admin</option>}</select><button className="primary-button">Create invite link</button></form><small className="muted">Workflow does not email invites. The single-use link is copied so you can share it yourself; it expires in 7 days.</small>
      {members.map(member=><div className="manage-row" key={member.id}><b>{member.email}</b><select aria-label={`Role for ${member.email}`} value={member.role} disabled={member.role==='owner'||(selectedWorkspace.role!=='owner'&&member.role==='admin')} onChange={event=>void changeRole(member.id,event.target.value)}>{member.role==='owner'&&<option value="owner">Owner</option>}<option value="admin">Admin</option><option value="delegator">Delegator</option><option value="member">Member</option></select>{selectedWorkspace.role==='owner'&&member.role!=='owner'&&<button className="text-button" onClick={()=>void transferOwnership(member.id,member.email)}>Transfer ownership</button>}{member.role!=='owner'&&<button className="text-button danger-text" onClick={()=>void removeMember(member.id,member.email)}>Remove</button>}</div>)}
      {invites.map(invite=><div className="manage-row" key={invite.id}><b>{invite.email}</b><small>{invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}</small><button className="text-button danger-text" onClick={()=>void cloudRequest(`/api/workspace/invites/${invite.id}`,token,{method:'DELETE'},workspaceId!).then(()=>refreshManagement(token,workspaceId!,selectedWorkspace.role)).catch(reason=>setError(reason.message))}>Revoke</button></div>)}
      </>}
      {['owner','admin'].includes(selectedWorkspace.role)&&<div className="settings-actions"><button className="text-button" onClick={()=>void updateRetention()}>Audit retention: {selectedWorkspace.settings.auditRetentionDays} days</button><button className="text-button danger-text" onClick={()=>void deleteCompletedTasks()}>Delete completed tasks</button></div>}
      {selectedWorkspace.role==='owner'&&<div className="settings-actions"><button className="text-button" onClick={()=>void exportWorkspace()}>Export workspace data</button><button className="text-button danger-text" onClick={()=>void deleteWorkspace()}>Delete workspace</button></div>}
      {!['owner'].includes(selectedWorkspace.role)&&<button className="text-button" onClick={()=>void cloudRequest('/api/workspace/leave',token,{method:'POST'},workspaceId).then(()=>reloadWorkspaces()).catch(reason=>setError(reason.message))}>Leave workspace</button>}
      </>}
      <p className="muted">Sessions last 7 days. Removed members lose access on their next request. Cloud sync keeps tasks, contact names/emails, groups, and task templates. Calendar notes and locations stay on this device.</p>
      <button className="text-button" onClick={()=>void logout()}>Sign out</button><button className="text-button danger-text" onClick={()=>void deleteAccount()}>Delete account</button>
    </>}
    {status&&<p className="muted" role="status">{status}</p>}{error&&<p className="danger-text" role="alert">{error}</p>}
  </section>, portalTarget);
}
