# How to use Workflow

Workflow is a personal organiser that can also share selected task information with a workspace. This guide covers the screens, everyday tasks, reminders, backups, and sharing the app with other people.

## Open Workflow

Open the app at <https://jakedekock28-crypto.github.io/Workflow-app/>. You can use it in a browser, or install it on a phone from the browser's **Add to Home Screen** or **Install app** option.

The app may start with example information. Before entering your own information, open **Settings → Clear sample data**. Do not use **Clear all data** unless you intend to remove this browser's saved Workflow information.

## The four main screens

Use the bottom navigation to move between **Today**, **Calendar**, **Areas**, and **Delegated**. Use **Add** to create something new.

### Today

Today is the quick overview. It shows overdue tasks, tasks due today, tasks due in the next seven days, and upcoming events. The **+** or **Add task** button is a quick way to add a task. Use search and the filters to find tasks by area, status, priority, or person.

You can enable browser alerts from **Settings → Notifications** or the Today screen if the option appears. These alerts are best-effort: the app needs to stay open, browser support and permission are required, and they are not a dependable alarm service.

### Calendar

Use the **Month**, **Week planner**, and **Agenda** controls to view events and unfinished tasks by date. To add an event, choose **Add → Event**. Events can have a date, area, location, and notes. **Export calendar** downloads an `.ics` file that can be imported into another calendar app.

Open an event to see its checklist, add tasks, duplicate it, or apply a saved checklist template. Some areas named **Cadets** show a **Biv planner** with prompts. Do not enter sensitive or operational details there; only use it for information that is safe to store.

### Areas

Areas are colour-coded folders such as Work, Study, or Personal. Open an area to see its sections, events, and tasks. Settings lets you add, rename, and delete areas and sections. Deleting an area can also delete its associated events and tasks, so read the confirmation carefully.

### Delegated

Use this screen for tasks assigned to other people. You can:

1. Choose **Add person** to save a person's name, email, and optional role. Do not enter ranks, ID numbers, or personal notes.
2. Choose **New group** to save a group of people. Use **Manage people** to edit a contact, deactivate or reactivate it, change group membership, or delete it.
3. Add a delegated task. Select one or more people or groups, then provide a clear title, description, requirements (one per line), due date/time, and priority.
4. Use **Preview email** to check the message. **Send reminder** opens a prefilled draft in your email app; review it and send it there. Workflow does not send the email. Choose **I sent it** only after you actually send it. Workflow cannot verify delivery.

The **Email template** control lets you edit the subject and body. You can use `{PersonName}`, `{TaskTitle}`, `{TaskDescription}`, `{Requirements}`, `{DueDate}`, `{Priority}`, and `{AssignedBy}`. Reminder history is kept locally for 90 days by default; choose **Reminder log retention** to change that to 30–365 days.

There are no SMS messages or automatic reminder emails. The reminder timing choices describe when you want to be reminded in Workflow; they do not schedule or send messages from a server.

## Add and update tasks

Choose **Add → Task** for something you are doing yourself, or **Add → Delegate** for an assigned task. A task can have a due date, area, priority, link to an event, and checklist/subtasks. Regular tasks can repeat daily, weekly, fortnightly, monthly, or at a custom number of days. Use the task's status selector to mark it **To do**, **In progress**, or **Done**. Checklist items can be checked off individually.

## Sign in and use a workspace

Google sign-in is optional for local use. In **Settings → Workspaces**, choose **Sign in with Google** to create or join cloud workspaces. Sign-in uses basic Google identity. Workflow stores your account email and Google account identifier; it does not ask for Gmail, Calendar, or Drive access.

Your information is separate until you join a workspace. If the app offers to copy this browser's tasks and contacts into a new, empty workspace, review the information first. You can decline. Back up anything important before importing.

### Invite another person to your workspace

Sending someone the app address only lets them open Workflow. It does not give them access to your workspace. To share selected workspace data:

1. In **Settings → Workspaces**, enter their email under **Invitee email address** and select a role.
2. Choose **Create invite link**. Workflow copies a link; it does not send an email.
3. Send the link to that person privately. It is single-use and expires after seven days.
4. They open the link, sign in with the **same Google account/email address you invited**, and accept it. If they open Workflow without an invite, they can use local mode or sign in to create/use their own workspace.

Google's Audience settings for this app previously displayed a notice that sign-in was restricted to test users. To avoid invitees being blocked, add their Google email under **Google Auth Platform → Audience → Test users** if the console requires it. Google says identity-only Sign in with Google can be exempt from the normal Testing test-user restriction, but follow the message shown for this specific project. Google's Testing status is limited to 100 test users. [Google's Audience and testing guidance](https://support.google.com/cloud/answer/15549945?hl=en).

The invitee uses their own Google account and can have their own personal workspace as well as the workspace you invited them to. They do not automatically get a copy of your local browser data. An invited person sees and can change workspace information according to their role:

| Role | What they can do |
| --- | --- |
| Owner | Manage the whole workspace, members, settings, tasks, export, and deletion. |
| Admin | Manage workspace data, members, settings, and all tasks; cannot delete the workspace or transfer its ownership. |
| Delegator | Create tasks and see tasks they created or are assigned to; cannot manage members or contacts. |
| Member | See tasks assigned to them and update their progress. |

By default, members do not see every workspace task. An Owner can turn on **Members may view all workspace tasks**. When someone accepts an invite, Workflow links them to a saved person with the same email address, if one exists. Use the same email on the contact record if you want task assignments to that person to appear in their account.

## What syncs and what stays on this device

Cloud workspaces sync **tasks, contact names/emails, groups, and task templates**. Area names, sections, events, calendar notes and locations remain in the browser on this device. A cloud task may have an area association, but the area's name is not shared. Local browser data does not automatically move to another device or another person's account.

Use **Settings → Back up now** for a private JSON copy of browser data. In a cloud workspace, the Owner can use **Export workspace data** to download workspace records. Keep both exports somewhere private; exports can contain personal information. A backup is not automatically updated when you change data.

## Privacy and reminders

Do not enter information about children or minors, sensitive personal or health information, passwords, identity/service numbers, security details, or sensitive/operational information. Use minimal task details and invite only people who need access. The app has no automatic email/SMS delivery, advertising, or third-party analytics.

Read the in-app **Privacy notice** and **Terms** links. They are templates for Australian users, not legal advice. Cloud services can process or store data outside Australia; check whether that is appropriate for your use.

## Sign out, remove a person, or delete data

- **Sign out** ends this browser's current cloud session; it does not delete the account or workspace.
- An Owner/Admin can use **Remove** beside a workspace member. That removes their access; personal contact data linked to their membership and assignments are removed.
- The Owner can use **Delete workspace** to remove the workspace and its cloud records. This cannot be undone.
- **Delete account** removes your account and membership, subject to the ownership steps shown by Workflow.
- **Clear sample data** removes the example records. **Clear all data** resets the current browser's organiser data; when cloud sync is active, deletions of synced tasks, contacts, groups, and templates can also sync to the selected workspace. Neither button deletes the workspace itself. Back up first and read each confirmation carefully.

## Install on a phone

Open the HTTPS app address on your phone. On iPhone/iPad, use Safari's **Share → Add to Home Screen**. On Android, use Chrome's menu → **Install app** or **Add to Home screen**. The app shell can open offline after it has loaded, but Google sign-in and cloud sync need internet access.
