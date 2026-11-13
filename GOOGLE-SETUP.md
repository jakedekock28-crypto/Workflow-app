# Google sign-in setup

Follow **Part 2 → What you need to do in provider dashboards → Google sign-in client** in [README.md](README.md). That is the source of truth for current Google Identity setup and the GitHub Pages domain limitation.

Only Google sign-in is implemented. Workflow requests the basic `openid`, `email`, and `profile` identity scopes. Google Calendar, Google Drive, Picker, and automatic Google backup are not implemented and must not be enabled for this app.

The public policy pages are [privacy.html](public/privacy.html) and [terms.html](public/terms.html). Replace their bracketed owner/contact/date fields and review the wording before enabling cloud workspaces. After GitHub Pages deploys, they are available at:

- `https://jakedekock28-crypto.github.io/Workflow-app/privacy.html`
- `https://jakedekock28-crypto.github.io/Workflow-app/terms.html`

Google requires production OAuth branding/domains to be verified for the top-level domain. The project uses shared `github.io`, which the repository owner does not own. Keep sign-in in a private/testing setup unless Google confirms that this free hostname is acceptable; do not buy a domain to work around the limitation.
