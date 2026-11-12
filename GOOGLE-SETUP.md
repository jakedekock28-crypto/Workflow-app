# Google integrations: manual setup guide

> **Current status:** Workflow does not yet have Google sign-in, Calendar sync, Drive attachments or Drive backup code. This guide is split out so the steps you must do in your own Google and GitHub accounts are easy to find. Complete the Cloud setup only when the app integration code is ready. Creating these credentials alone does not enable Google features.

## Before you start

You will need a Google account, access to the Google Cloud Console, and your final GitHub Pages website address. The code changes for Google integration still need to be implemented and tested in this repository. The steps below configure your accounts; they do not implement that code.

## What implementation means

Google integration has two parts: code changes in this project and setup in your own Google/GitHub accounts. The code work is not present yet. The expected stages are:

| Stage | Code change in Workflow | What you do |
| --- | --- | --- |
| 1. Google connection | Add Google authorization modules and a Settings connection screen; keep tokens in memory. | Create the Cloud project, configure the consent screen and create the Web client ID. |
| 2. Calendar | Add calendar selection, event push/pull, sync status and offline queue. | Enable Calendar API, test with your account and choose calendars to sync. |
| 3. Drive | Add Picker attachments and appData backup/restore. | Enable Drive and Picker APIs, create a restricted Picker API key, and test with sample data. |
| 4. Release | Add tests, error handling and documentation; build and deploy. | Add the client ID and API key as GitHub repository variables, push the code and verify the deployment and consent prompts. |

You do not need to make Google Cloud credentials until the corresponding code is ready to use them. When the integration is implemented, its Settings screen and the build workflow should match the variable names and scopes in this guide.

## Set up your Google Cloud project

You will need a Google account, access to the Google Cloud Console, and the final GitHub Pages website address. Cloud Console labels can change; Google's [Google Workspace API setup guide](https://developers.google.com/workspace/guides/enable-apis) and [Google Identity Services setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) have the current screens.

### A. Create a Google Cloud project and enable APIs

