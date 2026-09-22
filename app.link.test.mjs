// v207: WhatsApp wala login link aur home screen install.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { fakeSdk, memoryStorage, B } from './test-fake-sdk.mjs';

const win = new Window({ url: 'https://samiullah-878.github.io/nt-traders-/#login=03001234567' });
Object.assign(globalThis, { window: win, document: win.document, File: win.File, requestAnimationFrame: fn => setTimeout(fn, 0), location: win.location });
Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true });
win.confirm = () => true; globalThis.confirm = win.confirm; win.scrollTo = () => {};
win.fetch = async () => ({ ok: true, json: async () => ({ version: 'v207' }) });
win.document.body.innerHTML = '<div id="app" data-screen="boot"></div><div id="sheetHost"></div><div id="toast"></div>';
const { startApp } = await import('./app.js');
const records = new Map([
  [B + 'staffConfig/main', { shiftStart: '09:15', shiftEnd: '19:00' }],
  [B + 'staffAccounts/03001234567', { name: 'Hamayun', phone: '03001234567', role: 'Worker' }]
]);
const fake = fakeSdk({ records }), storage = memoryStorage();
const app = startApp({ sdk: fake.sdk, firebaseConfig: { projectId: 'nt-traders' }, storage, win });
const $ = s => win.document.querySelector(s);
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 4)); };
const click = async el => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); await settle(); };

test('login link: number likhe baghair staff ka safha khulta hai, link address se hat jata hai', async () => {
  await settle(20);
  assert.equal($('#app').dataset.screen, 'staff'); assert.match($('.brand').textContent, /Hamayun/);
  assert.equal(win.location.hash, '', 'number address bar mein nahi rehta');
  assert.ok([...records].some(([k, v]) => k.includes('staffSessions/') && v.phone === '03001234567'));
});
test('upar logout nahi, neeche chhota logout; install ka banner', async () => {
  assert.equal($('.top [data-action=logout]'), null); assert.ok($('.foot [data-action=logout]'));
  assert.ok($('.install-card'), 'install banner'); await click($('[data-action=install]'));
  assert.ok($('[data-sheet=install-help]'), 'kaise lagayein'); await click($('[data-sheet=install-help] [data-sheet-close]'));
  // browser ka install event aaye to asal install button
  let prompted = false; const e = new win.Event('beforeinstallprompt'); e.prompt = async () => { prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' });
  win.dispatchEvent(e); await settle(); assert.match($('.install-card').textContent, /Install karein/);
  await click($('[data-action=install]')); assert.equal(prompted, true);
  await click($('[data-action=install-later]')); assert.equal($('.install-card'), null, 'baad mein = chhup gaya');
});
test('dobara kholna: cache se seedha andar (login screen nahi)', async () => {
  assert.ok(storage.getItem('nt-hazri-session-v200'));
});
test.after(async () => { app.data?.stop(); await win.happyDOM.abort(); win.close(); });
