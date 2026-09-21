// boot.js — app ko jaldi kholta hai.
// Apni chhoti files foran chalti hain; Firebase SDK (bara, ~300 KB) saath saath peeche load hota hai.
// Service worker dusri dafa se in sab ko phone se deta hai (internet ka intezar nahi).
import { startApp } from './app.js';
import { firebaseConfig } from './firebase-config.js';

const V = '12.18.0', base = `https://www.gstatic.com/firebasejs/${V}/`;
const sdkPromise = Promise.all([
  import(base + 'firebase-app.js'),
  import(base + 'firebase-auth.js'),
  import(base + 'firebase-firestore.js')
]).then(([app, auth, firestore]) => ({ ...app, ...auth, ...firestore }));

startApp({ firebaseConfig, sdkPromise });
