# Workflow

Workflow helps you keep events, tasks and reminders in one place. It works on a phone or computer and saves your information in the browser on that device. There is no account or server.

## 1. Open the project

1. Open **VS Code**.
2. Choose **File → Open Folder…**.
3. Select the `workflow` folder. It contains `package.json`, `src`, and `.github`.
4. In VS Code, choose **Terminal → New Terminal**. The terminal should open in the `workflow` folder.

## 2. Install what the project needs

You need Node.js and npm. If they are not installed, download the **LTS** version from [nodejs.org](https://nodejs.org/en/download/), install it, then quit and reopen VS Code.

In the VS Code terminal, check that both commands show a version number:

```sh
node -v
npm -v
```

Now install the project packages:

```sh
npm install
```

You only need to install the packages again if the project dependencies change.

## 3. Run Workflow on your computer

In the same VS Code terminal, run:

```sh
npm run dev
```

Open the `http://localhost:...` link printed in the terminal. Keep the terminal running while you use the app. To stop it, click the terminal and press **Control+C**.

The first time you open Workflow, it shows generic example events and tasks. You can remove them in **Settings → Clear sample data**.

## 4. Try it on your phone

This is for trying the app locally. Your phone and computer must be on the same Wi-Fi.

1. Stop the server with **Control+C** if it is still running.
2. In the VS Code terminal, run:

   ```sh
   npm run dev -- --host
   ```

3. Find the **Network** link printed in the terminal.
4. Type that link into your phone’s browser.

For the installed phone app, use the published HTTPS website in step 7 instead.

## 5. Put the project on GitHub

The project already has its local Git history and three commits. Create an **empty** GitHub repository for it; do not add a README, licence or `.gitignore` on GitHub because those files are already here.

1. On [GitHub](https://github.com), sign in and choose **New repository**.
2. Give it a name, such as `workflow-organiser`. Choose **Public** if you want to use GitHub Pages on a free GitHub plan.
3. Leave **Add a README**, **Add .gitignore**, and **Choose a license** turned off, then create the repository.
4. On the new repository page, copy its HTTPS address. It looks like `https://github.com/YOUR-NAME/workflow-organiser.git`.
5. Return to the VS Code terminal. Make sure it is open in the `workflow` folder, then connect and upload the project. Replace the example address with the one you copied:

   ```sh
   git remote add origin https://github.com/YOUR-NAME/workflow-organiser.git
   git push -u origin main
   ```

If GitHub asks you to sign in or authorise Git, follow its prompts.

## 6. Turn on GitHub Pages

Do this on **GitHub in your web browser**:

1. Open your repository and choose **Settings**.
2. In the left menu, choose **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the **Actions** tab. Wait for **Deploy Workflow to GitHub Pages** to finish with a green check. Click the run to see any error details.
5. Return to **Settings → Pages** and open the website link GitHub shows.

GitHub Pages uses GitHub Actions for this project, as described in the [GitHub Pages setup guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The included workflow builds the app from the repository root and sets the correct path automatically for a normal repository URL, such as `https://YOUR-NAME.github.io/workflow-organiser/`. You usually do not need to change the base path. If you use a custom domain or a repository named `YOUR-NAME.github.io`, open `.github/workflows/deploy.yml` in VS Code and change the `VITE_BASE_PATH` value to `/` before pushing.

## 7. Install it on your phone

Open the published HTTPS website from step 6:

- **iPhone:** open it in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap the menu, then **Install app** or **Add to Home screen**.

Open the installed app once while online. The app files are then available offline. Your saved plans stay in that browser on that device; they do not sync to other devices. Use **Settings → Back up now** to download a backup before changing phones or clearing browser data.

## 8. Save and publish future changes

After editing files in VS Code, run these commands in the terminal from the `workflow` folder:

```sh
npm run build
git add .
git commit -m "Describe your change"
git push
```

The build checks the project. The push sends your changes to GitHub, and GitHub Actions updates the Pages website automatically.

## Useful commands

| What you want to do | Command |
| --- | --- |
| Install packages | `npm install` |
| Run on your computer | `npm run dev` |
| Run so your phone can connect on Wi-Fi | `npm run dev -- --host` |
| Check a production build | `npm run build` |
| Preview the production build | `npm run preview` |

## Data and reminders

Workflow saves data in your browser’s local storage. Clearing the browser’s site data can erase it, so keep a backup. The Today screen and Delegated tab show your reminders when you open the app. This project has no server, so it cannot reliably send background push notifications to iPhones.

## Licence

This project is available under the MIT licence. See [LICENSE](LICENSE).
