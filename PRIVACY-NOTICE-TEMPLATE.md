# Workflow privacy notice template

**Draft for Australian users. This is a template, not legal advice.** Review it against the way you actually deploy the app, the terms of each provider, and the Privacy Act 1988 (Cth) before inviting people. Replace bracketed details.

**Workspace owner:** [Name or organisation]

**Contact:** [Privacy contact email]

**Effective date:** [Date]

## Information collected

When a person signs in, Workflow receives their Google account identifier and verified email address. The app uses those values to create an account, link a membership, and decide which workspace data the account may access. Workflow does not request access to Gmail, Google Drive, Calendar, or contacts.

Within a workspace, Workflow stores:

- people’s names, email addresses, and optional short role descriptions;
- workspace names, time zone, membership roles, and task visibility settings;
- task titles, descriptions, due dates and times, priorities, status, checklist items, assignments, and task templates;
- group names and links between groups and people;
- invite email addresses, invited roles, and the status and expiry of single-use invite tokens;
- audit entries containing an actor account ID, action, record type and ID, and time; and
- session token hashes and limited hashed sign-in/invite rate-limit counters.

Do not enter information about children or minors. Do not enter sensitive personal, health, service-number, security, or operational information in names, roles, task text, checklist items, or group names. Workflow has no people notes, phone numbers, SMS data, analytics, advertising, or third-party tracking.

## Where information is stored and sent

The app stores a local copy in this browser’s local storage. If cloud mode is enabled, workspace records and account data are sent to Cloudflare Workers and stored in Cloudflare D1. The database is created with an Oceania location hint where configured; a location hint is not a guarantee of Australian-only storage. Cloudflare processes Worker requests on its network.

Confirmed email-reminder history and browser-alert de-duplication keys stay in local browser storage. Reminder history is automatically removed after 90 days by default; this period can be changed from 30 to 365 days in **Delegated → Reminder log retention**. Browser alerts use generic text and do not transmit task details. The app does not send automatic emails.

Google Identity Services processes the sign-in and provides the Google account identifier and email. Task, workspace, and invite content is not sent to Google. GitHub Pages serves the public app files; GitHub states that it logs visitor IP addresses for security.

Current provider and data-location details should be checked at deployment. Cloudflare D1 supports location hints, but not an Australia-only data jurisdiction. Google’s processing locations may also be outside Australia.

## Who can see workspace information

- Owners and Admins can manage workspace membership and see all workspace tasks.
- Delegators can see tasks they created or are assigned to, and can edit tasks they created.
- Members see tasks assigned to their linked person record, unless the Owner enables the workspace setting that lets members see all tasks. Members can update status, checklist progress, and notes on assigned tasks.
- A person who has not signed in can appear as a contact, but cannot sign in or see workspace data until linked to an invited account.
- Cloudflare and Google operate the services described above under their own terms. Workspace members should not share invite links with anyone other than the named invitee.

Invite links contain a random, single-use token, not an email address or task details. Links expire after seven days. An invite is accepted only when the signed-in Google email matches the invited address.

## Retention and deletion

Audit entries are automatically deleted after 90 days by default. The workspace Owner or Admin can configure retention from 30 to 365 days. Confirmed reminder history is local and is automatically removed after 90 days by default; the period can be configured from 30 to 365 days. Rate-limit counters expire after 30 days. Completed tasks and other workspace records remain until removed by an authorised member or when the workspace is deleted.

People may request deletion by contacting the workspace Owner. An Owner or Admin can remove a member; Workflow removes that member’s linked contact record and unassigns their tasks. A person may request account deletion from **Settings → Workspaces → Delete account**. Owners must first transfer ownership or remove workspace members if required. An Owner can delete a workspace, which deletes its tasks, contacts, membership, invites, and audit entries. Owners can export workspace data before deletion.

Local browser data and files previously downloaded as JSON backups are not deleted by removing a cloud account or workspace. Delete old backup files yourself. Restoring an older backup may bring back information that has since been removed.

## Privacy Act matters to check

The workspace Owner should decide whether the Privacy Act and Australian Privacy Principles apply to them, including any small-business exemption or exception. If they are an APP entity, they should review collection notices, access/correction handling, security, destruction, and APP 8 obligations concerning overseas recipients. Cloudflare’s Oceania location hint does not ensure all processing or storage remains in Australia. Obtain legal advice for the workspace’s circumstances.

## Changes and contact

For questions or privacy requests, contact [Privacy contact email]. Update this notice whenever providers, stored data, or workspace visibility settings change.
