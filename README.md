# Workflow

Workflow is a personal organiser for events, tasks and reminders. It works in a web browser and can be installed on a phone. Your information is saved in that browser on that device.

## What works today

- Today dashboard, month calendar, agenda and week planner.
- Colour-coded areas and sections, events, task checklists and Biv planning prompts.
- Delegated tasks, task templates, recurring tasks, subtasks and search filters.
- Light and dark themes, local JSON backup and restore, and `.ics` calendar export.
- An installable PWA with an offline app shell.

The app has no account or server. It starts with generic sample content that you can remove in **Settings → Clear sample data**.

> **Publishing note:** GitHub Pages is a public website, including when the repository itself is private. Do not put real names, plans, contact details, credentials or private sample data in source files. Runtime data is stored in your browser unless you later choose to sync it to Google.

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

The next approved stage is the hosted notification service (Cloudflare Worker, D1, scheduled Cron Trigger, and Resend for email). It is not included here. Do not add provider keys to this frontend or GitHub Pages settings. A later backend stage needs separate deployment and secret setup instructions; SMS automation is excluded from the approved design.
