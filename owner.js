// owner.js — malik ka panel: Hazri, Salary, Staff.
import {
  APP_VERSION, STATUS_LABEL, STATUS_MARK, DAY_SHORT, SHOP, esc, money, hm, fmtTime, to24, pkDate, pkMinutes, pkTime24, addDays, addMonths, weekday,
  monthDates, monthLabel, dateLabel, shortDate, weekRange, dayRows, countStatuses, monthSummary, smartSearch, salaryConfig, checkoutDue, isDate
} from './core.js';
import { icon, avatar, nameHtml, toast, busy, openSheet, refreshSheets, fileToDataUrl, deliverPdf, $, errorText } from './ui.js';
import { loadPdfLib, browserTextImages, dailyPdf, staffMonthPdf, registerPdf, salarySheetPdf } from './pdf.js';

const ORDER = { due: 0, late: 1, waiting: 2, absent: 3, present: 4, leave: 5, off: 6, na: 7 };
const FILTERS = [['all', 'Sab'], ['present', 'Hazir'], ['late', 'Late'], ['absent', 'Ghair hazir'], ['leave', 'Chutti/Off']];

export function createOwnerView({ data, controller, rerender, logout, checkUpdate }) {
  const S = data.state;
  const ui = { tab: 'hazri', view: 'day', date: pkDate(), month: pkDate().slice(0, 7), filter: 'all', salaryMonth: pkDate().slice(0, 7), staffQuery: '', showInactive: false };
  const activeStaff = () => S.staff.filter(s => s.active !== false);
  const context = () => ({ requests: S.requests, schedules: S.schedules, config: S.config, today: pkDate(), nowMin: pkMinutes(), now: Date.now() });
  const rowsFor = date => dayRows({ staff: activeStaff(), attendance: data.attendanceBetween(date, date), date, ...context() });
  const summaryFor = (account, month) => monthSummary({ account, attendance: data.attendanceBetween(month + '-01', month + '-31'), requests: S.requests, schedule: data.scheduleFor(account.phone), month, today: pkDate(), nowMin: pkMinutes() });
  const account = phone => S.staff.find(s => s.phone === phone);
  const pending = () => S.requests.filter(r => r.status === 'pending' && r.kind !== 'suggestion');
  const loadingNote = month => data.monthLoaded(month) ? '' : `<p class="loading-line">${esc(monthLabel(month))} ki hazri load ho rahi hai…</p>`;

  /* ================= HAZRI ================= */
  function attention() {
    const today = pkDate(), items = [];
    const due = data.allAttendance().filter(a => checkoutDue(a, data.scheduleFor(a.phone)) && account(a.phone));
    if (due.length) items.push({ tone: 'bad', icon: 'clock', title: `${due.length} Check-Out baqi`, text: [...new Set(due.map(a => account(a.phone)?.name))].slice(0, 3).join(', '), action: 'search-run', arg: 'checkout baqi' });
    const pend = pending();
    if (pend.length) items.push({ tone: 'late', icon: 'note', title: `${pend.length} request ka jawab dein`, text: pend.slice(0, 2).map(r => `${account(r.phone)?.name || r.phone}: ${r.kind === 'leave' ? 'chutti' : 'correction'}`).join(', '), action: 'requests' });
    const week = weekRange(today), lateCount = new Map();
    for (let d = week.from; d <= today; d = addDays(d, 1)) for (const r of rowsFor(d)) if (r.status === 'late') lateCount.set(r.account.phone, (lateCount.get(r.account.phone) || 0) + 1);
    const repeat = [...lateCount].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
    if (repeat.length) items.push({ tone: 'late', icon: 'alert', title: 'Is hafte baar baar late', text: repeat.slice(0, 3).map(([p, n]) => `${account(p)?.name} (${n} dafa)`).join(', '), action: 'search-run', arg: 'late is hafte' });
    const prev = addMonths(today.slice(0, 7), -1);
    if (+today.slice(8) <= 10 && data.monthLoaded(prev)) {
      const open = activeStaff().filter(s => data.calcFor(s, prev).daysWorked > 0 && data.payrollFor(s.phone, prev)?.state !== 'final');
      if (open.length) items.push({ tone: 'ink', icon: 'wallet', title: `${monthLabel(prev)} ki salary final nahi`, text: `${open.length} staff baqi`, action: 'salary-month', arg: prev });
    }
    if (!items.length) return '';
    return `<section class="attention" aria-label="Tawajju chahiye"><h2 class="section-label">Tawajju chahiye</h2><div class="attention-list">${items.map(i =>
      `<button type="button" class="att-card tone-${i.tone}" data-action="${i.action}" data-arg="${esc(i.arg || '')}">${icon(i.icon, 22)}<span><b>${esc(i.title)}</b><small>${esc(i.text || '')}</small></span></button>`).join('')}</div></section>`;
  }
  function strip(c, total) {
    const seg = (k, n) => n ? `<i class="seg s-${k}" style="flex:${n}" title="${STATUS_LABEL[k]}: ${n}"></i>` : '';
    return `<div class="strip" role="img" aria-label="Hazri ka khulasa">${total ? seg('present', c.present) + seg('late', c.late) + seg('waiting', c.waiting) + seg('absent', c.absent) + seg('leave', c.leave + c.off) : '<i class="seg s-na" style="flex:1"></i>'}</div>`;
  }
  function personRow(r, date) {
    const { account: s, a, status, late, due, minutes } = r;
    const times = a.checkIn ? `${fmtTime(a.checkIn)} <span class="arrow">to</span> ${a.checkOut ? fmtTime(a.checkOut) : (due ? '<b class="txt-bad">Check-Out baqi</b>' : 'kaam par')}` : (status === 'waiting' ? `Duty ${fmtTime(r.schedule.shiftStart)} se` : '');
    const stamp = status === 'late' ? `Late ${late}m` : STATUS_LABEL[status];
    return `<li class="row s-${status}${due ? ' is-due' : ''}">
      <button type="button" class="row-main" data-action="profile" data-phone="${s.phone}" data-date="${date}">
        ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(s.role || 'Staff')}${times ? ' &nbsp;|&nbsp; ' + times : ''}${minutes != null ? ' &nbsp;|&nbsp; ' + hm(minutes) : ''}</small></span>
        <span class="stamp st-${status}">${esc(stamp)}</span>
      </button>
      <button type="button" class="row-pdf" data-action="pdf-staff" data-phone="${s.phone}" data-month="${date.slice(0, 7)}" aria-label="${esc(s.name)} ki PDF">${icon('pdf', 18)}<span>PDF</span></button>
    </li>`;
  }
  function dayView() {
    const date = ui.date, today = pkDate(), month = date.slice(0, 7);
    const rows = rowsFor(date), c = countStatuses(rows);
    const match = r => ui.filter === 'all' || r.status === ui.filter || (ui.filter === 'leave' && r.status === 'off') || (ui.filter === 'absent' && r.status === 'waiting');
    const shown = rows.filter(match).sort((a, b) => (ORDER[a.due ? 'due' : a.status] - ORDER[b.due ? 'due' : b.status]) || (a.a.checkIn || '').localeCompare(b.a.checkIn || '') || String(a.account.name).localeCompare(String(b.account.name)));
    const counts = { all: rows.length, present: c.present, late: c.late, absent: c.absent + c.waiting, leave: c.leave + c.off };
    return `${date === today ? attention() : ''}
      <section class="panel">
        ${strip(c, rows.length)}
        <div class="chips" role="tablist" aria-label="Filter">${FILTERS.map(([k, label]) => `<button type="button" role="tab" class="chip c-${k}" aria-selected="${ui.filter === k}" data-action="filter" data-arg="${k}"><b>${counts[k]}</b> ${label}</button>`).join('')}</div>
        ${loadingNote(month)}
        ${S.loaded.has('staff') && !rows.length ? `<div class="empty"><p>Abhi koi staff nahi. Pehle "Staff" tab mein larke shamil karein.</p><button type="button" class="btn btn-primary" data-action="tab" data-arg="staff">Staff shamil karein</button></div>` : ''}
        <ol class="register">${shown.map(r => personRow(r, date)).join('')}</ol>
        ${rows.length && !shown.length ? '<p class="empty-line">Is filter mein koi nahi.</p>' : ''}
      </section>`;
  }
  function monthView() {
    const month = ui.month, dates = monthDates(month), today = pkDate();
    const grid = activeStaff().map(s => ({ account: s, summary: summaryFor(s, month) }));
    return `<section class="panel">
      ${loadingNote(month)}
      <p class="legend"><span class="mk st-present">P</span> Hazir <span class="mk st-late">L</span> Late <span class="mk st-absent">A</span> Ghair hazir <span class="mk st-leave">C</span> Chutti <span class="mk st-off">O</span> Off &nbsp;—&nbsp; khane par dabayein to hazri durust hoti hai</p>
      <div class="grid-scroll"><table class="grid"><thead><tr><th class="g-name">Naam</th>${dates.map(d => `<th class="${weekday(d) === 5 ? 'is-fri' : ''}${d === today ? ' is-today' : ''}"><small>${DAY_SHORT[weekday(d)].slice(0, 2)}</small>${+d.slice(8)}</th>`).join('')}<th>P</th><th>L</th><th>A</th></tr></thead>
      <tbody>${grid.map(g => `<tr><th class="g-name"><button type="button" data-action="profile" data-phone="${g.account.phone}" data-date="${month}-01">${nameHtml(g.account.name)}</button></th>${g.summary.days.map(d =>
        `<td class="st-${d.status}${d.date === today ? ' is-today' : ''}">${d.status === 'na' ? '' : `<button type="button" data-action="edit-att" data-phone="${g.account.phone}" data-date="${d.date}" aria-label="${shortDate(d.date)} ${STATUS_LABEL[d.status]}">${STATUS_MARK[d.status]}</button>`}</td>`).join('')}
        <td class="g-sum">${g.summary.count.present + g.summary.count.late}</td><td class="g-sum st-late">${g.summary.count.late}</td><td class="g-sum st-absent">${g.summary.count.absent}</td></tr>`).join('')}</tbody></table></div>
    </section>`;
  }
  function hazriTab() {
    const day = ui.view === 'day', label = day ? dateLabel(ui.date) : monthLabel(ui.month);
    const atEnd = day ? ui.date >= pkDate() : ui.month >= pkDate().slice(0, 7);
    return `<div class="toolbar">
        <div class="switch" role="tablist"><button type="button" role="tab" aria-selected="${day}" data-action="view" data-arg="day">Din</button><button type="button" role="tab" aria-selected="${!day}" data-action="view" data-arg="month">Mahina</button></div>
        <button type="button" class="btn btn-ink" data-action="${day ? 'pdf-day' : 'pdf-register'}">${icon('pdf', 18)} ${day ? 'Aaj ki hazri PDF' : 'Register PDF'}</button>
      </div>
      <div class="datebar">
        <button type="button" class="icon-btn" data-action="step" data-arg="-1" aria-label="Pichla">${icon('left')}</button>
        <label class="date-pick"><span>${esc(label)}</span><input type="${day ? 'date' : 'month'}" value="${day ? ui.date : ui.month}" max="${day ? pkDate() : pkDate().slice(0, 7)}" data-change="pick-date" aria-label="Tareekh chunein"></label>
        <button type="button" class="icon-btn" data-action="step" data-arg="1" aria-label="Agla" ${atEnd ? 'disabled' : ''}>${icon('right')}</button>
        ${atEnd ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-action="today">Aaj</button>'}
      </div>
      ${day ? dayView() : monthView()}`;
  }

  /* ================= SALARY ================= */
  function salaryRows(month) { return activeStaff().map(s => ({ account: s, calc: data.calcFor(s, month) })); }
  function salaryTab() {
    const month = ui.salaryMonth, rows = salaryRows(month), sum = k => rows.reduce((n, r) => n + Number(r.calc[k] || 0), 0);
    return `<div class="toolbar"><h1 class="page-title">Salary</h1><button type="button" class="btn btn-ink" data-action="pdf-salary">${icon('pdf', 18)} Salary sheet PDF</button></div>
      <div class="datebar">
        <button type="button" class="icon-btn" data-action="sal-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button>
        <label class="date-pick"><span>${esc(monthLabel(month))}</span><input type="month" value="${month}" max="${pkDate().slice(0, 7)}" data-change="pick-salary-month" aria-label="Mahina chunein"></label>
        <button type="button" class="icon-btn" data-action="sal-step" data-arg="1" aria-label="Agla mahina" ${month >= pkDate().slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button>
      </div>
      <section class="totals"><div><small>Kul banti salary</small><b>${money(sum('final'))}</b></div><div><small>Ada ho chuki</small><b class="txt-ok">${money(sum('paid'))}</b></div><div><small>Baqi</small><b class="txt-bad">${money(sum('balance'))}</b></div></section>
      <section class="panel">${loadingNote(month)}
        <ol class="register">${rows.map(({ account: s, calc }) => `<li class="row"><button type="button" class="row-main" data-action="salary" data-phone="${s.phone}">
          ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${calc.daysWorked} din &nbsp;|&nbsp; ${hm(calc.normalMin + calc.otMin)}${calc.advance ? ' &nbsp;|&nbsp; Advance ' + money(calc.advance) : ''}${calc.openDays ? ` &nbsp;|&nbsp; <b class="txt-bad">${calc.openDays} Check-Out baqi</b>` : ''}</small></span>
          <span class="amount"><b>${money(calc.final)}</b><small class="${calc.balance > 0.5 ? 'txt-bad' : 'txt-ok'}">${calc.frozen ? (calc.balance > 0.5 ? 'Baqi ' + money(calc.balance) : 'Poori ada') : 'Andaza'}</small></span>
        </button></li>`).join('')}</ol>
        ${rows.length ? '' : '<p class="empty-line">Abhi koi staff nahi.</p>'}
        ${rows.some(r => !r.calc.monthlySalary) ? '<p class="hint">Jis staff ki salary Rs 0 aa rahi hai, us ka naam dabayein aur "Salary settings" mein mahana salary likhein.</p>' : ''}
      </section>`;
  }
  function salarySheet(phone) {
    return openSheet({
      id: 'salary', wide: true, title: 'Salary',
      render(sheet) {
        const s = account(phone); if (!s) return '<p class="empty-line">Staff nahi mila.</p>';
        const month = ui.salaryMonth, c = data.calcFor(s, month);
        sheet.setTitle(`${nameHtml(s.name)} <small>${esc(monthLabel(month))}</small>`);
        const line = (label, value, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${value}</td></tr>`;
        return `${loadingNote(month)}
          <div class="pill-row"><span class="stamp ${c.frozen ? 'st-present' : 'st-waiting'}">${c.frozen ? 'Final' : 'Andaza (final nahi)'}</span>${c.openDays ? `<span class="stamp st-absent">${c.openDays} Check-Out baqi</span>` : ''}</div>
          <table class="calc"><tbody>
            ${line('Mahana salary (tay shuda)', money(c.monthlySalary))}
            ${line(`Aam ghante <small>${hm(c.normalMin)} × ${money(c.hourly)}/ghanta</small>`, money(c.normalSalary))}
            ${line(`Overtime <small>${hm(c.otMin)} × ${money(c.otRate)}/ghanta</small>`, '+ ' + money(c.overtimeAmount))}
            ${c.pointsAmount ? line(`Points <small>${c.points} × ${money(c.pointRate)}</small>`, '+ ' + money(c.pointsAmount)) : ''}
            ${c.mealSalary ? line(`Khana <small>${c.mealMode === 'daily' ? c.mealDays + ' din' : 'mahana'}</small>`, '+ ' + money(c.mealSalary)) : ''}
            ${c.bonus ? line('Bonus', '+ ' + money(c.bonus)) : ''}
            ${c.advance ? line('Advance (kat gaya)', '− ' + money(c.advance), 'txt-bad') : ''}
            ${line('Kul banti salary', money(c.final), 'is-total')}
            ${line('Ada ho chuki', money(c.paid))}
            ${line('Baqi', money(c.balance), 'is-balance')}
          </tbody></table>
          ${c.mealTotal && !c.mealSalary ? `<p class="hint">Khana ${money(c.mealTotal)} alag diya jata hai (salary mein shamil nahi).</p>` : ''}
          <div class="btn-row">
            <button type="button" class="btn btn-ink" data-action="pdf-staff" data-phone="${phone}" data-month="${month}">${icon('pdf', 18)} PDF</button>
            <button type="button" class="btn ${c.frozen ? 'btn-ghost' : 'btn-primary'}" data-action="final" data-phone="${phone}">${c.frozen ? 'Dobara kholein' : 'Final karein'}</button>
            <button type="button" class="btn btn-ghost" data-action="staff-edit" data-phone="${phone}">Salary settings</button>
          </div>
          <h3 class="sub">Advance / bonus</h3>
          <ul class="ledger">${(c.extras || []).map(x => `<li><span><b>${x.kind === 'advance' ? 'Advance' : 'Bonus'}</b> <small>${esc(shortDate(x.date))}${x.note ? ' · ' + esc(x.note) : ''}</small></span><span>${money(x.amount)}${c.frozen ? '' : ` <button type="button" class="link-bad" data-action="extra-del" data-phone="${phone}" data-id="${esc(x.id)}">Hatayein</button>`}</span></li>`).join('') || '<li class="muted">Is mahine koi entry nahi.</li>'}</ul>
          ${c.frozen ? '' : `<form class="inline-form" data-form="extra" data-phone="${phone}">
            <select name="kind" aria-label="Qisam"><option value="advance">Advance</option><option value="bonus">Bonus</option></select>
            <input name="amount" type="number" inputmode="numeric" min="1" placeholder="Raqam" required aria-label="Raqam">
            <input name="date" type="date" value="${pkDate()}" max="${pkDate()}" aria-label="Tareekh">
            <input name="note" placeholder="Note (ikhtiyari)" maxlength="120" aria-label="Note">
            <button class="btn btn-primary">Likh dein</button></form>`}
          <h3 class="sub">Salary ki adaigi</h3>
          <ul class="ledger">${(c.payments || []).map(x => `<li><span><b>Salary di</b> <small>${esc(shortDate(x.date))}${x.note ? ' · ' + esc(x.note) : ''}</small></span><span>${money(x.amount)}</span></li>`).join('') || '<li class="muted">Abhi koi payment nahi.</li>'}</ul>
          ${c.frozen ? (c.balance > 0.5 ? `<form class="inline-form" data-form="payment" data-phone="${phone}">
            <input name="amount" type="number" inputmode="numeric" min="1" max="${Math.ceil(c.balance)}" value="${Math.round(c.balance)}" required aria-label="Raqam">
            <input name="date" type="date" value="${pkDate()}" max="${pkDate()}" required aria-label="Tareekh">
            <input name="note" placeholder="Note (cash / bank)" maxlength="120" aria-label="Note">
            <button class="btn btn-primary">Payment likhein</button></form>` : '<p class="hint txt-ok">Is mahine ki poori salary ada ho chuki hai.</p>')
            : '<p class="hint">Payment likhne ke liye pehle mahina "Final karein".</p>'}`;
      }
    });
  }

  /* ================= STAFF ================= */
  function staffTab() {
    const q = ui.staffQuery.trim().toLowerCase();
    const list = S.staff.filter(s => (ui.showInactive || s.active !== false) && (!q || `${s.name} ${s.phone} ${s.role || ''}`.toLowerCase().includes(q)));
    const inactive = S.staff.filter(s => s.active === false).length, pend = pending().length;
    return `<div class="toolbar"><h1 class="page-title">Staff <small>${activeStaff().length}</small></h1><button type="button" class="btn btn-primary" data-action="staff-new">${icon('plus', 18)} Naya staff</button></div>
      <div class="search-inline">${icon('search', 18)}<input type="search" placeholder="Naam ya number" value="${esc(ui.staffQuery)}" data-input="staff-query" aria-label="Staff talash"></div>
      <section class="panel"><ol class="register">${list.map(s => `<li class="row${s.active === false ? ' is-off' : ''}" data-search="${esc(`${s.name} ${s.phone} ${s.role || ''}`.toLowerCase())}"><button type="button" class="row-main" data-action="staff-edit" data-phone="${s.phone}">
        ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(s.role || 'Staff')} &nbsp;|&nbsp; ${esc(s.phone)} &nbsp;|&nbsp; ${fmtTime(data.scheduleFor(s.phone).shiftStart)}</small></span>
        <span class="stamp ${s.active === false ? 'st-off' : s.loginEnabled === false ? 'st-absent' : 'st-present'}">${s.active === false ? 'Band' : s.loginEnabled === false ? 'Login band' : 'Chalu'}</span></button></li>`).join('')}</ol>
        <p class="empty-line" id="staffEmpty" ${list.length ? 'hidden' : ''}>Koi staff nahi mila.</p>
        ${inactive ? `<button type="button" class="link" data-action="toggle-inactive">${ui.showInactive ? 'Band kiye hue chhupayein' : `Band kiye hue bhi dikhayein (${inactive})`}</button>` : ''}
      </section>
      <section class="panel tools">
        <button type="button" class="tool" data-action="requests">${icon('note')}<span><b>Chutti / correction ki requests</b><small>${pend ? pend + ' ka jawab baqi' : 'Koi nayi request nahi'}</small></span>${pend ? `<em class="badge">${pend}</em>` : ''}</button>
        <button type="button" class="tool" data-action="settings">${icon('clock')}<span><b>Duty ka waqt aur dukaan ki had</b><small>${fmtTime(S.config.shiftStart)} se ${S.config.shiftEnd ? fmtTime(S.config.shiftEnd) : '—'} &nbsp;|&nbsp; ${Number(S.config.radius || SHOP.radius)}m</small></span></button>
        <button type="button" class="tool" data-action="password">${icon('edit')}<span><b>Malik ka password badlein</b></span></button>
        <button type="button" class="tool" data-action="update">${icon('down')}<span><b>App update check karein</b><small>Abhi ${APP_VERSION}</small></span></button>
        <button type="button" class="tool tone-bad" data-action="logout">${icon('out')}<span><b>Logout</b></span></button>
      </section>`;
  }
  function staffForm(phone) {
    const s = phone ? account(phone) : null, cfg = salaryConfig(s || {}), own = phone ? S.schedules.get(phone) : null, sch = data.scheduleFor(phone || '');
    let photo = s?.photo || '';
    const sheet = openSheet({
      id: 'staff-form', wide: true, title: s ? 'Staff ki maloomat' : 'Naya staff',
      render: () => `<form class="form" data-form="staff" data-phone="${esc(phone || '')}" novalidate>
        <div class="photo-pick"><span id="photoPreview">${avatar({ name: s?.name || '?', photo }, 'lg')}</span><label class="btn btn-ghost btn-sm">Tasveer chunein<input type="file" accept="image/*" hidden data-change="staff-photo"></label></div>
        <label>Naam<input name="name" value="${esc(s?.name || '')}" required autocomplete="off"></label>
        <label>Mobile number ${s ? '<small>(badal nahi sakta — hazri isi par hai)</small>' : '<small>(yehi staff ka login hai)</small>'}<input name="phone" type="tel" inputmode="numeric" value="${esc(s?.phone || '')}" placeholder="03001234567" ${s ? 'readonly' : 'required'}></label>
        <div class="two"><label>Kaam<input name="role" value="${esc(s?.role || '')}" placeholder="Salesman / Helper"></label><label>Kaam shuru kiya<input name="joinDate" type="date" value="${esc(s?.joinDate || (s ? '' : pkDate()))}" max="${pkDate()}"></label></div>
        <label>Pata<input name="address" value="${esc(s?.address || '')}"></label>
        <fieldset><legend>Duty ka waqt</legend>
          <label class="check"><input type="checkbox" name="useDefaultShift" ${!own || own.useDefaultShift ? 'checked' : ''} data-change="shift-mode"> Sab wala aam waqt (${fmtTime(S.config.shiftStart)} se ${S.config.shiftEnd ? fmtTime(S.config.shiftEnd) : '—'})</label>
          <div class="two" id="ownShift" ${!own || own.useDefaultShift ? 'hidden' : ''}><label>Shuru<input name="shiftStart" type="time" value="${esc(to24(sch.shiftStart) || '09:00')}"></label><label>Khatam<input name="shiftEnd" type="time" value="${esc(to24(sch.shiftEnd))}"></label></div>
          <div class="two"><label>Late ki riayat (minute)<input name="grace" type="number" inputmode="numeric" min="0" max="120" value="${Number(sch.grace ?? 10)}"></label>
          <label>Hafta-war chutti<select name="weeklyOff"><option value="">Koi nahi</option>${['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'].map((d, i) => `<option value="${i}" ${(own?.weeklyOff || []).map(Number).includes(i) ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>
        </fieldset>
        <fieldset><legend>Salary</legend>
          <label>Mahana salary (Rs)<input name="monthlySalary" type="number" inputmode="numeric" min="0" value="${cfg.monthlySalary || ''}" placeholder="30000"></label>
          <div class="two"><label>Roz ke ghante<input name="dutyHours" type="number" inputmode="decimal" min="1" max="16" step="0.5" value="${cfg.dutyHours}"></label><label>Mahine ke din<input name="workingDays" type="number" inputmode="numeric" min="1" max="31" value="${cfg.workingDays}"></label></div>
          <label>Overtime rate (Rs/ghanta) <small>khali = aam ghante wala rate</small><input name="overtimeRate" type="number" inputmode="numeric" min="0" value="${cfg.overtimeRate || ''}"></label>
          <div class="two"><label>Khane ke paise<select name="mealMode"><option value="none" ${cfg.mealMode === 'none' ? 'selected' : ''}>Nahi</option><option value="daily" ${cfg.mealMode === 'daily' ? 'selected' : ''}>Rozana</option><option value="monthly" ${cfg.mealMode === 'monthly' ? 'selected' : ''}>Mahana</option></select></label><label>Raqam (Rs)<input name="mealRate" type="number" inputmode="numeric" min="0" value="${cfg.mealRate || ''}"></label></div>
          <label class="check"><input type="checkbox" name="mealInSalary" ${cfg.mealInSalary ? 'checked' : ''}> Khane ke paise salary mein jorein</label>
          <details><summary>Points ka rate (agar dete hain)</summary><label>1 point = Rs<input name="pointRate" type="number" inputmode="decimal" min="0" step="0.5" value="${cfg.pointRate || ''}"></label><p class="hint">Waqt par aane ke points hazri ke sath khud bante hain. Rate 0 ho to salary par asar nahi.</p></details>
        </fieldset>
        <fieldset><legend>Ijazat</legend>
          <label class="check"><input type="checkbox" name="loginEnabled" ${s?.loginEnabled === false ? '' : 'checked'}> Staff apne number se login kar sakta hai</label>
          <label class="check"><input type="checkbox" name="active" ${s?.active === false ? '' : 'checked'}> Kaam par hai (hata dein to list se chhup jata hai, hazri mehfooz rehti hai)</label>
        </fieldset>
        <div class="btn-row sticky"><button class="btn btn-primary btn-lg">${s ? 'Save karein' : 'Staff shamil karein'}</button>${s ? `<button type="button" class="btn btn-ghost" data-action="staff-delete" data-phone="${phone}">Delete</button>` : ''}</div>
      </form>`
    });
    sheet.getPhoto = () => photo; sheet.setPhoto = v => { photo = v; $('#photoPreview', sheet.el).innerHTML = avatar({ name: '?', photo }, 'lg'); };
    return sheet;
  }

  /* ================= SHEETS: profile, hazri edit, chutti, requests, settings ================= */
  function profileSheet(phone, date) {
    let month = (date || pkDate()).slice(0, 7);
    data.watchMonth(month);
    const sheet = openSheet({
      id: 'profile', wide: true, title: 'Staff',
      render(sh) {
        const s = account(phone); if (!s) return '<p class="empty-line">Staff nahi mila.</p>';
        const sum = summaryFor(s, month), sch = data.scheduleFor(phone), calc = data.calcFor(s, month), today = pkDate();
        sh.setTitle(nameHtml(s.name));
        const leaves = S.requests.filter(r => r.phone === phone && r.kind === 'leave' && r.status === 'approved' && r.to >= month + '-01' && r.date <= month + '-31');
        return `<div class="profile-head">${avatar(s, 'lg')}<div><p class="muted">${esc(s.role || 'Staff')} &nbsp;|&nbsp; Duty ${fmtTime(sch.shiftStart)}${sch.shiftEnd ? ' – ' + fmtTime(sch.shiftEnd) : ''}</p><a class="link" href="tel:${esc(s.phone)}">${icon('phone', 16)} ${esc(s.phone)}</a></div></div>
          <div class="datebar"><button type="button" class="icon-btn" data-action="profile-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button><span class="date-static">${esc(monthLabel(month))}</span><button type="button" class="icon-btn" data-action="profile-step" data-arg="1" aria-label="Agla mahina" ${month >= today.slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button></div>
          ${loadingNote(month)}
          <div class="counts"><div class="st-present"><b>${sum.count.present + sum.count.late}</b><small>Hazir</small></div><div class="st-late"><b>${sum.count.late}</b><small>Late</small></div><div class="st-absent"><b>${sum.count.absent}</b><small>Ghair hazir</small></div><div class="st-leave"><b>${sum.count.leave + sum.count.off}</b><small>Chutti</small></div><div><b>${hm(sum.totalMin)}</b><small>Ghante</small></div></div>
          <div class="btn-row">
            <button type="button" class="btn btn-ink" data-action="pdf-staff" data-phone="${phone}" data-month="${month}">${icon('pdf', 18)} PDF</button>
            <button type="button" class="btn btn-ghost" data-action="edit-att" data-phone="${phone}" data-date="${month === today.slice(0, 7) ? today : month + '-01'}">Hazri lagayein</button>
            <button type="button" class="btn btn-ghost" data-action="leave" data-phone="${phone}">Chutti dein</button>
            <button type="button" class="btn btn-ghost" data-action="salary" data-phone="${phone}" data-month="${month}">Salary ${money(calc.final)}</button>
          </div>
          ${leaves.length ? `<ul class="ledger">${leaves.map(r => `<li><span><b>Chutti</b> <small>${esc(shortDate(r.date))}${r.to !== r.date ? ' – ' + esc(shortDate(r.to)) : ''} · ${esc(r.reason || '')}</small></span><button type="button" class="link-bad" data-action="leave-cancel" data-id="${esc(r.id)}">Cancel</button></li>`).join('')}</ul>` : ''}
          <ol class="days">${sum.days.filter(d => d.status !== 'na').reverse().map(d => `<li class="s-${d.status}"><button type="button" data-action="edit-att" data-phone="${phone}" data-date="${d.date}">
            <span class="d-date"><b>${+d.date.slice(8)}</b><small>${DAY_SHORT[weekday(d.date)]}</small></span>
            <span class="d-time">${d.a.checkIn ? `${fmtTime(d.a.checkIn)} <span class="arrow">to</span> ${d.a.checkOut ? fmtTime(d.a.checkOut) : '<b class="txt-bad">baqi</b>'}` : '<span class="muted">—</span>'}${d.minutes != null ? `<small>${hm(d.minutes)}</small>` : ''}</span>
            <span class="stamp st-${d.status}">${d.status === 'late' ? 'Late ' + d.late + 'm' : STATUS_LABEL[d.status]}</span></button></li>`).join('')}</ol>`;
      }
    });
    sheet.step = n => { const next = addMonths(month, n); if (next > pkDate().slice(0, 7)) return; month = next; data.watchMonth(month); sheet.refresh(true); };
    return sheet;
  }
  function attendanceSheet(phone, date) {
    data.watchMonth(date.slice(0, 7));
    return openSheet({
      id: 'att', title: 'Hazri durust karein',
      render(sh) {
        const s = account(phone) || { name: phone }, a = data.attendanceBetween(date, date).find(x => x.phone === phone) || {};
        sh.setTitle(`${nameHtml(s.name)} <small>${esc(dateLabel(date))}</small>`);
        return `<form class="form" data-form="att" data-phone="${phone}" data-id="${esc(a.id || '')}">
          ${a.selfie ? `<div class="proof"><img src="${esc(a.selfie)}" alt="Check-In ki selfie"><p>${icon('pin', 16)} Dukaan se ${a.checkInDistance != null ? Math.round(a.checkInDistance) + 'm' : '—'}<br><small>Selfie Check-In ke waqt li gayi</small></p></div>` : ''}
          <label>Tareekh<input name="date" type="date" value="${date}" max="${pkDate()}" required ${a.id ? 'readonly' : ''}></label>
          <div class="two"><label>Aaya<input name="checkIn" type="time" value="${esc(to24(a.checkIn))}" required></label><label>Gaya<input name="checkOut" type="time" value="${esc(to24(a.checkOut))}"></label></div>
          <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-action="fill-time" data-arg="checkIn">Aane ka waqt = duty shuru</button><button type="button" class="btn btn-ghost btn-sm" data-action="fill-time" data-arg="checkOut">Jane ka waqt = abhi</button></div>
          <label>Note <small>(kyun badla)</small><input name="note" value="${esc(a.ownerNote || '')}" maxlength="200"></label>
          <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Save karein</button>${a.id ? `<button type="button" class="btn btn-ghost" data-action="att-delete" data-id="${esc(a.id)}">Hazri hatayein</button>` : ''}</div>
        </form>`;
      }
    });
  }
  function leaveSheet(phone) {
    return openSheet({ id: 'leave', title: 'Chutti dein', render: () => `<form class="form" data-form="leave" data-phone="${phone}">
      <div class="two"><label>Kab se<input name="date" type="date" value="${pkDate()}" required></label><label>Kab tak<input name="to" type="date" value="${pkDate()}" required></label></div>
      <label>Wajah<input name="reason" maxlength="200" placeholder="Bimari / ghar ka kaam"></label>
      <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Chutti laga dein</button></div></form>` });
  }
  function requestsSheet() {
    return openSheet({
      id: 'requests', wide: true, title: 'Requests',
      render() {
        const list = S.requests.filter(r => r.kind !== 'suggestion').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const card = r => `<li class="req"><p><b>${nameHtml(account(r.phone)?.name || r.phone)}</b> <span class="stamp ${r.status === 'pending' ? 'st-late' : r.status === 'approved' ? 'st-present' : 'st-absent'}">${r.status === 'pending' ? 'Jawab baqi' : r.status === 'approved' ? 'Manzoor' : 'Na-manzoor'}</span></p>
          <p>${r.kind === 'leave' ? `Chutti: ${esc(shortDate(r.date))}${r.to !== r.date ? ' – ' + esc(shortDate(r.to)) : ''}` : `Hazri durust: ${esc(shortDate(r.date))} &nbsp;|&nbsp; Aaya ${fmtTime(r.checkIn)} &nbsp;|&nbsp; Gaya ${fmtTime(r.checkOut)}`}</p>
          <p class="muted">${nameHtml(r.reason || '')}</p>${r.ownerNote ? `<p class="muted">Malik: ${esc(r.ownerNote)}</p>` : ''}
          ${r.status === 'pending' ? `<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-action="req" data-id="${esc(r.id)}" data-arg="approved">Manzoor</button><button type="button" class="btn btn-ghost btn-sm" data-action="req" data-id="${esc(r.id)}" data-arg="rejected">Na-manzoor</button></div>` : ''}</li>`;
        const open = list.filter(r => r.status === 'pending'), rest = list.filter(r => r.status !== 'pending').slice(0, 30);
        return `<ul class="reqs">${open.map(card).join('') || '<li class="muted">Koi nayi request nahi.</li>'}</ul>${rest.length ? `<details><summary>Purani requests (${rest.length})</summary><ul class="reqs">${rest.map(card).join('')}</ul></details>` : ''}`;
      }
    });
  }
  function settingsSheet() {
    return openSheet({ id: 'settings', title: 'Duty ka waqt aur dukaan ki had', render: () => `<form class="form" data-form="settings">
      <div class="two"><label>Duty shuru<input name="shiftStart" type="time" value="${esc(to24(S.config.shiftStart) || '09:00')}" required></label><label>Duty khatam<input name="shiftEnd" type="time" value="${esc(to24(S.config.shiftEnd))}"></label></div>
      <label>Check-In dukaan se kitni door tak (meter)<input name="radius" type="number" inputmode="numeric" min="20" max="5000" value="${Number(S.config.radius || SHOP.radius)}" required></label>
      <label>Staff ke liye hidayat <small>(un ki screen par nazar aati hai)</small><textarea name="instruction" rows="3" maxlength="500">${esc(S.config.instruction || '')}</textarea></label>
      <p class="hint">Jin staff ka apna alag waqt hai un par ye aam waqt nahi lagta.</p>
      <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Save karein</button></div></form>` });
  }
  function passwordSheet() {
    return openSheet({ id: 'password', title: 'Password badlein', render: () => `<form class="form" data-form="password">
      <label>Mojooda password<input name="current" type="password" autocomplete="current-password" required></label>
      <label>Naya password <small>(kam az kam 6 harf)</small><input name="next" type="password" autocomplete="new-password" minlength="6" required></label>
      <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Password badlein</button></div></form>` });
  }

  /* ================= SMART SEARCH ================= */
  function searchSheet(initial = '') {
    const sheet = openSheet({
      id: 'search', wide: true, title: 'Talash',
      render: () => `<div class="search-box">${icon('search')}<input id="smartInput" type="search" value="${esc(initial)}" placeholder="Naam, number ya sawal likhein…" autocomplete="off" data-input="smart" aria-label="Talash"></div>
        <div class="chips wrap">${['late is hafte', 'ghair hazir aaj', 'checkout baqi', 'salary baqi', 'advance is mahine', 'chutti is mahine', 'late pichle mahine'].map(t => `<button type="button" class="chip" data-action="search-run" data-arg="${t}">${t}</button>`).join('')}</div>
        <div id="smartResults"></div>`
    });
    sheet.refresh = () => renderResults(); // input ko dobara na banao, sirf nateeje
    const renderResults = () => {
      const input = $('#smartInput', sheet.el), box = $('#smartResults', sheet.el); if (!input || !box) return;
      const query = input.value;
      if (!query.trim()) { box.innerHTML = '<p class="hint">Misal: "ali", "0300", "late is hafte", "ghair hazir kal", "15 sep", "salary baqi".</p>'; return; }
      let res = smartSearch({ query, staff: activeStaff(), attendance: data.allAttendance(), payroll: S.payroll, ...context() });
      const p = res.parsed, months = new Set();
      if (p.from) for (let m = p.from.slice(0, 7); m <= p.to.slice(0, 7) && months.size < 4; m = addMonths(m, 1)) months.add(m);
      const waiting = [...months].filter(m => !data.monthLoaded(m)); waiting.forEach(m => data.watchMonth(m));
      const head = `<p class="result-head"><b>${res.mode === 'people' ? res.people.length + ' staff' : res.mode === 'money' ? res.money.length + ' staff' : res.rows.length + ' record'}</b> ${esc(res.summary)}</p>${waiting.length ? '<p class="loading-line">Purana mahina load ho raha hai…</p>' : ''}`;
      let body = '';
      if (res.mode === 'people') body = res.people.map(s => `<li class="row"><button type="button" class="row-main" data-action="profile" data-phone="${s.phone}">${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(s.role || 'Staff')} &nbsp;|&nbsp; ${esc(s.phone)}</small></span></button><button type="button" class="row-pdf" data-action="pdf-staff" data-phone="${s.phone}" data-month="${pkDate().slice(0, 7)}">${icon('pdf', 18)}<span>PDF</span></button></li>`).join('');
      else if (res.mode === 'money') body = res.money.map(({ account: s, calc }) => `<li class="row"><button type="button" class="row-main" data-action="salary" data-phone="${s.phone}" data-month="${calc.month}">${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(monthLabel(calc.month))}${calc.advance ? ' &nbsp;|&nbsp; Advance ' + money(calc.advance) : ''}</small></span><span class="amount"><b>${money(calc.balance)}</b><small>baqi</small></span></button></li>`).join('');
      else body = res.rows.map(r => `<li class="row s-${r.status}"><button type="button" class="row-main" data-action="${r.due ? 'edit-att' : 'profile'}" data-phone="${r.account.phone}" data-date="${r.date}">${avatar(r.account)}<span class="row-text"><b>${nameHtml(r.account.name)}</b><small>${esc(shortDate(r.date))}${r.a.checkIn ? ' &nbsp;|&nbsp; ' + fmtTime(r.a.checkIn) + ' to ' + (r.a.checkOut ? fmtTime(r.a.checkOut) : 'baqi') : ''}</small></span><span class="stamp st-${r.due ? 'absent' : r.status}">${r.due ? 'Check-Out baqi' : r.status === 'late' ? 'Late ' + r.late + 'm' : STATUS_LABEL[r.status]}</span></button></li>`).join('');
      box.innerHTML = head + (body ? `<ol class="register">${body}</ol>` : '<p class="empty-line">Kuch nahi mila. Alfaaz badal kar dekhein.</p>');
    };
    sheet.run = text => { const input = $('#smartInput', sheet.el); input.value = text; renderResults(); };
    renderResults();
    setTimeout(() => $('#smartInput', sheet.el)?.focus(), 60);
    return sheet;
  }

  /* ================= PDF ================= */
  async function makePdf(button, build) {
    await busy(button, async () => {
      const lib = await loadPdfLib();
      deliverPdf(await build(lib, browserTextImages));
    });
  }
  const needMonth = month => { data.watchMonth(month); if (!data.monthLoaded(month)) throw new Error(`${monthLabel(month)} ki hazri abhi load ho rahi hai. 2-3 second baad dobara dabayein.`); };

  /* ================= actions ================= */
  let sheets = {};
  const open = (key, make) => { sheets[key]?.close(); sheets[key] = make(); return sheets[key]; };
  const actions = {
    tab(el) { ui.tab = el.dataset.arg; if (ui.tab === 'salary') data.watchMonth(ui.salaryMonth); rerender(); window.scrollTo?.(0, 0); },
    view(el) { ui.view = el.dataset.arg; if (ui.view === 'month') { ui.month = ui.date.slice(0, 7); data.watchMonth(ui.month); } rerender(); },
    filter(el) { ui.filter = el.dataset.arg; rerender(); },
    step(el) {
      const n = +el.dataset.arg, today = pkDate();
      if (ui.view === 'day') { const d = addDays(ui.date, n); if (d <= today) ui.date = d; data.watchMonth(ui.date.slice(0, 7)); }
      else { const m = addMonths(ui.month, n); if (m <= today.slice(0, 7)) ui.month = m; data.watchMonth(ui.month); }
      rerender();
    },
    today() { ui.date = pkDate(); ui.month = ui.date.slice(0, 7); rerender(); },
    'sal-step'(el) { const m = addMonths(ui.salaryMonth, +el.dataset.arg); if (m <= pkDate().slice(0, 7)) ui.salaryMonth = m; data.watchMonth(ui.salaryMonth); rerender(); },
    'salary-month'(el) { ui.salaryMonth = el.dataset.arg; ui.tab = 'salary'; data.watchMonth(ui.salaryMonth); rerender(); },
    search() { open('search', () => searchSheet()); },
    'search-run'(el) { const s = sheets.search?.el.isConnected ? sheets.search : open('search', () => searchSheet(el.dataset.arg)); s.run(el.dataset.arg); },
    profile(el) { open('profile', () => profileSheet(el.dataset.phone, el.dataset.date)); },
    'profile-step'(el) { sheets.profile?.step(+el.dataset.arg); },
    'edit-att'(el) { open('att', () => attendanceSheet(el.dataset.phone, el.dataset.date)); },
    'fill-time'(el) { const form = el.closest('form'), phone = form.dataset.phone; form.elements[el.dataset.arg].value = el.dataset.arg === 'checkIn' ? (to24(data.scheduleFor(phone).shiftStart) || '09:00') : pkTime24(); },
    async 'att-delete'(el) { if (!confirm('Is din ki hazri hata dein?')) return; await busy(el, async () => { await data.deleteAttendance(el.dataset.id, 'Malik ne hazri hatayi'); sheets.att?.close(); }, 'Hazri hata di'); },
    leave(el) { open('leave', () => leaveSheet(el.dataset.phone)); },
    async 'leave-cancel'(el) { if (!confirm('Ye chutti cancel karein?')) return; await busy(el, () => data.cancelLeave(el.dataset.id), 'Chutti cancel ho gayi'); },
    requests() { open('requests', requestsSheet); },
    async req(el) { await busy(el, () => data.reviewRequest(el.dataset.id, el.dataset.arg, ''), el.dataset.arg === 'approved' ? 'Manzoor ho gayi' : 'Na-manzoor kar di'); },
    settings() { open('settings', settingsSheet); },
    password() { open('password', passwordSheet); },
    update(el) { busy(el, () => checkUpdate(true)); },
    logout() { if (confirm('Logout karein?')) logout(); },
    'staff-new'() { open('staffForm', () => staffForm('')); },
    'staff-edit'(el) { open('staffForm', () => staffForm(el.dataset.phone)); },
    async 'staff-delete'(el) {
      const s = account(el.dataset.phone);
      if (!confirm(`${s?.name || ''} ko hamesha ke liye delete karein?\n\nBehtar ye hai ke "Kaam par hai" ka nishan hata dein — is tarah hazri aur salary ka record mehfooz rehta hai.`)) return;
      await busy(el, async () => { await data.deleteStaff(el.dataset.phone); sheets.staffForm?.close(); }, 'Staff delete ho gaya');
    },
    'toggle-inactive'() { ui.showInactive = !ui.showInactive; rerender(); },
    salary(el) { if (el.dataset.month) { ui.salaryMonth = el.dataset.month; data.watchMonth(ui.salaryMonth); } open('salary', () => salarySheet(el.dataset.phone)); },
    async final(el) {
      const phone = el.dataset.phone, frozen = data.payrollFor(phone, ui.salaryMonth)?.state === 'final';
      if (!confirm(frozen ? 'Ye mahina dobara kholein? Hisab phir se hazri ke mutabiq chalega.' : `${monthLabel(ui.salaryMonth)} ki salary final karein? Is ke baad hisab jam jata hai aur payment likhi ja sakti hai.`)) return;
      await busy(el, async () => { needMonth(ui.salaryMonth); await data.toggleFinal(phone, ui.salaryMonth, frozen ? 'Malik ne dobara khola' : 'Malik ne final kiya'); }, frozen ? 'Mahina dobara khul gaya' : 'Salary final ho gayi');
    },
    async 'extra-del'(el) { if (!confirm('Ye entry hata dein?')) return; await busy(el, () => data.removeExtra(el.dataset.phone, el.dataset.id), 'Entry hata di'); },
    'pdf-day'(el) { return makePdf(el, (lib, textImages) => { needMonth(ui.date.slice(0, 7)); return dailyPdf(lib, { date: ui.date, rows: rowsFor(ui.date), textImages }); }); },
    'pdf-register'(el) { return makePdf(el, (lib, textImages) => { needMonth(ui.month); return registerPdf(lib, { month: ui.month, grid: activeStaff().map(s => ({ account: s, summary: summaryFor(s, ui.month) })), textImages }); }); },
    'pdf-salary'(el) { return makePdf(el, (lib, textImages) => { needMonth(ui.salaryMonth); return salarySheetPdf(lib, { month: ui.salaryMonth, rows: salaryRows(ui.salaryMonth), textImages }); }); },
    'pdf-staff'(el) {
      const phone = el.dataset.phone, month = el.dataset.month || pkDate().slice(0, 7);
      return makePdf(el, (lib, textImages) => { needMonth(month); const s = account(phone); return staffMonthPdf(lib, { account: s, month, summary: summaryFor(s, month), calc: data.calcFor(s, month), schedule: data.scheduleFor(phone), textImages }); });
    }
  };
  const forms = {
    async staff(form, v, button) {
      await busy(button, async () => { await data.saveStaff({ ...v, photo: sheets.staffForm?.getPhoto() }, form.dataset.phone); sheets.staffForm?.close(); }, 'Staff save ho gaya');
    },
    async att(form, v, button) {
      await busy(button, async () => { await data.saveAttendance({ phone: form.dataset.phone, date: v.date, checkIn: v.checkIn, checkOut: v.checkOut, note: v.note }); sheets.att?.close(); }, 'Hazri save ho gayi');
    },
    async leave(form, v, button) { await busy(button, async () => { await data.markLeave({ phone: form.dataset.phone, ...v }); sheets.leave?.close(); }, 'Chutti lag gayi'); },
    async settings(form, v, button) { await busy(button, async () => { await data.saveConfig(v); sheets.settings?.close(); }, 'Settings save ho gayin'); },
    async password(form, v, button) {
      await busy(button, async () => {
        try { await controller.changeOwnerPassword(v.current, v.next); } catch (e) { if (/wrong-password|invalid-credential/.test(e.code || '')) throw new Error('Mojooda password ghalat hai.'); throw e; }
        sheets.password?.close();
      }, 'Password badal gaya');
    },
    async extra(form, v, button) { await busy(button, async () => { await data.addExtra(form.dataset.phone, { ...v, month: ui.salaryMonth }); form.reset(); }, 'Likh diya'); },
    async payment(form, v, button) { await busy(button, () => data.addPayment(form.dataset.phone, ui.salaryMonth, v), 'Payment likh di'); }
  };
  const changes = {
    'pick-date'(el) { if (!el.value) return; if (ui.view === 'day') { if (isDate(el.value) && el.value <= pkDate()) ui.date = el.value; data.watchMonth(ui.date.slice(0, 7)); } else { ui.month = el.value; data.watchMonth(ui.month); } rerender(); },
    'pick-salary-month'(el) { if (!el.value) return; ui.salaryMonth = el.value; data.watchMonth(ui.salaryMonth); rerender(); },
    async 'staff-photo'(el) { const f = el.files?.[0]; if (!f) return; try { sheets.staffForm?.setPhoto(await fileToDataUrl(f, 360)); } catch (e) { toast(errorText(e), 'bad'); } },
    'shift-mode'(el) { const box = $('#ownShift', el.closest('form')); if (box) box.hidden = el.checked; }
  };
  const inputs = {
    'staff-query'(el) { // list dobara banaye baghair chhanti, taake likhte waqt keyboard band na ho
      ui.staffQuery = el.value; const q = el.value.trim().toLowerCase(); let n = 0;
      for (const li of el.closest('.view').querySelectorAll('[data-search]')) { li.hidden = !!q && !li.dataset.search.includes(q); if (!li.hidden) n++; }
      const empty = $('#staffEmpty', el.closest('.view')); if (empty) empty.hidden = n > 0;
    },
    smart() { sheets.search?.refresh(); }
  };

  function render() {
    const pend = pending().length;
    const tabs = [['hazri', 'Hazri', 'book'], ['salary', 'Salary', 'wallet'], ['staff', 'Staff', 'people']];
    return `<header class="top"><div class="top-in">
        <div class="brand"><span class="brand-mark" aria-hidden="true">NT</span><span><b>Noor Traders</b><small>Hazri register</small></span></div>
        <nav class="tabs" aria-label="Hisse">${tabs.map(([k, label, ic]) => `<button type="button" data-action="tab" data-arg="${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">${icon(ic, 22)}<span>${label}</span>${k === 'staff' && pend ? `<em class="badge">${pend}</em>` : ''}</button>`).join('')}</nav>
        <button type="button" class="search-btn" data-action="search">${icon('search', 18)}<span>Talash: naam, "late is hafte"…</span></button>
      </div></header>
      <main class="view view-${ui.tab}">${!S.loaded.has('staff') ? '<p class="loading-line">Data aa raha hai…</p>' : ''}${ui.tab === 'hazri' ? hazriTab() : ui.tab === 'salary' ? salaryTab() : staffTab()}</main>`;
  }
  return { render, actions, forms, changes, inputs, ui, onData() { refreshSheets(); } };
}
