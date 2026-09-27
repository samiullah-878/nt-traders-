// index.js — Noor Traders Hazri ke notifications (Firebase Cloud Functions, Node 20).
// App band ho tab bhi khabar jati hai, kyun ke ye code Firebase par chalta hai — kisi phone par nahi.
// Deploy: GitHub Actions (.github/workflows/deploy-functions.yml) ya computer se: firebase deploy --only functions
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { pkDate, pkMinutes, parseTime, fmt12, scheduleFor, notArrived, checkoutPending, breaksOverdue, lateOnCheckIn, list } from './logic.js';

initializeApp();
const db = getFirestore();
const BIZ = 'businesses/noor-traders';
const col = name => db.collection(`${BIZ}/${name}`);
const region = 'asia-south1';      // Mumbai — Pakistan ke qareeb
// v214: parchi wali function hamesha jagti (minInstances 1) — khabar 2-4 second mein. Chhota size, taake kharcha kam rahe.
const FAST = { region, memory: '256MiB', minInstances: 1, concurrency: 20 };
const NORMAL = { region, memory: '256MiB' };
const TZ = 'Asia/Karachi';

const rows = async (name, q) => (await (q ? q : col(name)).get()).docs.map(d => ({ id: d.id, ...d.data() }));
let cfgCache = null, cfgAt = 0;
const config = async () => {
  if (cfgCache && Date.now() - cfgAt < 60000) return cfgCache;   // aik minute yaad — har khabar par parhna na pade
  cfgCache = (await db.doc(`${BIZ}/staffConfig/main`).get()).data() || {}; cfgAt = Date.now();
  return cfgCache;
};
const schedulesMap = async () => Object.fromEntries((await rows('staffSchedules')).map(s => [s.id, s]));
