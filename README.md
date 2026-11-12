# Workflow

Workflow is a personal organiser for events, tasks and reminders. It works in a web browser and can be installed on a phone. Your information is saved in that browser on that device.

## What works today

- Today dashboard, month calendar, agenda and week planner.
- Colour-coded areas and sections, events, task checklists and Biv planning prompts.
- Delegated tasks, task templates, recurring tasks, subtasks and search filters.
- Light and dark themes, local JSON backup and restore, and `.ics` calendar export.
- An installable PWA with an offline app shell.

The app works locally in your browser and can optionally sync to a private account through the Phase 2 Cloudflare service described below. It starts with generic sample content that you can remove in **Settings → Clear sample data**. Cloud sync is not active on the published site until you complete the one-time provider setup steps in Part 5.

> **Privacy note:** GitHub Pages is a public website, including when the repository itself is private. Do not put real names, plans, contact details, credentials or private sample data in source files. Local mode stores data in this browser. Cloud mode stores your account data in a private D1 database and sends sign-in links through Resend. Provider secrets belong in Cloudflare, never in the frontend or GitHub variables.

### Google integration status

Google sign-in, Calendar sync, Drive attachments and Drive cloud backup are **not implemented in this version**. There is a separate [Google integration guide](GOOGLE-SETUP.md) for the Google Cloud and GitHub steps you will need to do yourself after the integration code is added. Setting up Google Cloud alone will not add Google buttons or sync to the current app.

## Part 1: Run the app on your computer

### Step 1: Open the right folder

1. Open **VS Code**.
2. Choose **File → Open Folder…**.
3. Select this repository's `workflow` folder. It is the folder containing `package.json`, `src`, and `.github`.
4. Choose **Terminal → New Terminal**. Commands below must be run from this `workflow` folder.

### Step 2: Install Node.js

