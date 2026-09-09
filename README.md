# Noor Traders Hisab v99

Based on the supplied v98 app. Read **START_HERE_URDU.md** for installation and use.

- Compact staff shortcuts at the top, three buttons per row on mobile, available across staff screens.
- Custom tasks assigned from an employee's profile/edit screen or the owner picture-report screen.
- Up to eight compressed pictures per task submission, gallery or camera, preview and removal before sending.
- Owner approval with integer points within the assigned maximum, or return for corrections.
- Staff task points and PDF accounting; owner PDF embeds all current submission pictures, with per-employee totals and date filters.
- Separate owner/staff login tabs, real Firebase owner password, UID-bound staff sessions, owner password change.

`index.html` includes all application code and styles. Hosting requires only `index.html`, `sw.js`, `version.json` plus the existing manifest/assets. Publish the included Firestore rules separately. There is no npm build requirement for deploying the supplied files. The extracted `.js`/`.css` sources are included for maintenance; after editing them run `npm run build` to regenerate the inline sections.

Task metadata lives in `businesses/noor-traders/staffTasks/{taskId}` and images in its `taskPhotos/{photoId}` subcollection. Transactions save a submission and its pictures together. The owner review transaction checks the displayed submission ID and revision. Points are summed from approved tasks, so repeated clicks cannot add duplicate points. Photos remain attached when an employee's phone number changes. Prior submissions remain in Firestore; reports show the current submission. Existing local business JSON backups do not include these cloud task/photo collections.

Validation: 22 auth/domain/service tests and five actual-HTML/DOM integration scenarios passed, including the full two-picture submission and approval workflow. SDKs and image decoding are synthetic in these tests. Firestore emulator rules tests are supplied but were not run in this environment. Live login, camera compression and the browser print dialog require a deployment check; no production data or credentials were changed.

Developer commands: `npm install`, `npm test`, `npm run test:dom`. For the optional rules gate, start a local Firestore emulator and run `FIRESTORE_EMULATOR_HOST=127.0.0.1:8087 npm run test:rules`. Never point these tests at a production project.

Implementation references: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) and [field access rules](https://firebase.google.com/docs/firestore/security/rules-fields).
