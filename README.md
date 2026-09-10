# Noor Traders Hisab v103

v103 fixes the live attendance summary so present staff no longer remain marked absent after Firestore finishes loading. It also makes the Salary Breakdown fit narrow mobile screens without clipping its amount column.

Based on the supplied v98 app and the working v99 login update. Read **START_HERE_URDU.md** for installation and use.

- Premium evergreen/gold owner and staff panels, compact typography, prominent work upload above attendance.
- Missing, null or malformed legacy task dates no longer crash the staff list.
- Real-time in-app owner inbox/toast with staff name and picture count; read state syncs per owner. Optional phone notifications are opt-in and require the owner page to remain running and connected. There is no WhatsApp integration or closed-app push subscription.
- Shop location updated to QXX4+5Q9, Guliana (32.7979125, 73.956984375), decoded as 8J4MQXX4+5Q9.
- Compact staff shortcuts at the top, three buttons per row on mobile, available across staff screens.
- Custom tasks assigned from an employee's profile/edit screen or the owner picture-report screen.
- Up to eight compressed pictures per task submission, camera only (gallery picker removed), preview and removal before sending.
- Staff account photos are captured with an in-app live camera (`getUserMedia`, front camera by default). The gallery/file picker cannot be opened for these fields.
- "Working Hours" is shown next to every Check-In/Check-Out pair: today attendance, staff profile time table and full history, attendance history, staff reports, complete system report, the staff PDF report and the staff member's own report. It is derived from Check-In/Check-Out on every render and is never stored, so existing attendance records display hours without any migration. Records crossing midnight are handled; missing check-out shows "جاری ہے" and impossible spans (negative, or over 16 hours) show "—".
- Salary is now part of Staff Add/Edit, every staff profile, Staff Reports, the employee's own PDF, the owner individual PDF, and the Complete System Report. Each employee has separate monthly salary, duty hours, working days, overtime rate and point rate. Final salary is calculated from clocked normal hours + overtime + attendance/task point value + owner additions - advances/deductions. Salary settings are mirrored to the employee account and preserved in online settings.
- Unsaved Add/Edit forms survive refresh, reload, accidental back and app updates. Text fields are drafted to `localStorage` and the staff profile photo to IndexedDB (`ntDraftsV101`), keyed per form, expiring after 24 hours. Drafts clear automatically on a successful save, and the restore banner offers a manual clear. Password fields are never drafted.
- Owner approval with integer points within the assigned maximum, or return for corrections.
- Staff task points and PDF accounting; owner PDF embeds all current submission pictures, with per-employee totals and date filters.
- Separate owner/staff login tabs, real Firebase owner password, UID-bound staff sessions, owner password change.

`index.html` includes all application code and styles. Hosting requires only `index.html`, `sw.js`, `version.json` plus the existing manifest/assets. Publish the included Firestore rules separately. There is no npm build requirement for deploying the supplied files. The extracted `.js`/`.css` sources are included for maintenance; after editing them run `npm run build` to regenerate the inline sections.

Task metadata lives in `businesses/noor-traders/staffTasks/{taskId}` and images in its `taskPhotos/{photoId}` subcollection. Transactions save a submission and its pictures together. The owner review transaction checks the displayed submission ID and revision. Points are summed from approved tasks, so repeated clicks cannot add duplicate points. Photos remain attached when an employee's phone number changes. Owner notification read markers are in `staffTaskNotificationReads/{ownerUid}`. Initial history does not replay phone alarms; new submission IDs alert once, and the bell retains up to 100 current submission notices. Prior submissions remain in Firestore; reports show the current submission. Existing local business JSON backups do not include these cloud task/photo collections.

Validation: 27 auth/domain/service tests and seven actual-HTML/DOM integration scenarios passed, including the full two-picture submission and approval workflow. SDKs and image decoding are synthetic in these tests. Firestore emulator rules tests are supplied but were not run in this environment. Live login, camera compression and the browser print dialog require a deployment check; no production data or credentials were changed.

Developer commands: `npm install`, `npm test`, `npm run test:dom`. For the optional rules gate, start a local Firestore emulator and run `FIRESTORE_EMULATOR_HOST=127.0.0.1:8087 npm run test:rules`. Never point these tests at a production project.

Implementation references: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) and [field access rules](https://firebase.google.com/docs/firestore/security/rules-fields).

Notification implementation references: [showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) and [permission request](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static).
