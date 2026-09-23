// push.js — v212: Firebase ka asal notification (app band ho tab bhi, NT Hazri ke apne icon ke sath).
// Token phone par banta hai aur Firestore (staffConfig ke sath wali pushTokens) mein rakha jata hai;
// bhejne ka kaam Cloud Functions karti hain (functions/index.js).
const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging.js';
let mod = null;
const load = async () => (mod ||= await import(SDK));

export async function pushSupported() {
  try { const m = await load(); return (await m.isSupported()) && 'Notification' in window && 'serviceWorker' in navigator; } catch { return false; }
}
export const pushPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

/** Is phone par notification chalu karein. vapidKey = Firebase > Cloud Messaging > "Web Push certificates" ki key. */
export async function enablePush({ app, vapidKey, onToken, onMessage }) {
  if (!vapidKey) throw new Error('Pehle Firebase se "Web Push key" (VAPID) le kar Settings mein daalein.');
  if (!(await pushSupported())) throw new Error('Is phone/browser mein notification ki sahulat nahi. Chrome mein app ko home screen par install kar ke dobara koshish karein.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification ki ijazat nahi mili. Chrome > site settings > Notifications mein "Allow" karein.');
  const reg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
  const m = await load(), messaging = m.getMessaging(app);
  const token = await m.getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error('Token nahi mila. Internet check kar ke dobara koshish karein.');
  m.onMessage(messaging, payload => { const d = payload?.data || {}; onMessage?.(d); });
  await onToken?.(token);
  return token;
}
export async function currentToken({ app, vapidKey }) {
  try {
    if (!vapidKey || pushPermission() !== 'granted') return '';
    const reg = await navigator.serviceWorker.getRegistration('./firebase-messaging-sw.js');
    const m = await load();
    return await m.getToken(m.getMessaging(app), { vapidKey, ...(reg ? { serviceWorkerRegistration: reg } : {}) }) || '';
  } catch { return ''; }
}

/** Is phone par band karein (token khatam). */
export async function disablePush({ app }) {
  const m = await load();
  try { await m.deleteToken(m.getMessaging(app)); return true; } catch { return false; }
}
