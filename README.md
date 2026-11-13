# Workflow

Workflow is a personal organiser PWA for events, checklists, and delegated tasks. It can run entirely in one browser, or optionally sync workspaces through a Cloudflare Worker and D1 database.

This guide is split into two jobs:

1. **Use the app:** run it, back up your data, and publish/install it.
2. **Set up cloud workspaces:** complete the one-time Google, Cloudflare, and GitHub setup yourself.

Cloud setup is optional. Local mode works without accounts or provider keys. No part of this project is allowed to switch to a paid plan automatically.

## Before you start: what the app does

- Today dashboard, agenda, calendar and week planner.
- Events, tasks, checklists, delegated tasks, groups and templates.
- Local JSON backup/restore and calendar export.
- Installable PWA with an offline app shell.
- Optional Google sign-in and private cloud workspaces after you complete Part 2.
- Email reminders are **not sent by a server**. “Send reminder” opens a prefilled email draft. You send it yourself and confirm in Workflow if you want a local history entry.
- The Today screen is the in-app **My tasks & reminders** centre. Optional browser alerts can notify about configured task reminder times while Workflow is open and permission is granted.
- No SMS, mobile-number fields, invitation emails, automatic reminder emails, or paid email provider.

The app starts with sample content. Remove it in **Settings → Clear sample data** before entering real information.

> **Privacy warning:** Do not enter details about children or minors, sensitive personal or health details, identity/service numbers, credentials, security plans, or sensitive operational information. The app has no third-party analytics, trackers, or ads. Read [PRIVACY-NOTICE-TEMPLATE.md](PRIVACY-NOTICE-TEMPLATE.md) and [TERMS-TEMPLATE.md](TERMS-TEMPLATE.md); both are templates, not legal advice.

## Part 1 — Use the app

### A. Run it on your computer

