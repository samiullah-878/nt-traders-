// owner.js — malik ka panel: Hazri, Salary, Staff.
import {
  APP_VERSION, STATUS_LABEL, STATUS_MARK, DAY_SHORT, SHOP, esc, money, hm, fmtTime, to24, pkDate, pkMinutes, pkTime24, addDays, addMonths, weekday,
  monthDates, monthLabel, dateLabel, parseTime, shortDate, weekRange, dayRows, countStatuses, monthSummary, smartSearch, salaryConfig, checkoutDue, isDate,
  shiftMinutes, usesDefaultSalary, weekSummary, isClosed, loanCuts, workMinutes, parseTime as C_parse
} from './core.js';
import { icon, avatar, nameHtml, toast, busy, openSheet, refreshSheets, fileToDataUrl, deliverPdf, $, errorText, timeField, IN_TICKETS, OUT_TICKETS } from './ui.js';
import { loadPdfLib, browserTextImages, dailyPdf, staffMonthPdf, registerPdf, salarySheetPdf } from './pdf.js';

const ORDER = { due: 0, late: 1, waiting: 2, absent: 3, loading: 3, present: 4, leave: 5, off: 6, closed: 6, na: 7 };
const FILTERS = [['all', 'Sab'], ['present', 'Hazir'], ['late', 'Late'], ['absent', 'Ghair hazir'], ['leave', 'Chutti/Off']];