Do this in [Google Cloud Console](https://console.cloud.google.com/):

1. Create a project, for example `Workflow Personal Organiser`, or select an existing project you control.
2. Open **APIs & Services → Library**.
3. Find and enable **Google Calendar API**.
4. Find and enable **Google Drive API**.
5. Find and enable **Google Picker API**.
6. Keep the project number somewhere you can find it. Google Picker setup may ask for it as the Picker app ID.

Enabling APIs does not give the app access to your Google account. The OAuth consent and credentials below are also required.

### B. Set up the OAuth consent screen

In Google Cloud Console, open **Google Auth Platform**. Google may show these pages as **Branding**, **Audience**, and **Data Access**:

1. On **Branding**, enter an app name such as `Workflow`, a support email you control, and the required contact details.
2. On **Audience**, choose **External** for a regular personal Google account. Choose **Internal** only if this is limited to users in your Google Workspace organisation.
3. While testing, leave the app in **Testing** and add your own Google account under **Test users**. Use that same account when testing the app.
4. On **Data Access**, declare only the scopes the implemented features actually need. The intended narrow scopes for this project are:
   - `https://www.googleapis.com/auth/calendar.events` to read and edit calendar events.
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly` to list calendar names.
   - `https://www.googleapis.com/auth/drive.file` for files you choose through the Google Picker.
   - `https://www.googleapis.com/auth/drive.appdata` for Workflow's private Drive backup folder.
5. Save the consent-screen changes.

The app code must request and explain these permissions when you choose to connect or use a Google feature. Do not add broad Drive access such as `drive` or `drive.readonly`. Google's [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth) and [Drive scopes](https://developers.google.com/drive/api/guides/api-specific-auth) explain what each permission allows. If you later share this app publicly, Google may require OAuth verification for the requested scopes; Testing mode is for your own development and test users.

### C. Create a web OAuth client ID

In Google Cloud Console, open **Google Auth Platform → Clients** (or **APIs & Services → Credentials**) and create an OAuth client with application type **Web application**.

Add these under **Authorized JavaScript origins**:

```text
http://localhost:5173
https://jakedekock28-crypto.github.io
```

The second line is the origin for the current GitHub Pages repository. If you use a different account or a custom domain, use that site's HTTPS origin instead.

An origin is only the scheme, hostname and optional port. Do **not** add the repository path `/Workflow-app/` here. Google requires the origin to match the page that opens sign-in. Add `http://localhost:5173` for local testing; if Vite prints a different port, add that port as well. You do not need an authorized redirect URI for the planned browser token flow unless the implementation later says otherwise.

Create the client and copy its **Client ID**. It ends with `.apps.googleusercontent.com`. A browser app must not contain a client secret. Google explains web client origins in its [OAuth client setup instructions](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

### D. Create a restricted API key for Google Picker

The API key is for the Picker UI, not a replacement for OAuth permission to access private calendar or Drive data.

1. In Google Cloud Console, open **APIs & Services → Credentials**.
2. Choose **Create credentials → API key** and copy the key.
3. Open the key's settings and set **Application restrictions → Websites**.
4. Add website referrers for your local app, your Pages app, and Google's Picker frame. For this repository, use:

   ```text
   http://localhost:5173/*
   http://localhost:5173
   https://jakedekock28-crypto.github.io/Workflow-app/*
   https://jakedekock28-crypto.github.io
   https://docs.google.com/*
   https://docs.google.com
   ```

   Add your custom domain if you use one. If your Vite port differs, add the actual port.
5. Set **API restrictions** and allow **Google Picker API**. Save the key.

Google's [Picker setup guide](https://developers.google.com/workspace/drive/picker/guides/web-picker) specifically calls out the `docs.google.com` referrer. Google's [API key guidance](https://cloud.google.com/docs/authentication/api-keys) explains website and API restrictions. The OAuth client ID and restricted browser API key are visible to site visitors after a web app is built; treat them as public identifiers, not passwords. Never put a client secret, access token or refresh token in this repository.

### E. Add the values to GitHub Actions

Do this on **GitHub in your web browser** after the Google integration code is available:

1. Open your repository and choose **Settings**.
2. Open **Secrets and variables → Actions → Variables**.
3. Choose **New repository variable** and add:
   - Name: `VITE_GOOGLE_CLIENT_ID`; value: the Web OAuth client ID from part C.
   - Name: `VITE_GOOGLE_API_KEY`; value: the restricted Picker key from part D.
4. Save both variables.
5. Push a change to `main` or use **Actions → Deploy Workflow to GitHub Pages → Run workflow** to create a new build.

The deploy workflow already passes these variable names into the Vite build. They are currently unused because Google integration is not implemented yet. These are public front-end values, so GitHub **Variables** are suitable; do not store any private credential in a `VITE_...` variable.

For local Google testing after that code is added, create a file named `.env.local` in the `workflow` folder:

```text
VITE_GOOGLE_CLIENT_ID=paste-your-client-id-here
VITE_GOOGLE_API_KEY=paste-your-picker-key-here
```

Save the file and restart `npm run dev`. `.env.local` is ignored by Git. Do not commit it. These settings alone will not connect Google until the app code uses them.

### F. Test Google features after they are implemented

Test in a desktop browser first, then on your phone:

1. Open **Settings → Google** and connect using an account listed as a test user.
2. Check that Calendar and Drive access are requested only when you choose those features.
3. Create or update a test event and confirm the selected Google Calendar changes as expected.
4. Choose a harmless test file with Picker, and verify that the app only sees files you selected.
5. Test cloud backup and restore with sample data before trusting it with important data.
6. Disconnect Google and confirm local events and tasks still work.
7. Turn off the network and confirm local parts of the app continue to work. Reconnect and check any pending sync status.
8. Install from the HTTPS Pages site and test there too. Google sign-in popups can be unreliable in an iOS installed PWA; if that happens, open the site in Safari to connect.

## Google-specific troubleshooting

| What you see | What to check |
| --- | --- |
| Google says `origin_mismatch` | In the OAuth Web client, make the JavaScript origin match exactly: protocol, host and port. Do not include a repository path. |
| Google sign-in says the app is not available to your account | Keep the consent screen in Testing and add the account you are signing in with to **Test users**. |
| Google Picker says the key is invalid | Check that Google Picker API is enabled, the correct Cloud project/key is used, and website restrictions include your site and `https://docs.google.com/*`. |
| Google asks for access again | Browser access tokens expire. Reconnect when asked; this static app should not save a refresh token. |
| Google sign-in does not open in the iPhone home-screen app | Open the published site in Safari and connect there. Then return to the installed app. |

## Important token limitation

Google Identity Services browser access tokens are short-lived. With the static GitHub Pages design, the app must request a new token from a user action after expiry; it cannot silently refresh tokens or run unattended background sync. Keep tokens in memory, never commit a client secret, access token or refresh token. Background sync and long-lived refresh tokens would require a backend and a different security design. See Google’s [GIS token model guide](https://developers.google.com/identity/oauth2/web/guides/use-token-model).