1. Install the current Node.js LTS release from [nodejs.org](https://nodejs.org/).
2. Open this repository’s `workflow` folder in VS Code. In this checkout, it is inside `AI apps` and contains `package.json`.
3. Choose **Terminal → New Terminal**. If the terminal prompt ends with `work-experience-task %` (as in your error), move into the app folder first:

   ```sh
   cd "AI apps/workflow"
   ```

   Check that you are in the right folder:

   ```sh
   ls package.json
   ```

   It should print `package.json`. If it says “No such file or directory”, stop and open the `workflow` folder in VS Code before continuing.

4. Run the app from that folder:

   ```sh
   npm install
   npm run dev
   ```

5. Open the `http://localhost:...` address Vite prints. Leave the terminal running. Press **Control+C** to stop it.

To test on a phone on the same Wi-Fi, stop the server and run `npm run dev -- --host`. Open the **Network** address Vite prints on the phone. This is only a preview; use the published HTTPS site for a lasting install.

### B. Back up your information

Use **Settings → Back up now** regularly and keep the downloaded JSON somewhere private. Local browser data does not automatically copy to another browser. Cloud sync is not a backup against mistaken edits or deletion. Removing an account or workspace cannot remove JSON files already downloaded to your devices.

### C. Publish the website with GitHub Pages

This repository is already connected to [jakedekock28-crypto/Workflow-app](https://github.com/jakedekock28-crypto/Workflow-app). You do not need to create another repository or add a Git remote.

1. On GitHub, open the repository and select **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Select **Actions** and wait for **Deploy Workflow to GitHub Pages** to finish with a green check.
4. Open the site URL shown in **Settings → Pages**. For this repository it is normally:

   `https://jakedekock28-crypto.github.io/Workflow-app/`

For later code changes, from the `workflow` folder run `npm run build`, then commit and push. GitHub Actions publishes the new version. GitHub Pages is free for public repositories on GitHub Free; see [GitHub Pages availability and limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). Do not add private data or credentials to repository files.

### D. Install it on your phone

Open the published HTTPS site once, then:

- **iPhone/iPad:** open in Safari → **Share → Add to Home Screen**.
- **Android:** open in Chrome → browser menu → **Install app** or **Add to Home screen**.

The app shell can work offline after it has loaded. Sign-in and cloud sync need the internet. Browser alerts depend on device/browser support and permission; Workflow must remain open, so they are not a guaranteed alarm service. Notification text is generic and does not include task details.

### E. Create delegated tasks and send reminders yourself

1. In **Delegated**, add a person with their name and email address. Role is optional. There are no phone, SMS, or notes fields.
2. Optionally create a group from saved people.
3. Create a delegated task and fill in its title, description, requirements/checklist, due date/time, priority, and assignees.
4. Select **Preview email** to check the message.
5. Select **Send reminder** to open your email app with a draft. Review it and press Send in that email app.
6. Return to Workflow and select **I sent it** only if you actually sent it. This records your confirmation; Workflow cannot verify delivery.

Email drafts and confirmation history are local browser data. Confirmed reminder history expires after 90 days by default; change it from **Delegated → Reminder log retention** (30–365 days). Browser alerts are local to that device and run only while Workflow is open. There is no server-side reminder scheduler or delivery log. In cloud mode, tasks and contacts sync by workspace, while the app’s calendar/events remain on that device.

## Part 2 — Set up cloud workspaces (optional)

Cloud mode requires three setup steps: make a Google OAuth client, create/deploy the Worker and D1 database, then add two public build variables to GitHub. Do not enter payment details or upgrade any account. Stop if a provider asks you to add a card or select a paid plan.

### What you need to do in provider dashboards

#### 1. Google sign-in client

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a project.
2. Configure the OAuth consent/branding screen with the app name and contact details. Set its URLs to the following after replacing the bracketed fields in the policy pages:

   - Homepage: `https://jakedekock28-crypto.github.io/Workflow-app/`
   - Privacy: `https://jakedekock28-crypto.github.io/Workflow-app/privacy.html`
   - Terms: `https://jakedekock28-crypto.github.io/Workflow-app/terms.html`

   The pages are included in `public/` and linked in the app footer. Review Google’s domain verification requirement below before relying on cloud login.
3. Create an OAuth client of type **Web application**.
4. Add these **Authorized JavaScript origins**:

   - `https://jakedekock28-crypto.github.io`
   - `http://localhost:5173`

   For localhost testing with another port, add that exact origin too.

5. Enable only basic sign-in identity (`openid`, `email`, `profile`). Do not enable Gmail, Calendar, Drive, or other Google API access.
6. Copy the OAuth **Client ID** (not a client secret). A browser client ID is public, but do not publish credentials or service keys.

Google’s [official client-ID setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) requires an authorized domain. For a private trial, choose **External**, keep the OAuth app in **Testing**, and request only `openid`, `email`, and `profile`. Google documents that apps requesting only basic identity scopes can use the sign-in exception in Testing. For a public production launch, Google requires domain ownership verification for the top-level private domain used by your app. This Pages address is under the shared `github.io` domain, which you do not own, so production verification is blocked unless Google changes its requirements or you use a domain you own. Do not buy a domain to work around it. Local mode remains available; keep cloud access in a testing setup until Google confirms the free-hosted address can be used.

#### 2. GitHub Pages repository settings

The repository must be public to use GitHub Pages under GitHub Free. In **Settings → Pages**, set the source to **GitHub Actions**. The deployment workflow already exists at `.github/workflows/deploy.yml`.

After deploying the Worker in the next section, add these under **Settings → Secrets and variables → Actions → Variables**:

| Variable name | Value |
| --- | --- |
| `VITE_API_BASE_URL` | Your Worker base URL, e.g. `https://workflow-api.<your-subdomain>.workers.dev` (no `/health`) |
| `VITE_GOOGLE_CLIENT_ID` | The Google Web OAuth Client ID |

These values are public browser configuration, so use **Variables**, not **Secrets**. Never put API keys, passwords, or private keys in either the frontend variables or the repository.

#### 3. Cloudflare account

Create a Cloudflare account on the Free plan. This app needs Workers, D1, and one daily Cron Trigger for old audit-log cleanup. It does **not** need an email-sending service or any secret key. The Worker enforces exact app-origin CORS and checks current workspace membership on each API request.

### What you do in this project terminal

Run commands from the repository’s `workflow` folder unless a step says `worker`.

#### 1. Install Worker tools and log in

```sh
npm install
npm --prefix worker install
npm --prefix worker exec -- wrangler login
```

`wrangler login` opens Cloudflare in your browser for authorization.

#### 2. Create a D1 database

```sh
npm --prefix worker exec -- wrangler d1 create workflow-production --location=oc
```

`oc` is an Oceania location hint, not a promise that all processing or storage stays in Australia. Copy the returned database ID into `worker/wrangler.jsonc`, replacing the all-zero example ID. If this database already exists in your Cloudflare account, use its existing ID; do not create duplicates.

#### 3. Set the Google client ID and apply the database migration

In `worker/wrangler.jsonc`, replace `SET_IN_GOOGLE_CLOUD_CONSOLE` with your Google Client ID. Check that `APP_URL` exactly matches the published app address including `/Workflow-app/`.

Then apply the schema and privacy migration to the remote database:

```sh
npm run worker:db:migrate:remote
```

The migration creates workspace-scoped records and removes legacy phone/SMS fields and old magic-link records. It also removes the previous cloud calendar/area/event data; calendar data is local-only in this release. Before running it on an existing database, download a JSON backup from the old app and review the migration. This schema migration cannot be rolled back to restore dropped records.

#### 4. Deploy the Worker

```sh
npm run worker:deploy
```

Wrangler prints a URL like `https://workflow-api.<your-subdomain>.workers.dev`. Open that URL with `/health` appended; it should return `{"status":"ok"}`. Use the base URL without `/health` for `VITE_API_BASE_URL` in GitHub.

#### 5. Add GitHub variables and publish the configured app

Add `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` in GitHub as described above. Then open **Actions → Deploy Workflow to GitHub Pages** and select **Run workflow**, or push a commit to `main`. After it finishes, reload the Pages site and open **Settings → Account**.

Sign in with Google. On a new empty account, the app offers to import existing local app data; choose whether to import. Invite links are copied for the workspace owner to share directly. The invitee must sign in with the invited email address and accept the single-use link before expiry. No invitation email is sent.

### Workspace actions and who can see tasks

- **Owner:** manages workspace, members, roles, exports and deletion; sees all tasks.
- **Admin:** manages workspace data and members; sees all tasks.
- **Delegator:** creates and edits tasks they created, and sees tasks they created or are assigned to.
- **Member:** sees assigned tasks by default and can update progress on assigned tasks.
- The Owner can change the workspace setting to let all members see all tasks.

Members are checked against the current membership on every cloud request. Removing a member deletes their linked contact data and removes their access. Removing a cloud record does not delete local browser copies or backups that were already downloaded.

The workspace owner can export workspace data, remove completed tasks, set audit retention (30–365 days, default 90), and delete the workspace. Account deletion is in **Settings → Workspaces → Delete account**. Owners may need to transfer ownership or remove members first. To remove everything stored in the service, use workspace deletion and account deletion as appropriate, and separately delete device backups.

### Local development of cloud mode

Use a local D1 database and Worker, then run the frontend in another terminal. Local setup does not send email and does not need provider keys.

From the project root:

```sh
npm run worker:db:migrate:local
npm run worker:dev -- --var APP_URL:http://localhost:5173/
```

In a second terminal, also from the project root:

```sh
VITE_API_BASE_URL=http://localhost:8787 VITE_GOOGLE_CLIENT_ID=your-client-id npm run dev
```

Add `http://localhost:5173` as a Google authorized JavaScript origin. The Worker command overrides `APP_URL` only for this local run; your production URL in `worker/wrangler.jsonc` stays unchanged.

### Free-tier limits and cost guardrails

The plan is to use only the provider free tiers and to stop when a free limit blocks the service. Do not enable a paid plan or add a card. Check the linked official pages again before setup because provider limits can change.

| Provider | Current relevant free allowance | What happens at the limit |
| --- | --- | --- |
| Cloudflare Workers | 100,000 requests/day; 10 ms CPU per request on Free | Requests can fail until the daily reset. Do not upgrade. |
| Cloudflare D1 | 5 million rows read/day, 100,000 rows written/day, 5 GB total storage on Free | Database operations can be rejected/limited. Do not upgrade. |
| Cloudflare D1 databases | Up to 10 databases on Workers Free | Delete an unused database or stay within the limit. Do not upgrade. |
| Cloudflare Cron | Free supports up to 5 Cron Triggers per account; this project uses one daily trigger for audit cleanup | The Free Cron CPU limit is 10 ms per run. This small cleanup can stop/fail at the limit; do not upgrade. |
| GitHub Pages | Available on GitHub Free for public repositories | Keep the repository public or use local mode; do not pay to make a private Pages site. |
| Google sign-in | Basic identity sign-in uses Google Identity Services; this app requests no paid Google API | Domain/branding verification may block the GitHub Pages hostname as explained above. |

Official sources checked 13 November 2026: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [D1 location hints](https://developers.cloudflare.com/d1/configuration/data-location/), and [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). The Worker does not send mail, so there is no email provider quota or chance of unexpected email charges. Cloudflare Free limits reject requests/queries when reached; do not switch to Workers Paid.

### Privacy and Australian data-location checks

The app stores account identifier/email, workspace membership and settings, names/emails/optional roles for contacts, groups, and task information in cloud mode. Session tokens are stored as hashes server-side; rate-limit identifiers are hashed. Task, contact, group, invite, or email details are not included in URL parameters, analytics, or application error logs. Emails are masked in server logs. Google receives sign-in identity only. Cloudflare hosts the Worker and D1 database; GitHub Pages serves the app. Do not enter children's details or sensitive/operational information.

The privacy and terms documents are Australian-user templates and must be completed and reviewed by the workspace owner. Check whether the Privacy Act 1988 and Australian Privacy Principles apply to you, and consider overseas disclosure under APP 8. Cloudflare's Oceania hint is not an Australia-only data-location guarantee; Google's and GitHub's processing can also occur outside Australia. See the [OAIC APP 8 guidance](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information). This is not legal advice.

### Troubleshooting

| Problem | What to check |
| --- | --- |
| `node` or `npm` not found | Install Node.js LTS and restart VS Code. |
| Pages site is blank or old | Check **Actions** for a successful deployment and **Settings → Pages** for GitHub Actions source. |
| `Settings → Account` says cloud is not configured | Check GitHub Actions variables are exactly `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID`, then redeploy Pages. |
| Worker `/health` fails | Confirm `npm run worker:deploy` succeeded and use the exact `workers.dev` URL. |
| Google sign-in rejects the website origin | Check the OAuth client origin and the authorized-domain ownership/verification issue described in Google setup. The default GitHub hostname may not be accepted. |
| Invite cannot be accepted | The signed-in Google email must match the invite email, and the one-use link must not be expired or already used. Ask the owner to copy a new invite link. |
| A cloud action is forbidden | Ask the workspace owner to check your active membership and role. Changes to membership take effect on the next request. |
| Sync does not work offline | Offline changes wait in the browser until it reconnects. Keep backups and avoid editing the same record on multiple offline devices. |
| Email reminder not sent | Workflow only opened a draft. Send it from your email app; the app cannot verify delivery. |

## Developers: test and build

From the repository root:

```sh
npm install
npm --prefix worker install
npm test
npm run build
```

`npm test` runs frontend migration/notification/cloud-client tests and Worker permissions/data-isolation tests. `npm run build` runs TypeScript checks for both app and Worker, then creates the production PWA files in `dist/`. To preview that production build locally, run `npm run preview`.

## License

MIT. See [LICENSE](LICENSE).