Workflow needs Node.js and npm. If `node -v` or `npm -v` below reports “command not found”, install the current **LTS** version from [nodejs.org](https://nodejs.org/en/download/), then quit and reopen VS Code.

In the VS Code terminal, run:

```sh
node -v
npm -v
```

Both commands should print a version number.

### Step 3: Install the project packages

In the same terminal, run:

```sh
npm install
```

This downloads the libraries the app needs. Normally you only do this once, or again after dependencies change.

### Step 4: Start the app

Run:

```sh
npm run dev
```

Open the `http://localhost:...` address printed in the terminal. Leave the terminal running while you use the app. To stop the app, click the terminal and press **Control+C**.

## Part 2: Try the app on your phone over Wi-Fi

This is a local preview, not the installed published app.

1. Make sure your phone and computer are connected to the same Wi-Fi network.
2. In the VS Code terminal, stop any running server with **Control+C**.
3. Start the server so other devices on your Wi-Fi can reach it:

   ```sh
   npm run dev -- --host
   ```

4. Find the **Network** address printed by Vite.
5. Type that address into your phone's browser.

If the Network address does not open, check that both devices are on the same Wi-Fi and that your computer's firewall allows the connection. For a lasting phone install, publish the app and use its HTTPS address in Part 4.

## Part 3: Publish the app with GitHub Pages

### Step 1: Open the existing GitHub repository

This project is already connected to the [`Workflow-app` repository](https://github.com/jakedekock28-crypto/Workflow-app). You do **not** need to create another repository or run `git remote add origin`.

1. Sign in at [github.com](https://github.com).
2. Open [jakedekock28-crypto/Workflow-app](https://github.com/jakedekock28-crypto/Workflow-app).
3. Confirm the latest project files appear on the `main` branch.

### Step 2: Turn on GitHub Pages

Do this on **GitHub in your web browser**:

1. Open the repository and choose **Settings**.
2. In the left menu, choose **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the repository's **Actions** tab. Wait for **Deploy Workflow to GitHub Pages** to finish with a green check. Select a run to see its build or deployment details.
5. Return to **Settings → Pages** and open the website address GitHub shows.

GitHub's [Pages publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) describes these settings. This repository already contains the build and deploy workflow at `.github/workflows/deploy.yml`.

### How the website address is chosen

For the current project repository, the website address is usually:

```text
https://jakedekock28-crypto.github.io/Workflow-app/
```

The workflow sets the Vite base path from the repository name automatically. You do not need to change it for this address. If you use a custom domain or rename the repository to `jakedekock28-crypto.github.io`, edit the `VITE_BASE_PATH` line in `.github/workflows/deploy.yml` to `/` before pushing.

### Step 3: Publish later changes

After you edit files in VS Code, run these commands from the `workflow` folder:

```sh
npm run build
git add .
git commit -m "Describe your change"
git push
```

The build checks and creates the production app. The push uploads your change, then GitHub Actions builds and republishes the website. To check progress, open **GitHub → your repository → Actions**.

## Part 4: Install the published app on your phone

First open the published HTTPS website from Part 3 and let it finish loading once.

- **iPhone/iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open the site in Chrome, open the browser menu, then tap **Install app** or **Add to Home screen**.

Open the installed app once while online. The app shell can then open offline. Google sync, web links and phone sharing still need an internet connection or the relevant phone app.

## Google integrations

Google sign-in, Calendar sync, Drive attachments and Drive cloud backup are **not implemented in the current app**. Google Cloud setup and GitHub variables alone will not add these features. When the integration code is ready, use the separate [Google integrations: manual setup guide](GOOGLE-SETUP.md) for the account setup you need to complete yourself.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| `npm` or `node` is not found | Install Node.js LTS, fully quit and reopen VS Code, then try `node -v` and `npm -v` again. |
| `npm run dev` says the port is busy | Stop the other Vite server with Control+C, or open the new port Vite prints. |
| Git says `origin` already exists | You have already connected this folder to a remote. Check it with `git remote -v`; do not add another `origin`. |
| GitHub Pages has no site or shows an old build | Check **Actions** for a green deployment run, then check **Settings → Pages → Source** is **GitHub Actions**. |
| The Pages site is blank | Check that `VITE_BASE_PATH` matches the site URL and that the latest Actions run succeeded. A normal repository URL uses `/<repository-name>/`; a user site or custom domain at the root uses `/`. |

## Data, privacy and reminders

Without Google connected, app data is held in browser local storage on this device. It does not sync to another browser or phone. Clearing browser site data can erase it, so download a JSON backup from **Settings → Back up now** first.

Google sync is not available in this version. When added, Calendar and Drive data will be sent directly between your browser and your own Google account using permissions you approve; the app has no Workflow server. Review event notes and task details before syncing them to a calendar.

The Today and Delegated screens are the dependable reminders when you open the app. A static site without a backend cannot reliably send background push notifications to iPhones.

## Build and verification

From the `workflow` folder:

```sh
npm run build
npm run preview
```

The build runs strict TypeScript checking and creates the production bundle, PWA manifest and service worker. Preview the built app at the local address Vite prints. Real phone installation and offline behaviour must be checked on the deployed HTTPS site; a local production build cannot confirm phone browser behaviour.

## Licence

MIT. See [LICENSE](LICENSE).

## Delegated tasks: this phase and your part

Delegated tasks work with the app's local browser storage. There is no login, online contact database, email service, SMS service, or automatic reminder worker in this release. Your people, task assignments, templates, and message history stay in this browser and should be included in your regular JSON backups.

### Set up your contacts

1. Open **Delegated** in the bottom navigation.
2. Choose **Add person** and enter their name, email, and/or Australian mobile number. Local mobile input such as `0412 345 678` is saved in `+61412345678` format.
3. Confirm SMS consent only when the person has agreed to receive SMS. The app does not offer an SMS draft when consent is off.
4. Use **Manage people** to edit contact details, deactivate or reactivate a person, or delete them. Deleting also removes that person from groups and existing task assignments.
5. Choose **New group** to create a group. Enter the contact numbers shown in the prompt, separated by commas (for example `1,3`). Groups are shortcuts to roster members.

Older delegated tasks that only had a typed name are migrated into saved contacts. Those contacts are marked **Check migrated contact** because the old app did not have verified email, mobile, or consent details. Review these before making contact.

### Create and message a delegated task

1. Use the **+** button and choose **Delegate**.
2. Enter the title, date and time, description, requirements, priority, and optional event.
3. Select one or more active people. The picker shows group headings and their members; select the individual members listed under the group. On a computer, hold **Command** (Mac) or **Ctrl** (Windows) to select multiple options.
4. Set the task's reminder preferences. In this phase they are saved with the task for planning; they do not send automatically.
5. Open the task in **Delegated**. **Preview** shows the prepared email and SMS text with placeholders filled in. Update the template from **Message templates**.
6. Choose **Email** or **SMS** to open a draft in the device's mail or messaging app. Check the recipient and message, then send it there. Workflow does not send it itself.
7. Return to Workflow and choose **I sent it** only after you sent the message. This records a local, user-confirmed history entry. It does not prove delivery. Do not log the message if you cancelled or did not send it.

Messages are prepared one recipient at a time. Bulk sending, automated scheduling, provider delivery logs, retries, and resend queues are not part of this phase. Email templates and message history can contain personal task details, so protect your device and backups.

### Checks for this phase

Run these from the `workflow` folder:

```sh
npm install
npm test
npm run build
```

`npm test` covers legacy data migration, Australian phone formatting, template rendering, and reminder schedule calculations. These checks do not send messages or connect to a provider.

### Later integration work

## Part 5: Turn on private cloud accounts and sync (Phase 2)

This part is optional. Skip it if you only want to use the app on one browser/device. Phase 2 adds email-link sign-in and private cloud sync using Cloudflare Workers + D1, Resend, and Cloudflare Turnstile. **It does not send delegated-task reminders yet.** Scheduled task notifications are a later phase; SMS sending is not part of the approved design.

There are two kinds of work below:

- **You do once in provider dashboards:** make accounts, verify a sending domain, create a database/security widget, and store service secrets.
- **You do in this project:** install Worker packages, configure its public IDs/settings, run database migrations, and deploy the Worker.

### Before you start: accounts and information you need

Have access to:

1. The GitHub repository and permission to edit its settings and Actions variables.
2. A Cloudflare account where you can create a Worker, D1 database, and Turnstile widget.
3. A domain you control for sending sign-in emails. Resend requires you to verify the domain by adding the DNS records it provides. You can use a subdomain such as `mail.example.com`; do not use `example.com` literally.
4. A Resend account and an API key.

Keep the Cloudflare and Resend dashboards open. Provider dashboards may use different labels over time, but the values you need are named below.

### A. Set up and deploy the Worker (project + Cloudflare)

Open the project’s `worker` folder in a terminal. In VS Code, choose **Terminal → New Terminal**, then run:

```sh
cd worker
npm install
npx wrangler login
```

`wrangler login` opens a browser so you can authorize this computer with your Cloudflare account.

#### 1. Create the database

In that same terminal, run:

```sh
npx wrangler d1 create workflow-production
```

Cloudflare prints a `database_id`. Open `worker/wrangler.jsonc` and replace the example `database_id` (`00000000-0000-0000-0000-000000000001`) with that value. The ID identifies the database; it is not a password. Keep `database_name` as `workflow-production`.

Apply the tables to the Cloudflare database:

```sh
npm run db:migrate:remote
```

#### 2. Verify Resend email sending

In Resend, add a sending domain and follow its instructions to add the listed DNS records at the company where you manage the domain. Wait until Resend shows the domain as verified. Create an API key with permission to send from that verified domain.

Open `worker/wrangler.jsonc` and replace `no-reply@example.com` in `RESEND_FROM` with an address at your verified domain, for example `Workflow <no-reply@mail.example.com>`.

Store the Resend API key as a Cloudflare Worker secret (the command will prompt for it; paste it at the prompt):

```sh
npx wrangler secret put RESEND_API_KEY
```

#### 3. Add the sign-in security check

In the Cloudflare dashboard, open **Turnstile**, add a widget, and allow the hostname `jakedekock28-crypto.github.io`. Copy its **site key** into `TURNSTILE_SITE_KEY` in `worker/wrangler.jsonc` (replace `SET_IN_CLOUDFLARE_DASHBOARD`).

Store the widget’s **secret key** separately as a Worker secret:

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY
```

The site key is public and is used by the browser form. The secret key must stay in Cloudflare. The Worker checks the challenge on the server and checks that its hostname matches `APP_URL`.

#### 4. Confirm the app address and deploy

The supplied `APP_URL` in `worker/wrangler.jsonc` already points to this project’s GitHub Pages address:

```text
https://jakedekock28-crypto.github.io/Workflow-app/
```

If your published app uses a different hostname, change `APP_URL` to the full app URL, update the allowed hostname in the Turnstile widget, and save. Then deploy from the `worker` folder:

```sh
npm run deploy
```

Wrangler prints the Worker address, normally like `https://workflow-api.<your-workers-subdomain>.workers.dev`. Open that address with `/health` appended. You should see `{"status":"ok"}`. Save the base Worker address without `/health`; you need it for GitHub in the next section.

### B. Connect the published website (GitHub)

This step tells the website which Worker to contact. The Worker address is public, so it is an **Actions variable**, not a secret.

1. Open the repository on GitHub and choose **Settings**.
2. Choose **Secrets and variables → Actions → Variables → New repository variable**.
3. Set the name to `VITE_API_BASE_URL`.
4. Set the value to the Worker base address from the previous section, for example `https://workflow-api.<your-workers-subdomain>.workers.dev` (no `/health` and no trailing route).
5. Save it, then open **Actions** and choose **Deploy Workflow to GitHub Pages → Run workflow**. If the button is unavailable, make a small commit and push it to `main`; the normal workflow will deploy the app.
6. When the run succeeds, reload the published site. Open **Settings → Account** to request a sign-in link.

The existing deploy workflow reads `VITE_API_BASE_URL` during its build. Do not put `RESEND_API_KEY` or `TURNSTILE_SECRET_KEY` in GitHub; only the Worker needs those secrets.

### C. Sign in and move existing browser data into the cloud

1. Open the published app while online and go to **Settings → Account**.
2. Enter your email and complete the security check. Select **Send sign-in link**.
3. Open the email from Workflow on the same browser/device and select its link. The link expires after 10 minutes and can only be used once.
4. If this is a new, empty account and this browser has data, the app asks whether to copy the browser’s data into the account. Confirm to import it, or cancel to start the cloud account empty. Import does not overwrite an account that already contains data.
5. Open the app on another device/browser and sign in with the same email. Cloud data will load there. Keep making JSON backups from **Settings → Back up now**.

Cloud sessions expire after 7 days, then you can request another link. If you close or lose the one-time link before opening it, request a new one.

### Optional: run the Worker locally

Use this to try the cloud sign-in flow before deploying. You need a valid Resend API key and a sender address verified with Resend to receive real email. Turnstile publishes test keys for local testing; these always pass and must never be used in production.

From the project root, copy the example secrets file, then open `worker/.dev.vars` and add your Resend key:

```sh
cp worker/.dev.vars.example worker/.dev.vars
```

In `worker/.dev.vars`, set `RESEND_API_KEY` to your real Resend key. The example Turnstile secret is a test key. In one terminal, start the Worker in development mode:

```sh
npm run worker:dev -- --var APP_ENV:development --var APP_URL:http://localhost:5173/ --var TURNSTILE_SITE_KEY:1x00000000000000000000AA
```

In a second terminal, from the project root, start the frontend with the local Worker URL:

```sh
VITE_API_BASE_URL=http://localhost:8787 npm run dev
```

Open the localhost address printed by Vite. `.dev.vars` is ignored by Git. Never commit it or paste API keys into source files.

### What it costs and what the limits mean

At the current provider free tiers, a small personal deployment can cost **$0/month** if you stay under their included limits:

| Service | Current free allowance relevant here | What can cause a charge or stop |
| --- | --- | --- |
| Cloudflare Workers | 100,000 requests/day on Workers Free | The app may need the $5/month Workers Paid plan for higher limits or operational needs. |
| Cloudflare D1 | 5 million rows read/day, 100,000 rows written/day, and up to 5 GB total free account storage | Free daily limits are enforced; requests can fail until the daily reset if exceeded. |
| Cloudflare Turnstile | Free plan, including up to 20 widgets/account | No per-challenge charge on the stated free plan. |
| Resend | 100 emails/day and 3,000 emails/month | Phase 2 caps sign-in sends at 90/day to leave margin under the daily limit. Exceeding Resend plan limits may block delivery or require a paid plan. |

These are provider limits, not a promise that every usage pattern will remain free. Check the live [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/), and [Resend pricing](https://resend.com/pricing) before expanding use. Phase 2 sends only sign-in email. Task reminders and their email volume are not included in these estimates.

### Important privacy and current limitations

- Local-only data stays in that browser. Cloud accounts sync only after setup and sign-in.
- Cloud sign-in uses a browser session token stored locally in the browser for up to 7 days. Anyone who can run malicious script in the app page could potentially access that token; keep the published app and browser up to date and use a trusted device.
- Your account is private to your verified email, and database queries are scoped to that account. Provider administrators still operate the infrastructure under their service terms.
- Keep regular JSON backups. Cloud sync is not a backup against mistakes: edits and deletions sync too.
- Phase 2 does not send task assignments, reminders, SMS, or push notifications. It does not yet have a notification scheduler or delivery log.
- Offline edits queue in this browser and sync when it reconnects. If two devices edit the same item while offline, the most recent pending/local version can win when syncing; there is no conflict review screen yet.

### If something goes wrong

| Problem | Check this |
| --- | --- |
| **Settings → Account** says cloud sync is not configured | Confirm the GitHub Actions variable is named exactly `VITE_API_BASE_URL`, then rerun the Pages deployment. |
| Worker `/health` does not show `{"status":"ok"}` | Confirm the Worker deployed successfully in the Cloudflare dashboard and use its exact `workers.dev` address. |
| Sign-in says the security check failed | Confirm the Turnstile site key and secret belong to the same widget, the app hostname is allowed, and `APP_URL` is correct. |
| No sign-in email arrives | Check Resend’s domain verification, sender address, API key secret, Resend email logs, and spam folder. |
| Login email says send failed | Check `RESEND_API_KEY` and `RESEND_FROM` Worker settings/secrets, then redeploy after changing a non-secret `wrangler.jsonc` value. |
| Sync says the session expired | Request a new sign-in email; sessions last 7 days. |
| Local Worker has missing tables | From the project root, run `npm run worker:db:migrate:local`, then restart `npm run worker:dev`. |

### Phase 2 developer checks

From the project root, run:

```sh
npm install
npm --prefix worker install
npm test
npm run build
```

The tests cover local data migration, phone formatting, message templates, reminder calculations, cloud offline merge behavior, and account data isolation in D1. Build output is split into smaller JavaScript files so the previous Vite warning about a chunk larger than 500 kB no longer appears.

## Later phase

The next stage, Phase 3, is the hosted notification service: scheduled task reminders through a Cloudflare Cron Trigger and Resend email, plus delivery logging and retries. It is not part of Phase 2. SMS automation is excluded from the approved design.
