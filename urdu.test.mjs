// v237: Urdu ki line — lughat, ginti / waqt wale jumle, aur screen par lagna (happy-dom).
import test from 'node:test'; import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { UR, PATTERNS, urduFor, decorate, undecorate, startUrdu, urduOn, setUrdu } from './urdu.js';

const plain = s => s.replace(/[⁦⁩]/g, '');
test('lughat aur patterns', () => {
  assert.equal(urduFor('Hazri'), 'حاضری'); assert.equal(urduFor('  Ghair   hazir '), 'غیر حاضر', 'khali jagah ka farq nahi');
  assert.equal(urduFor('Ali Raza'), '', 'naam ka tarjuma nahi'); assert.equal(urduFor('9:15 am'), '', 'waqt ka tarjuma nahi'); assert.equal(urduFor('حاضری'), '');
  assert.equal(urduFor('Juma, 9 Oct 2026'), 'جمعہ، 9 اکتوبر 2026'); assert.equal(urduFor('25 min baqi'), '25 منٹ باقی');
  assert.equal(urduFor('Online · 2 min pehle'), 'آن لائن · 2 منٹ پہلے'); assert.equal(urduFor('Salary Rs 1,583'), 'تنخواہ Rs 1,583');
  assert.equal(plain(urduFor('Duty 9:15 am – 7:00 pm')), 'ڈیوٹی 9:15 am – 7:00 pm'); assert.match(urduFor('Duty 9:15 am – 7:00 pm'), /⁦9:15 am – 7:00 pm⁩/, 'waqt apni tarteeb mein');
  assert.equal(urduFor('25 min'), '', '"min" mahina nahi');
  assert.ok(Object.keys(UR).length > 450 && PATTERNS.length > 60);
  for (const [k, v] of Object.entries(UR)) { assert.ok(/[؀-ۿ]/.test(v), 'Urdu nahi: ' + k); assert.ok(k.trim() === k && !/\s{2,}/.test(k), 'key saaf nahi: ' + k); }
});
test('screen par lagna: label, icon wala button, ginti wala chip, form, behta jumla, dobara nahi', () => {
  const win = new Window(), doc = win.document;
  doc.body.innerHTML = '<button class="btn" id="a"><svg></svg> Aaj ki hazri PDF</button><button class="chip" id="b"><b>2</b> Sab</button>'
    + '<label id="c">Password <small>✅ save</small><input name="pw"></label><p id="d"><b>Bina voucher paisa nikla:</b> Paisa nikla, lekin koi voucher nahi mila.</p>'
    + '<p id="e">🎬 Aaj videos: <b>1</b> bani</p><b id="f">Ali Raza</b><select id="g"><option>Hazir</option></select><span id="h" data-no-ur>Hazri</span>';
  decorate(doc.body);
  const q = id => doc.getElementById(id);
  assert.equal(q('a').querySelector('ur-p > ur-s').textContent, 'آج کی حاضری PDF'); assert.ok(q('a').querySelector('svg'), 'icon apni jagah');
  assert.equal(q('b').querySelector('ur-s').textContent, 'سب'); assert.equal(q('b').querySelector('b').textContent, '2');
  assert.deepEqual([...q('c').querySelectorAll('ur-s')].map(x => x.textContent), ['پاس ورڈ', '✅ محفوظ'], 'label: naam aur hint dono');
  assert.equal(q('d').querySelectorAll('ur-s').length, 0, 'behte jumle ke tukre nahi'); assert.equal(q('e').querySelectorAll('ur-s').length, 0);
  assert.equal(q('f').querySelectorAll('ur-s').length, 0); assert.equal(q('g').querySelectorAll('ur-s').length, 0, 'dropdown ke andar nahi'); assert.equal(q('h').querySelectorAll('ur-s').length, 0);
  const n = doc.querySelectorAll('ur-s').length; decorate(doc.body); decorate(q('d').querySelector('b'));
  assert.equal(doc.querySelectorAll('ur-s').length, n, 'dobara chalane par dugni nahi / jumle ka tukra akela aaye to bhi nahi');
  assert.equal(q('a').querySelector('ur-s').getAttribute('dir'), 'rtl');
  undecorate(doc.body); assert.equal(doc.querySelectorAll('ur-s, ur-p').length, 0); assert.equal(q('a').textContent.trim(), 'Aaj ki hazri PDF', 'band karne par asal matn');
});
test('chalu / band har phone ki apni pasand; naya matn khud', async () => {
  const win = new Window(), doc = win.document, mem = new Map(), storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  doc.body.innerHTML = '<div id="app"><b>Hazri</b></div>';
  assert.equal(urduOn(storage), true, 'na likha ho = chalu');
  let stop = startUrdu({ doc, storage, win });
  assert.ok(doc.documentElement.classList.contains('ur-on')); assert.equal(doc.querySelectorAll('ur-s').length, 1);
  doc.getElementById('app').innerHTML = '<button>Salary</button><i>Staff</i>'; await new Promise(r => setTimeout(r, 30));
  assert.deepEqual([...doc.querySelectorAll('ur-s')].map(x => x.textContent), ['تنخواہ', 'عملہ'], 'render ke baad khud lagi');
  setUrdu(storage, false); stop(); stop = startUrdu({ doc, storage, win });
  assert.equal(doc.querySelectorAll('ur-s').length, 0); assert.ok(!doc.documentElement.classList.contains('ur-on'));
  doc.getElementById('app').innerHTML = '<button>Salary</button>'; await new Promise(r => setTimeout(r, 30)); assert.equal(doc.querySelectorAll('ur-s').length, 0, 'band = band');
});
