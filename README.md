# Workflow

Workflow is a personal, mobile-first organiser for events, tasks and the things you ask other people to do. Plans are grouped into colour-coded areas and saved locally in your browser. There are no accounts, server or paid APIs.

## Features

- A Today dashboard for due, overdue and upcoming tasks, events and a pinned countdown.
- Month, week planner and agenda views.
- Areas, sections, event checklists, delegated reminders and reusable task templates.
- Recurring tasks, subtasks, task priorities and search filters.
- A focused Biv planner with prompts for location, objective, staff, equipment, timing and other key points.
- JSON backup and restore, calendar export as `.ics`, theme settings and offline PWA support.
- Generic example content on first run; remove it from Settings.

## Local setup

```sh
npm install
npm run dev
```

To open it on a real phone, keep your computer and phone on the same Wi-Fi network and run:

```sh
npm run dev -- --host
```

Open the network URL printed by Vite on your phone. Development server access is for local testing; use HTTPS when installing the production site.

Build and preview the production files:

```sh
npm run build
npm run preview
```

## GitHub Pages deployment

1. Create a public or private repository on GitHub.
2. In VS Code, open the `workflow` folder as the project folder, initialise or connect it to your Git repository, then commit and push the files to the `main` branch.
3. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
4. The included `.github/workflows/deploy.yml` builds the PWA and deploys it on each push to `main`. It sets `VITE_BASE_PATH` from the repository name for the Pages subpath.
5. To build for another host or a custom path, set `VITE_BASE_PATH` to the path including both slashes, for example `/my-repo/`. For a domain hosted at the root, use `/`.
6. Open the Pages URL shown in the workflow deployment summary. The first build may take a minute or two.

## Install on a phone

- **iPhone/iPad:** open the HTTPS Pages URL in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open the HTTPS Pages URL in Chrome and choose **Install app** or **Add to Home screen** from the browser menu.

The app shell is precached by the service worker. After the first successful visit, previously loaded app files can open offline. Changes still stay on the device and calendar/message sharing needs the relevant phone app. Clear site data only after exporting a backup.

## Data and reminders

Workflow stores data in browser local storage on this device. It does not sync between browsers or phones. Export a JSON backup regularly. In-app Today and Delegated views are the dependable reminders. Background push notifications on iPhone are not reliable for a static app without a server; browser notification permission depends on browser support and app state.

## Verification

`npm run build` runs strict TypeScript checking and creates the Vite production bundle, PWA manifest and service worker. Installation and offline behaviour should be checked on the target phone after deploying over HTTPS; this workspace has no phone/browser automation, so a real-device install was not performed here.

## License

MIT. See [LICENSE](LICENSE).