export function createOwnerView({ data, controller, rerender, logout, checkUpdate }) {
  const S = data.state;
  const ui = { openTickets: new Set(), tab: 'hazri', view: 'day', date: pkDate(), month: pkDate().slice(0, 7), filter: 'all', salaryMonth: pkDate().slice(0, 7), staffQuery: '', showInactive: false };
  const activeStaff = () => S.staff.filter(s => s.active !== false);
  const context = () => ({ requests: S.requests, schedules: S.schedules, config: S.config, today: pkDate(), nowMin: pkMinutes(), now: Date.now() });
  // Hazri abhi Firebase se nahi aayi to "Ghair hazir" nahi, "Load ho rahi" dikhao (pehle yehi ghalat-fehmi hoti thi).
  const rowsFor = date => {
    const rows = dayRows({ staff: activeStaff(), attendance: data.attendanceBetween(date, date), date, ...context() });
    if (data.monthLoaded(date.slice(0, 7))) return rows;
    return rows.map(r => ['absent', 'waiting'].includes(r.status) ? { ...r, status: 'loading' } : r);
  };
  const attError = month => S.errors?.['att:' + month];
  const dutyText = sch => { const m = shiftMinutes(sch); return sch.shiftEnd ? `${fmtTime(sch.shiftStart)} – ${fmtTime(sch.shiftEnd)}` : `${fmtTime(sch.shiftStart)} se`; void m; };
  const hoursText = (sch, account) => { const m = shiftMinutes(sch); return m ? hm(m).replace(' 00m', '') + ' duty' : Math.round(data.salaryFor(account).dutyHours) + 'h duty'; };
  const summaryFor = (account, month) => monthSummary({ account, attendance: data.attendanceBetween(month + '-01', month + '-31'), requests: S.requests, schedule: data.scheduleFor(account.phone), month, today: pkDate(), nowMin: pkMinutes() });
  const account = phone => S.staff.find(s => s.phone === phone);
  const pending = () => S.requests.filter(r => r.status === 'pending' && r.kind !== 'suggestion');
  const loadingNote = month => attError(month)
    ? `<p class="error-line">${icon('alert', 18)} <span>${esc(monthLabel(month))} ki hazri Firebase se nahi aayi (${esc(attError(month))}). Internet check karein, phir Logout kar ke dobara login karein. Masla rahe to "Staff › App ki jaanch" ka screenshot bhejein.</span></p>`
    : data.monthLoaded(month) ? '' : `<p class="loading-line">${esc(monthLabel(month))} ki hazri load ho rahi hai…</p>`;

  const resolveBase = () => data.scheduleFor('__default__');
  // Aane ka waqt PM aur jane ka AM = shayad ghalti se raat ki duty save ho gayi (purane ghari wale picker ki wajah se)
  const nightShift = c => { const a = C_parse(c.shiftStart), b = C_parse(c.shiftEnd); return a != null && b != null && a >= 12 * 60 && b < a; };
  /* ================= HAZRI ================= */
  function attention() {
    const today = pkDate(), items = [];
    const due = data.allAttendance().filter(a => checkoutDue(a, data.scheduleFor(a.phone)) && account(a.phone));
    if (due.length) items.push({ tone: 'bad', icon: 'clock', title: `${due.length} Check-Out baqi — daba kar band karein`, text: [...new Set(due.map(a => account(a.phone)?.name))].slice(0, 3).join(', '), action: 'close-due', arg: '' });
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
    if (nightShift(S.config)) items.unshift({ tone: 'bad', icon: 'alert', title: `Default duty ghalat lag rahi hai: ${dutyText(resolveBase())}`, text: 'Daba kar AM / PM theek karein', action: 'settings', arg: '' });
    if (!items.length) return '';
    return `<section class="attention" aria-label="Tawajju chahiye"><h2 class="section-label">Tawajju chahiye</h2><div class="attention-list">${items.map(i =>
      `<button type="button" class="att-card tone-${i.tone}" data-action="${i.action}" data-arg="${esc(i.arg || '')}">${icon(i.icon, 22)}<span><b>${esc(i.title)}</b><small>${esc(i.text || '')}</small></span></button>`).join('')}</div></section>`;
  }
  function strip(c, total) {
    const seg = (k, n) => n ? `<i class="seg s-${k}" style="flex:${n}" title="${STATUS_LABEL[k]}: ${n}"></i>` : '';
    return `<div class="strip" role="img" aria-label="Hazri ka khulasa">${total ? seg('present', c.present) + seg('late', c.late) + seg('waiting', c.waiting) + seg('absent', c.absent) + seg('leave', c.leave + c.off) : '<i class="seg s-na" style="flex:1"></i>'}</div>`;
  }
  function personRow(r, date) {
    const { account: s, a, status, late, due, minutes, schedule: sch } = r;
    const stamp = status === 'late' ? `Late ${late}m` : STATUS_LABEL[status];
    const duty = shiftMinutes(sch) || Math.round(data.salaryFor(s).dutyHours * 60);
    const chips = [`<span class="tag">${icon('clock', 14)} ${esc(dutyText(sch))}</span>`, `<span class="tag">${esc(hoursText(sch, s))}</span>`];
    if (a.checkIn) {
      chips.push(`<span class="tag t-ok">Aaya ${fmtTime(a.checkIn)}</span>`);
      chips.push(a.checkOut ? `<span class="tag t-ok">Gaya ${fmtTime(a.checkOut)}</span>` : due ? '<span class="tag t-bad">Check-Out baqi</span>' : '<span class="tag">Kaam par</span>');
      if (minutes != null) chips.push(`<span class="tag t-ink">${hm(minutes)}${duty && minutes > duty ? ' (+' + hm(minutes - duty) + ' OT)' : ''}</span>`);
      if (a.manual) chips.push('<span class="tag">Malik ne lagayi</span>');
    }
    // Tickets: aik tap se Aaya / Gaya ka waqt. Bhool jane wale larke ke liye.
    const key = s.phone + '|' + date, open = ui.openTickets.has(key);
    const tix = (kind, list, current) => `<div class="tix"><span class="tix-label">${kind === 'in' ? 'Aaya' : 'Gaya'}:</span>${[...new Set(list.filter(Boolean))].sort().map(v =>
      `<button type="button" class="tix-btn${current === v ? ' is-on' : ''}" data-action="tix" data-kind="${kind}" data-phone="${s.phone}" data-date="${date}" data-arg="${v}">${esc(fmtTime(v).replace(' am', '').replace(' pm', ''))}<small>${parseTime(v) >= 720 ? 'pm' : 'am'}</small></button>`).join('')}</div>`;
    const inList = [to24(sch.shiftStart), ...IN_TICKETS], outList = [...OUT_TICKETS, to24(sch.shiftEnd)];
    let quick = '';
    if (['absent', 'waiting', 'loading'].includes(status) && status !== 'loading') quick = tix('in', inList, '');
    else if (a.checkIn && !a.checkOut) quick = tix('out', outList, '') + (open ? tix('in', inList, to24(a.checkIn)) : `<button type="button" class="tix-more" data-action="tix-open" data-arg="${key}">Aaya badlein</button>`);
    else if (a.checkIn) quick = open ? tix('in', inList, to24(a.checkIn)) + tix('out', outList, to24(a.checkOut)) : `<button type="button" class="tix-more" data-action="tix-open" data-arg="${key}">Waqt badlein</button>`;
    return `<li class="row s-${status}${due ? ' is-due' : ''}">
      <div class="row-col">
        <button type="button" class="row-main" data-action="profile" data-phone="${s.phone}" data-date="${date}">
          ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(s.role || 'Staff')}</small></span>
          <span class="stamp st-${status}">${esc(stamp)}</span>
        </button>
        <div class="tags">${chips.join('')}</div>${quick ? `<div class="tix-wrap">${quick}</div>` : ''}
      </div>
      <button type="button" class="row-pdf" data-action="pdf-staff" data-phone="${s.phone}" data-month="${date.slice(0, 7)}" aria-label="${esc(s.name)} ki PDF">${icon('pdf', 18)}<span>PDF</span></button>
    </li>`;
  }
  function weekCard() {
    if (!data.monthLoaded(pkDate().slice(0, 7))) return '';
    const w = weekSummary({ staff: activeStaff(), attendance: data.allAttendance(), ...context() });
    if (!w.rows.length) return '';
    const days = Math.round((Date.parse(w.to) - Date.parse(w.from)) / 86400000) + 1;
    const lateTop = [...w.rows].filter(r => r.late).sort((a, b) => b.late - a.late)[0];
    const full = w.rows.filter(r => r.present === days).length;
    const hours = w.rows.reduce((n, r) => n + r.minutes, 0);
    return `<details class="week"><summary><span><b>Is hafte</b> (${esc(shortDate(w.from))} – ${esc(shortDate(w.to))})</span>
        <span class="week-bits"><span>${full} ki poori hazri</span>${lateTop ? `<span class="txt-late">Sab se zyada late: ${nameHtml(lateTop.account.name)} (${lateTop.late})</span>` : ''}<span>${hm(hours)} kul kaam</span></span></summary>
      <table class="week-table"><thead><tr><th>Naam</th><th>Aaya</th><th>Late</th><th>Ghair</th><th>Ghante</th></tr></thead>
      <tbody>${[...w.rows].sort((a, b) => b.late - a.late || a.present - b.present).map(r => `<tr><td>${nameHtml(r.account.name)}</td><td>${r.present}/${days}</td><td class="${r.late ? 'txt-late' : ''}">${r.late}</td><td class="${r.absent ? 'txt-bad' : ''}">${r.absent}</td><td>${hm(r.minutes)}</td></tr>`).join('')}</tbody></table></details>`;
  }
  function dayView() {
    const date = ui.date, today = pkDate(), month = date.slice(0, 7);
    const rows = rowsFor(date), c = countStatuses(rows);
    const match = r => ui.filter === 'all' || r.status === ui.filter || (ui.filter === 'leave' && ['off', 'closed'].includes(r.status)) || (ui.filter === 'absent' && ['waiting', 'loading'].includes(r.status));
    const shown = rows.filter(match).sort((a, b) => (ORDER[a.due ? 'due' : a.status] - ORDER[b.due ? 'due' : b.status]) || (a.a.checkIn || '').localeCompare(b.a.checkIn || '') || String(a.account.name).localeCompare(String(b.account.name)));
    const counts = { all: rows.length, present: c.present, late: c.late, absent: c.absent + c.waiting + c.loading, leave: c.leave + c.off };
    const closed = isClosed(resolveBase(), date), reason = (S.config.closedDays || []).find(d => d.date === date)?.reason;
    return `${date === today ? attention() + weekCard() : ''}
      ${closed ? `<p class="closed-line">${icon('alert', 18)} <span><b>${esc(dateLabel(date))}: Dukaan band</b>${reason && reason !== 'Dukaan band' ? ' — ' + esc(reason) : ''}. Is din koi ghair hazir nahi ginta.</span></p>` : ''}
      <div class="day-tools"><button type="button" class="btn btn-ghost btn-sm" data-action="toggle-closed" data-arg="${date}">${closed ? 'Dukaan band hatayein' : (date === today ? 'Aaj' : 'Is din') + ' dukaan band (Eid / chutti)'}</button>${c.absent + c.waiting && data.monthLoaded(month) ? `<button type="button" class="btn btn-ghost btn-sm" data-action="quick-present-all" data-arg="${date}">Sab ghair hazir ko hazir lagao</button>` : ''}</div>
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
    const def = S.config.salaryDefault || {}, onDefault = rows.filter(r => r.calc.useDefault).length;
    return `<div class="toolbar"><h1 class="page-title">Salary</h1><div class="btn-row"><button type="button" class="btn btn-ink" data-action="pdf-salary">${icon('pdf', 18)} Salary sheet</button><button type="button" class="btn btn-ink" data-action="pdf-slips">${icon('share', 18)} Sab ki slips</button></div></div>
      <div class="datebar">
        <button type="button" class="icon-btn" data-action="sal-step" data-arg="-1" aria-label="Pichla mahina">${icon('left')}</button>
        <label class="date-pick"><span>${esc(monthLabel(month))}</span><input type="month" value="${month}" max="${pkDate().slice(0, 7)}" data-change="pick-salary-month" aria-label="Mahina chunein"></label>
        <button type="button" class="icon-btn" data-action="sal-step" data-arg="1" aria-label="Agla mahina" ${month >= pkDate().slice(0, 7) ? 'disabled' : ''}>${icon('right')}</button>
      </div>
      <section class="totals"><div><small>Kul banti salary</small><b>${money(sum('final'))}</b></div><div><small>Ada ho chuki</small><b class="txt-ok">${money(sum('paid'))}</b></div><div><small>Baqi</small><b class="txt-bad">${money(sum('balance'))}</b></div></section>
      <button type="button" class="rule-card" data-action="settings" data-arg="salary">${icon('wallet', 20)}<span><b>Default salary: ${def.monthlySalary ? money(def.monthlySalary) : 'abhi likhi nahi'}</b><small>${onDefault}/${rows.length} staff default par &nbsp;|&nbsp; Hisab: ${def.mode === 'days' ? 'din ke mutabiq (ghair hazir din kat-ta hai)' : 'ghanton ke mutabiq'}${Number(def.lateEvery) ? ` &nbsp;|&nbsp; Har ${def.lateEvery} late par ${def.lateFineDays ?? 0.5} din kati` : ''}</small></span>${icon('right', 18)}</button>
      <section class="panel">${loadingNote(month)}
        <ol class="register">${rows.map(({ account: s, calc }) => `<li class="row"><button type="button" class="row-main" data-action="salary" data-phone="${s.phone}">
          ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${calc.useDefault ? 'Default' : 'Apni'} ${money(calc.monthlySalary)} &nbsp;|&nbsp; ${calc.daysWorked} din${calc.absentDays ? ' &nbsp;|&nbsp; ' + calc.absentDays + ' ghair hazir' : ''}${calc.deductions ? ' &nbsp;|&nbsp; Kati ' + money(calc.deductions) : ''}${calc.openDays ? ` &nbsp;|&nbsp; <b class="txt-bad">${calc.openDays} Check-Out baqi</b>` : ''}</small></span>
          <span class="amount"><b>${money(calc.final)}</b><small class="${calc.balance > 0.5 ? 'txt-bad' : 'txt-ok'}">${calc.frozen ? (calc.balance > 0.5 ? 'Baqi ' + money(calc.balance) : 'Poori ada') : 'Andaza'}</small></span>
        </button></li>`).join('')}</ol>
        ${rows.length ? '' : '<p class="empty-line">Abhi koi staff nahi.</p>'}
        ${rows.some(r => !r.calc.monthlySalary) ? '<p class="hint">Jin ki salary Rs 0 aa rahi hai: upar "Default salary" daba kar raqam likhein, ya staff ke naam par ja kar apni salary likhein.</p>' : ''}
      </section>
      <button type="button" class="rule-card" data-action="khata">${icon('book', 20)}<span><b>Advance / qarz ka khata</b><small>Kis ka kitna qarz baqi hai, har mahine kitni qist</small></span>${icon('right', 18)}</button>`;
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
            ${c.mode === 'days'
              ? line(`Ghair hazir <small>${c.absentDays} din × ${money(c.perDay)}/din</small>`, '− ' + money(c.absentCut), c.absentCut ? 'txt-bad' : '') + line('Hazri ke mutabiq salary', money(c.normalSalary))
              : line(`Aam ghante <small>${hm(c.normalMin)} × ${money(c.hourly)}/ghanta</small>`, money(c.normalSalary))}
            ${line(`Overtime <small>${hm(c.otMin)} × ${money(c.otRate)}/ghanta</small>`, '+ ' + money(c.overtimeAmount))}
            ${c.pointsAmount ? line(`Points <small>${c.points} × ${money(c.pointRate)}</small>`, '+ ' + money(c.pointsAmount)) : ''}
            ${c.mealSalary ? line(`Khana <small>${c.mealMode === 'daily' ? c.mealDays + ' din' : 'mahana'}</small>`, '+ ' + money(c.mealSalary)) : ''}
            ${c.bonus ? line('Bonus', '+ ' + money(c.bonus)) : ''}
            ${c.advance ? line('Advance (kat gaya)', '− ' + money(c.advance), 'txt-bad') : ''}
            ${c.loanCut ? line(`Qarz ki qist <small>${(c.loans || []).filter(l => l.cut).map(l => 'baqi ' + money(l.remainingAfter)).join(', ')}</small>`, '− ' + money(c.loanCut), 'txt-bad') : ''}
            ${c.lateFine ? line(`Late jurmana <small>${c.lateCount} dafa late</small>`, '− ' + money(c.lateFine), 'txt-bad') : ''}
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
          <h3 class="sub">Advance / bonus / qarz</h3>
          <ul class="ledger">${(c.loans || []).map(l => `<li><span><b>Qarz</b> <small>${esc(monthLabel(l.month))} se · kul ${money(l.amount)} · qist ${money(l.perMonth)} · baqi ${money(l.remainingAfter)}</small></span><span>${money(l.cut)}${c.frozen ? '' : ` <button type="button" class="link-bad" data-action="extra-del" data-phone="${phone}" data-id="${esc(l.id)}">Hatayein</button>`}</span></li>`).join('')}${(c.extras || []).map(x => `<li><span><b>${x.kind === 'advance' ? 'Advance' : 'Bonus'}</b> <small>${esc(shortDate(x.date))}${x.note ? ' · ' + esc(x.note) : ''}</small></span><span>${money(x.amount)}${c.frozen ? '' : ` <button type="button" class="link-bad" data-action="extra-del" data-phone="${phone}" data-id="${esc(x.id)}">Hatayein</button>`}</span></li>`).join('') || ((c.loans || []).length ? '' : '<li class="muted">Is mahine koi entry nahi.</li>')}</ul>
          ${c.frozen ? '' : `<form class="inline-form" data-form="extra" data-phone="${phone}">
            <select name="kind" aria-label="Qisam" data-change="extra-kind"><option value="advance">Advance (isi mahine kategi)</option><option value="loan">Qarz (qiston mein)</option><option value="bonus">Bonus</option></select>
            <input name="amount" type="number" inputmode="numeric" min="1" placeholder="Raqam" required aria-label="Raqam">
            <input name="perMonth" type="number" inputmode="numeric" min="1" placeholder="Har mahine qist (Rs)" aria-label="Har mahine qist" hidden>
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
        ${avatar(s)}<span class="row-text"><b>${nameHtml(s.name)}</b><small>${esc(s.role || 'Staff')} &nbsp;|&nbsp; ${esc(s.phone)}</small><span class="tags inline"><span class="tag">${icon('clock', 14)} ${esc(dutyText(data.scheduleFor(s.phone)))}</span><span class="tag">${usesDefaultSalary(s) ? 'Default salary' : 'Apni salary ' + money(data.salaryFor(s).monthlySalary)}</span></span></span>
        <span class="stamp ${s.active === false ? 'st-off' : s.loginEnabled === false ? 'st-absent' : 'st-present'}">${s.active === false ? 'Band' : s.loginEnabled === false ? 'Login band' : 'Chalu'}</span></button></li>`).join('')}</ol>
        <p class="empty-line" id="staffEmpty" ${list.length ? 'hidden' : ''}>Koi staff nahi mila.</p>
        ${inactive ? `<button type="button" class="link" data-action="toggle-inactive">${ui.showInactive ? 'Band kiye hue chhupayein' : `Band kiye hue bhi dikhayein (${inactive})`}</button>` : ''}
      </section>
      <section class="panel tools">
        <button type="button" class="tool" data-action="requests">${icon('note')}<span><b>Chutti / correction ki requests</b><small>${pend ? pend + ' ka jawab baqi' : 'Koi nayi request nahi'}</small></span>${pend ? `<em class="badge">${pend}</em>` : ''}</button>
        <button type="button" class="tool" data-action="settings">${icon('clock')}<span><b>Default duty aur default salary</b><small>${esc(dutyText(resolveBase()))} &nbsp;|&nbsp; ${S.config.salaryDefault?.monthlySalary ? money(S.config.salaryDefault.monthlySalary) : 'salary likhi nahi'} &nbsp;|&nbsp; ${Number(S.config.radius || SHOP.radius)}m</small></span></button>
        <button type="button" class="tool" data-action="password">${icon('edit')}<span><b>Malik ka password badlein</b></span></button>
        <button type="button" class="tool" data-action="links">${icon('share')}<span><b>Update ke links</b><small>GitHub upload · Firebase rules</small></span></button>
        <button type="button" class="tool" data-action="khata">${icon('book')}<span><b>Advance / qarz ka khata</b></span></button>
        <button type="button" class="tool" data-action="diag">${icon('alert')}<span><b>App ki jaanch</b><small>Hazri na dikhe to is ka screenshot bhejein</small></span></button>
        <button type="button" class="tool" data-action="update">${icon('down')}<span><b>App update check karein</b><small>Abhi ${APP_VERSION}</small></span></button>
        <button type="button" class="tool tone-bad" data-action="logout">${icon('out')}<span><b>Logout</b></span></button>
      </section>`;
  }
  function staffForm(phone) {
    const s = phone ? account(phone) : null, cfg = salaryConfig(s || {}, S.config), own = phone ? S.schedules.get(phone) : null, sch = data.scheduleFor(phone || '');
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
          <label class="check"><input type="checkbox" name="useDefaultShift" ${!own || own.useDefaultShift !== false ? 'checked' : ''} data-change="toggle-box" data-arg="ownShift" data-invert="1"> Default duty (${esc(dutyText(resolveBase()))})</label>
          <div id="ownShift" class="sub-box" ${!own || own.useDefaultShift !== false ? 'hidden' : ''}>
            ${timeField('shiftStart', to24(sch.shiftStart) || '09:15', { label: 'Duty shuru', tickets: IN_TICKETS })}
            ${timeField('shiftEnd', to24(sch.shiftEnd) || '19:00', { label: 'Duty khatam', tickets: OUT_TICKETS })}
            <label>Late ki riayat (minute)<input name="grace" type="number" inputmode="numeric" min="0" max="120" value="${Number(sch.grace ?? 10)}"></label>
          </div>
          <label>Hafta-war chutti<select name="weeklyOff"><option value="">Koi nahi</option>${['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Juma', 'Hafta'].map((d, i) => `<option value="${i}" ${(own?.weeklyOff || []).map(Number).includes(i) ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        </fieldset>
        <fieldset><legend>Salary</legend>
          <label class="check"><input type="checkbox" name="useDefaultSalary" ${!s || usesDefaultSalary(s) ? 'checked' : ''} data-change="toggle-box" data-arg="ownSalary" data-invert="1"> Default salary (${S.config.salaryDefault?.monthlySalary ? money(S.config.salaryDefault.monthlySalary) : 'Settings mein likhein'})</label>
          <div id="ownSalary" class="sub-box" ${!s || usesDefaultSalary(s) ? 'hidden' : ''}>
            <label>Is staff ki mahana salary (Rs)<input name="monthlySalary" type="number" inputmode="numeric" min="0" value="${Number(s?.salary?.monthlySalary) || ''}" placeholder="30000"></label>
            <div class="two"><label>Roz ke ghante<input name="dutyHours" type="number" inputmode="decimal" min="1" max="16" step="0.5" value="${Number(s?.salary?.dutyHours) || 10}"></label><label>Mahine ke din<input name="workingDays" type="number" inputmode="numeric" min="1" max="31" value="${Number(s?.salary?.workingDays) || 30}"></label></div>
            <label>Overtime rate (Rs/ghanta) <small>khali = aam rate</small><input name="overtimeRate" type="number" inputmode="numeric" min="0" value="${Number(s?.salary?.overtimeRate) || ''}"></label>
          </div>
          <div class="two"><label>Khane ke paise<select name="mealMode"><option value="none" ${cfg.mealMode === 'none' ? 'selected' : ''}>Nahi</option><option value="daily" ${cfg.mealMode === 'daily' ? 'selected' : ''}>Rozana</option><option value="monthly" ${cfg.mealMode === 'monthly' ? 'selected' : ''}>Mahana</option></select></label><label>Raqam (Rs)<input name="mealRate" type="number" inputmode="numeric" min="0" value="${cfg.mealRate || ''}"></label></div>
          <label class="check"><input type="checkbox" name="mealInSalary" ${cfg.mealInSalary ? 'checked' : ''}> Khane ke paise salary mein jorein</label>
          <details><summary>Points ka rate (agar dete hain)</summary><label>1 point = Rs<input name="pointRate" type="number" inputmode="decimal" min="0" step="0.5" value="${Number(s?.salary?.pointRate) || ''}"></label><p class="hint">Waqt par aane ke points hazri ke sath khud bante hain. Rate 0 ho to salary par asar nahi.</p></details>
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
        const s = account(phone) || { name: phone }, a = data.attendanceBetween(date, date).find(x => x.phone === phone) || {}, sch = data.scheduleFor(phone);
        sh.setTitle(`${nameHtml(s.name)} <small>${esc(dateLabel(date))}</small>`);
        return `<form class="form" data-form="att" data-phone="${phone}" data-id="${esc(a.id || '')}">
          ${a.selfie ? `<div class="proof"><img src="${esc(a.selfie)}" alt="Check-In ki selfie"><p>${icon('pin', 16)} Dukaan se ${a.checkInDistance != null ? Math.round(a.checkInDistance) + 'm' : '—'}<br><small>Selfie Check-In ke waqt li gayi</small></p></div>` : ''}
          <label>Tareekh<input name="date" type="date" value="${date}" max="${pkDate()}" required ${a.id ? 'readonly' : ''}></label>
          ${timeField('checkIn', to24(a.checkIn), { label: 'Aaya', tickets: [to24(sch.shiftStart), ...IN_TICKETS].sort(), now: date === pkDate() })}
          ${timeField('checkOut', to24(a.checkOut), { label: 'Gaya', tickets: [...OUT_TICKETS, to24(sch.shiftEnd)].sort(), optional: true, now: date === pkDate() })}
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
  function settingsSheet(focus = '') {
    const sheet = openSheet({ id: 'settings', wide: true, title: 'Default duty aur default salary', render: () => {
      const c = S.config, d = { ...(c.salaryDefault || {}) }, n = activeStaff().length;
      const customShift = activeStaff().filter(s => S.schedules.get(s.phone)?.useDefaultShift === false).length;
      const customSalary = activeStaff().filter(s => !usesDefaultSalary(s)).length;
      const hrs = shiftMinutes(resolveBase());
      return `<form class="form" data-form="settings">
      <fieldset id="setDuty"><legend>Default duty (sab par)</legend>
        ${timeField('shiftStart', to24(c.shiftStart) || '09:15', { label: 'Aane ka waqt', tickets: IN_TICKETS })}
        ${timeField('shiftEnd', to24(c.shiftEnd) || '19:00', { label: 'Jane ka waqt', tickets: OUT_TICKETS })}
        ${nightShift(c) ? `<p class="error-line">${icon('alert', 18)} <span>Abhi duty <b>${esc(dutyText(resolveBase()))}</b> save hai — ye raat ki duty lag rahi hai. Din ki duty ho to upar AM / PM theek kar ke Save karein.</span></p>` : ''}
        <p class="hint">${hrs ? 'Duty: <b>' + hm(hrs) + '</b> roz. Isi se default salary ke ghante bante hain.' : 'Jane ka waqt likhein taake roz ke ghante khud ban jayein.'}</p>
        <div class="two"><label>Late ki riayat (minute)<input name="grace" type="number" inputmode="numeric" min="0" max="120" value="${Number(c.grace ?? 10)}"></label>
        <label>Check-In ki had (meter)<input name="radius" type="number" inputmode="numeric" min="20" max="5000" value="${Number(c.radius || SHOP.radius)}" required></label></div>
        <p class="hint">${customShift ? `${customShift} staff ki apni alag duty hai.` : 'Sab staff default duty par hain.'}</p>
        ${customShift ? '<button type="button" class="btn btn-ghost btn-sm" data-action="apply-shift-all">Sab par default duty lagayein</button>' : ''}
      </fieldset>
      <fieldset id="setSalary"><legend>Default salary (sab par)</legend>
        <label>Mahana salary (Rs)<input name="defSalary" type="number" inputmode="numeric" min="0" value="${Number(d.monthlySalary) || ''}" placeholder="25000"></label>
        <div class="two"><label>Mahine ke din<input name="defDays" type="number" inputmode="numeric" min="1" max="31" value="${Number(d.workingDays) || 30}"></label><label>Overtime (Rs/ghanta) <small>khali = aam rate</small><input name="defOt" type="number" inputmode="numeric" min="0" value="${Number(d.overtimeRate) || ''}"></label></div>
        <label>Hisab kaise ho
          <select name="salaryMode"><option value="days" ${d.mode === 'days' ? 'selected' : ''}>Din ke mutabiq — poori salary, har ghair hazir din kat-ta hai</option><option value="hours" ${d.mode !== 'days' ? 'selected' : ''}>Ghanton ke mutabiq — jitne ghante kaam, utni salary</option></select></label>
        <label class="check"><input type="checkbox" name="leavePaid" ${d.leavePaid !== false ? 'checked' : ''}> Manzoor chutti ki salary nahi kategi</label>
        <div class="two"><label>Har kitne late par jurmana <small>0 = band</small><input name="lateEvery" type="number" inputmode="numeric" min="0" max="31" value="${Number(d.lateEvery) || 0}"></label><label>Jurmana (din ki salary)<input name="lateFineDays" type="number" inputmode="decimal" min="0" max="5" step="0.25" value="${d.lateFineDays ?? 0.5}"></label></div>
        <p class="hint">Misal: 3 aur 0.5 = har 3 dafa late hone par aadhe din ki salary kategi. Ye qawaid sab staff par lagte hain.</p>
        <p class="hint">${customSalary ? `${customSalary} staff ki apni salary hai (default nahi).` : n ? 'Sab staff default salary par hain.' : ''}</p>
        ${customSalary ? '<button type="button" class="btn btn-ghost btn-sm" data-action="apply-salary-all">Sab par default salary lagayein</button>' : ''}
      </fieldset>
      <label>Staff ke liye hidayat <small>(un ki screen par nazar aati hai)</small><textarea name="instruction" rows="3" maxlength="500">${esc(c.instruction || '')}</textarea></label>
      <p class="hint">Final ho chuke mahinon par in tabdeeliyon ka asar nahi hota.</p>
      <div class="btn-row sticky"><button class="btn btn-primary btn-lg">Save karein</button></div></form>`; } });
    if (focus) setTimeout(() => sheet.el.querySelector(focus === 'salary' ? '#setSalary' : '#setDuty')?.scrollIntoView?.({ block: 'start' }), 80);
    return sheet;
  }
  function khataSheet() {
    return openSheet({ id: 'khata', wide: true, title: 'Advance / qarz ka khata', render: () => {
      const month = pkDate().slice(0, 7);
      const rows = activeStaff().map(s => {
        const extras = Array.isArray(s.salaryExtras) ? s.salaryExtras : [];
        const loans = loanCuts(extras, month), owed = loans.reduce((n, l) => n + l.remainingBefore, 0);
        const advThis = extras.filter(x => x.kind === 'advance' && x.month === month).reduce((n, x) => n + Number(x.amount || 0), 0);
        const advYear = extras.filter(x => x.kind === 'advance' && String(x.month).slice(0, 4) === month.slice(0, 4)).reduce((n, x) => n + Number(x.amount || 0), 0);
        return { s, loans, owed, advThis, advYear };
      }).filter(r => r.owed || r.advYear).sort((a, b) => b.owed - a.owed || b.advYear - a.advYear);
      return rows.length ? `<p class="hint">Advance usi mahine ki salary se kat-ta hai. Qarz har mahine qist mein kat-ta hai. Naya advance ya qarz staff ki salary mein likhein.</p>
        <ol class="register">${rows.map(r => `<li class="row"><button type="button" class="row-main" data-action="salary" data-phone="${r.s.phone}" data-month="${month}">${avatar(r.s)}<span class="row-text"><b>${nameHtml(r.s.name)}</b><small>Is mahine advance ${money(r.advThis)} &nbsp;|&nbsp; Is saal ${money(r.advYear)}${r.loans.filter(l => l.remainingBefore).map(l => ` &nbsp;|&nbsp; Qarz qist ${money(l.perMonth)}`).join('')}</small></span><span class="amount"><b class="${r.owed ? 'txt-bad' : ''}">${money(r.owed)}</b><small>qarz baqi</small></span></button></li>`).join('')}</ol>`
        : '<p class="empty-line">Kisi ka koi advance ya qarz nahi.</p>';
    } });
  }
  /** GitHub ka pata website ke address se: <user>.github.io/<repo>/  ->  github.com/<user>/<repo> */
  function repoInfo() {
    const host = location.hostname || '', seg = (location.pathname || '/').split('/').filter(Boolean)[0] || '';
    if (/\.github\.io$/i.test(host)) { const user = host.split('.')[0]; return { user, repo: seg && !/\.html?$/.test(seg) ? seg : host }; }
    return null;
  }
  function linksSheet() {
    return openSheet({ id: 'links', title: 'Update ke links', render: () => {
      const r = repoInfo(), gh = r ? `https://github.com/${r.user}/${r.repo}` : '', fb = `https://console.firebase.google.com/project/${data.projectId}`;
      const link = (href, title, text) => `<a class="tool link-card" href="${esc(href)}" target="_blank" rel="noopener">${icon('share')}<span><b>${title}</b><small>${text}</small></span>${icon('right', 18)}</a>`;
      return `<p class="hint">Naya update: zip ki saari files <b>GitHub upload</b> par daal kar "Commit changes" dabayein. 1-2 minute baad app khud nayi version le legi.</p>
        <div class="panel tools">
          ${gh ? link(gh + '/upload/main', '1. GitHub — files upload karein', esc(r.user + '/' + r.repo) + ' · main') : '<p class="hint pad">GitHub ka pata nahi mila (app github.io par nahi khuli).</p>'}
          ${gh ? link(gh + '/actions', '2. GitHub — deploy check karein', 'Hara nishan = nayi version live') : ''}
          ${gh ? link(gh, 'GitHub — poora repo', 'Files dekhna / purani file delete karna') : ''}
          ${gh ? link(gh + '/blob/main/firestore.rules', 'firestore.rules file (GitHub)', 'Rules copy karne ke liye') : ''}
          ${link(fb + '/firestore/rules', '3. Firebase — Firestore rules', 'Rules paste kar ke "Publish"')}
          ${link(fb + '/authentication/providers', 'Firebase — login ki settings', 'Anonymous aur Email/Password dono ON')}
          ${link(fb + '/firestore/databases/-default-/data', 'Firebase — data dekhein', 'Hazri ke records')}
        </div>
        <p class="hint">Is update (${esc(APP_VERSION)}) mein Firebase rules badalne ki zaroorat nahi.</p>`;
    } });
  }
  function diagSheet() {
    return openSheet({ id: 'diag', wide: true, title: 'App ki jaanch', render: () => {
      const today = pkDate(), month = today.slice(0, 7), rowsToday = data.attendanceBetween(today, today);
      const known = new Set(S.staff.map(s => s.phone)), orphan = rowsToday.filter(a => !known.has(a.phone));
      let raw = ''; try { raw = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()); } catch { raw = '—'; }
      const sync = k => S.lastSync?.[k] ? fmtTime(new Date(S.lastSync[k]).toTimeString().slice(0, 5)) : 'abhi nahi';
      const line = (a, b, bad) => `<tr class="${bad ? 'txt-bad' : ''}"><td>${a}</td><td>${b}</td></tr>`;
      return `<p class="hint">Hazri na dikhe to is safhe ka screenshot bhejein.</p><table class="calc"><tbody>
        ${line('Version', esc(APP_VERSION))}
        ${line('App ki aaj ki tareekh', esc(today))}
        ${line('Phone ki tareekh (purana tareeqa)', esc(raw), raw !== today)}
        ${line('Internet', navigator.onLine === false ? 'Band' : 'Chalu', navigator.onLine === false)}
        ${line('Staff', S.staff.length + ' (' + activeStaff().length + ' kaam par)')}
        ${line(esc(monthLabel(month)) + ' ki hazri', data.monthLoaded(month) ? data.attendanceBetween(month + '-01', month + '-31').length + ' record' : 'load nahi hui', !data.monthLoaded(month))}
        ${line('Aaj ke record', rowsToday.length)}
        ${line('Aaj ke record jin ka staff list mein number nahi', orphan.length ? esc(orphan.map(a => a.phone + (a.name ? ' (' + a.name + ')' : '')).join(', ')) : '0', orphan.length)}
        ${line('Server se aakhri hazri', sync('att:' + month))}
        ${line('Ghaltiyan', Object.keys(S.errors || {}).length ? esc(Object.entries(S.errors).map(([k, v]) => k + ': ' + v).join(', ')) : 'Koi nahi', Object.keys(S.errors || {}).length)}
      </tbody></table>
      <h3 class="sub">Aaj ke record</h3>
      <ul class="ledger">${rowsToday.map(a => `<li><span><b>${nameHtml(account(a.phone)?.name || a.name || a.phone)}</b> <small>${esc(a.phone)} · id ${esc(a.id)}</small></span><span>${fmtTime(a.checkIn)} – ${fmtTime(a.checkOut)}</span></li>`).join('') || '<li class="muted">Aaj koi record server se nahi aaya.</li>'}</ul>`;
    } });
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
    async 'att-delete'(el) { if (!confirm('Is din ki hazri hata dein?')) return; await busy(el, async () => { await data.deleteAttendance(el.dataset.id, 'Malik ne hazri hatayi'); sheets.att?.close(); }, 'Hazri hata di'); },
    leave(el) { open('leave', () => leaveSheet(el.dataset.phone)); },
    async 'leave-cancel'(el) { if (!confirm('Ye chutti cancel karein?')) return; await busy(el, () => data.cancelLeave(el.dataset.id), 'Chutti cancel ho gayi'); },
    requests() { open('requests', requestsSheet); },
    async req(el) { await busy(el, () => data.reviewRequest(el.dataset.id, el.dataset.arg, ''), el.dataset.arg === 'approved' ? 'Manzoor ho gayi' : 'Na-manzoor kar di'); },
    settings(el) { open('settings', () => settingsSheet(el?.dataset.arg || '')); },
    khata() { open('khata', khataSheet); },
    diag() { open('diag', diagSheet); },
    links() { open('links', linksSheet); },
    'tix-open'(el) { ui.openTickets.add(el.dataset.arg); rerender(); },
    async tix(el) {
      const { phone, date, kind, arg } = el.dataset, a = data.attendanceBetween(date, date).find(x => x.phone === phone);
      await busy(el, async () => {
        if (kind === 'in') {
          if (a?.checkIn) await data.saveAttendance({ phone, date, checkIn: arg, checkOut: a.checkOut, note: a.ownerNote || 'Malik ne waqt badla' });
          else await data.quickPresent(phone, date, arg);
        } else {
          if (!a?.checkIn) throw new Error('Pehle aane ka waqt lagayein.');
          await data.saveAttendance({ phone, date, checkIn: a.checkIn, checkOut: arg, note: a.ownerNote || 'Malik ne Check-Out lagaya', finalScore: a.finalScore ?? '' });
        }
      }, `${account(phone)?.name || ''}: ${kind === 'in' ? 'Aaya' : 'Gaya'} ${fmtTime(arg)}`);
    },
    async 'quick-present'(el) { await busy(el, () => data.quickPresent(el.dataset.phone, el.dataset.date), 'Hazir lag gayi'); },
    async 'quick-present-all'(el) {
      const date = el.dataset.arg, list = rowsFor(date).filter(r => ['absent', 'waiting'].includes(r.status));
      if (!list.length || !confirm(`${list.length} staff ko ${shortDate(date)} ki hazir laga dein?\n${list.map(r => r.account.name).join(', ')}\n\nAane ka waqt duty shuru wala lagega.`)) return;
      await busy(el, async () => { for (const r of list) await data.quickPresent(r.account.phone, date); }, `${list.length} ki hazir lag gayi`);
    },
    async 'close-due'(el) {
      const all = data.allAttendance().filter(a => checkoutDue(a, data.scheduleFor(a.phone)) && account(a.phone));
      const list = el.dataset.arg ? all.filter(a => a.id === el.dataset.arg) : all;
      if (!list.length) return;
      if (!confirm(`${list.length > 1 ? list.length + ' staff ka' : (account(list[0].phone)?.name || '') + ' ka'} Check-Out duty khatam ke waqt par band kar dein?\n${list.map(a => `${account(a.phone)?.name} (${shortDate(a.date)})`).join(', ')}`)) return;
      await busy(el, () => data.closeCheckouts(list), 'Check-Out band ho gaya');
    },
    async 'toggle-closed'(el) {
      const date = el.dataset.arg, on = isClosed(resolveBase(), date);
      let reason = '';
      if (!on) { reason = prompt(`${dateLabel(date)} — dukaan kyun band thi? (Eid, jumma, chutti…)`, 'Dukaan band'); if (reason === null) return; }
      else if (!confirm('Is din ka "dukaan band" hata dein?')) return;
      await busy(el, () => data.toggleClosed(date, reason), on ? 'Dukaan band hata diya' : 'Is din sab ki chutti (dukaan band)');
    },
    async 'apply-shift-all'(el) { if (!confirm('Sab staff par default duty lagayein? Jin ki alag timing thi wo bhi default par aa jayenge.')) return; await busy(el, () => data.applyDefaultShiftAll(), 'Sab par default duty lag gayi'); },
    async 'apply-salary-all'(el) { if (!confirm('Sab staff par default salary lagayein?\nFinal ho chuke mahine nahi badlenge. Kisi ki apni salary baad mein bhi wapas lagayi ja sakti hai.')) return; await busy(el, () => data.applyDefaultSalaryAll(), 'Sab par default salary lag gayi'); },
    'pdf-slips'(el) {
      const month = ui.salaryMonth;
      return makePdf(el, async (lib, textImages) => {
        needMonth(month);
        const out = [];
        for (const s of activeStaff()) out.push(await staffMonthPdf(lib, { account: s, month, summary: summaryFor(s, month), calc: data.calcFor(s, month), schedule: data.scheduleFor(s.phone), textImages }));
        if (!out.length) throw new Error('Abhi koi staff nahi.');
        return out;
      });
    },
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
    'toggle-box'(el) { const box = $('#' + el.dataset.arg, el.closest('form')); if (box) box.hidden = el.dataset.invert ? el.checked : !el.checked; },
    'extra-kind'(el) { const per = el.form.elements.perMonth; if (per) { per.hidden = el.value !== 'loan'; per.required = el.value === 'loan'; } }
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
        <div class="brand"><span class="brand-mark" aria-hidden="true">NT</span><span><b>Noor Traders</b><small>${S.pendingWrites ? `<span class="sync-pill">${icon('clock', 13)} ${S.pendingWrites} entry server par ja rahi</span>` : 'Hazri register'}</small></span></div>
        <nav class="tabs" aria-label="Hisse">${tabs.map(([k, label, ic]) => `<button type="button" data-action="tab" data-arg="${k}" aria-current="${ui.tab === k ? 'page' : 'false'}">${icon(ic, 22)}<span>${label}</span>${k === 'staff' && pend ? `<em class="badge">${pend}</em>` : ''}</button>`).join('')}</nav>
        <button type="button" class="search-btn" data-action="search">${icon('search', 18)}<span>Talash: naam, "late is hafte"…</span></button>
      </div></header>
      <main class="view view-${ui.tab}">${!S.loaded.has('staff') ? '<p class="loading-line">Data aa raha hai…</p>' : ''}${ui.tab === 'hazri' ? hazriTab() : ui.tab === 'salary' ? salaryTab() : staffTab()}</main>`;
  }
  return { render, actions, forms, changes, inputs, ui, onData() { refreshSheets(); } };
}
