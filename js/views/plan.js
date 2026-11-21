// الخطة: الأسبوع (يوم يوم مع التقدّم)، الشهر (تقويم بالنوبات والمواعيد)، والأهداف
import { h, icon, badge, ring, bar, fill, openSheet, toast, haptic, segmented } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday, PERIOD_SKY } from '../prayer.js';
import { tasksOn, isDoneOn, sortTasks, dayTaskStats, deadlines } from '../tasks.js';
import { weekStartOf, weekDates, weekLabel, addDays, parseISO, WEEKDAYS, WEEK_SHORT, WEEK_START, monthLabel, addMonths, daysInMonth, iso, dayLabel, shortDate, daysBetween, time12, tasksText } from '../dates.js';
import { shiftOn, SHIFT_NAMES, nextShiftStart } from '../shifts.js';
import { dayVerdict, commitActive } from '../commit.js';
import { prayersDone } from '../worship.js';
import { pointsBetween } from '../rewards.js';
import { taskRow, secTitle } from './components.js';
import { openTaskSheet, openCapture } from './capture.js';
import { openDaySheet } from './daysheet.js';
import { renderGoalsInline } from './goals.js';
import { examsBetween, openExam } from './study.js';

let mode = 'week';
let weekStart = null;
let month = null;

export function renderPlan(ctx) {
  const today = ctx.today;
  if (!weekStart) weekStart = weekStartOf(today);
  if (!month) month = today.slice(0, 7);
  const root = h('div', { class: 'plan' });
  root.append(h('header', { class: 'page-head' }, h('h1', null, 'الخطة'),
    h('div', { class: 'head-actions' }, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'أضف مهمة', onclick: () => openCapture() }, icon('plus', 20)))));
  root.append(h('div', { style: { padding: '4px 16px 0' } }, segmented([{ value: 'week', label: 'الأسبوع' }, { value: 'month', label: 'الشهر' }, { value: 'goals', label: 'الأهداف' }], mode, (v) => { mode = v; ctx.refresh(); })));
  if (mode === 'week') root.append(weekView(ctx, today));
  else if (mode === 'month') root.append(monthView(ctx, today));
  else root.append(renderGoalsInline(ctx));
  return root;
}
export function planActions() { return null; }

/* ---------- الأسبوع ---------- */
function weekView(ctx, today) {
  const days = weekDates(weekStart);
  const isThis = weekStart === weekStartOf(today);
  let total = 0, done = 0, commitDone = 0, commitDays = 0;
  for (const d of days) {
    const st = dayTaskStats(d, today); total += st.total; done += st.done;
    if (commitActive()) { const v = dayVerdict(d); if (v !== 'future') { commitDays += 1; if (v === 'done') commitDone += 1; } }
  }
  const pts = pointsBetween(days[0], days[6]);
  const ex = examsBetween(days[0], days[6]);
  return h('div', null,
    h('div', { class: 'wk-nav' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الأسبوع السابق', onclick: () => { weekStart = addDays(weekStart, -7); ctx.refresh(); } }, icon('chevR', 20)),
      h('button', { type: 'button', class: 'wk-label', onclick: () => { weekStart = weekStartOf(today); ctx.refresh(); } }, h('b', null, weekLabel(weekStart)), h('small', null, isThis ? 'هذا الأسبوع' : weekStart > today ? 'جاي' : 'مضى')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الأسبوع الجاي', onclick: () => { weekStart = addDays(weekStart, 7); ctx.refresh(); } }, icon('chevL', 20))),
    h('div', { class: 'wk-summary' },
      ring(total ? done / total : 0, 58, { stroke: 5, label: total ? `${Math.round((done / total) * 100)}%` : '—' }),
      h('div', { class: 'wk-stats' },
        h('div', null, h('b', { class: 'num' }, `${done}/${total}`), h('small', null, 'مهام')),
        commitActive() ? h('div', null, h('b', { class: 'num' }, `${commitDone}/${commitDays || 0}`), h('small', null, 'أيام تعهّد')) : null,
        h('div', null, h('b', { class: 'num gold-text' }, `${pts}`), h('small', null, 'نقطة')))),
    ex.length ? h('div', { class: 'group rows', style: { marginTop: '10px' } }, ex.map((e) => examRow(e, today))) : null,
    h('div', { class: 'wk-days' }, days.map((d) => dayCard(ctx, d, today))));
}

function examRow(e, today) {
  const n = daysBetween(today, e.date);
  return h('button', { type: 'button', class: 'row', onclick: () => openExam(e.id) },
    badge('grad', 'sky', 36),
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, `${e.kindLabel}: ${e.subjectName}`), h('span', { class: 'row-sub' }, `${dayLabel(e.date, today)}${e.time ? ` ${time12(e.time)}` : ''} — ${e.lectures} محاضرة`)),
    h('span', { class: `pill ${n <= 3 ? 'warn' : 'accent'}` }, n === 0 ? 'اليوم' : n > 0 ? `بعد ${n} يوم` : 'مضى'));
}

function dayCard(ctx, d, today) {
  const list = sortTasks(tasksOn(d), d);
  const st = dayTaskStats(d, today);
  const sh = shiftOn(d);
  const past = d < today;
  const v = commitActive() ? dayVerdict(d) : 'future';
  const pd = past ? prayersDone(d) : null;
  return h('section', { class: `day-card${d === today ? ' today' : ''}${past ? ' past' : ''}${sh ? ` sh-${sh.kind}` : ''}` },
    h('button', { type: 'button', class: 'dc-head', onclick: () => openDaySheet(d) },
      h('span', { class: 'dc-date' }, h('b', { class: 'num' }, String(parseISO(d).getDate())), h('small', null, WEEKDAYS[parseISO(d).getDay()])),
      h('span', { class: 'dc-info' },
        h('span', null, d === today ? h('span', { class: 'pill accent' }, 'اليوم') : null, sh ? h('span', { class: `pill ${sh.kind === 'work' ? 'warn' : 'good'}` }, icon(sh.kind === 'work' ? 'briefcase' : 'house', 11), SHIFT_NAMES[sh.kind]) : null,
          v === 'done' ? h('span', { class: 'pill good' }, icon('check', 11), 'تعهّد') : v === 'broken' ? h('span', { class: 'pill bad' }, 'تعهّد ناقص') : null,
          pd != null ? h('span', { class: 'pill' }, icon('mosque', 11), `${pd}/5`) : null),
        st.total ? bar(st.done / st.total, { cls: `thin ${st.done === st.total ? 'good' : ''}` }) : null),
      h('span', { class: 'dc-count num' }, st.total ? `${st.done}/${st.total}` : '')),
    list.length ? h('div', { class: 'trows' }, list.slice(0, 6).map((t) => taskRow(t, d, { onOpen: (x) => openTaskSheet(x.id, d), today, compact: true }))) : null,
    list.length > 6 ? h('button', { type: 'button', class: 'dc-more', onclick: () => openDaySheet(d) }, `+${list.length - 6} كمان`) : null,
    past ? null : h('button', { type: 'button', class: 'dc-add', onclick: () => openCapture({ date: d }) }, icon('plus', 15), 'أضف'));
}

/* ---------- الشهر ---------- */
function monthView(ctx, today) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() - WEEK_START + 7) % 7;
  const dim = daysInMonth(y, m - 1);
  const from = `${month}-01`, to = `${month}-${String(dim).padStart(2, '0')}`;
  const exams = examsBetween(from, to);
  const examDays = new Set(exams.map((e) => e.date));
  const dueDays = new Set(store.state.tasks.filter((t) => t.due && !t.done).map((t) => t.due));
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(h('span'));
  for (let dd = 1; dd <= dim; dd++) {
    const d = iso(new Date(y, m - 1, dd));
    const sh = shiftOn(d);
    const st = dayTaskStats(d, today);
    const past = d < today;
    const v = commitActive() ? dayVerdict(d) : 'future';
    const rate = st.total ? st.done / st.total : null;
    cells.push(h('button', {
      type: 'button', class: `mc-day${d === today ? ' today' : ''}${past ? ' past' : ''}${sh ? ` sh-${sh.kind}` : ''}${v === 'done' ? ' v-done' : v === 'broken' ? ' v-broken' : ''}`,
      onclick: () => openDaySheet(d),
    },
    h('b', { class: 'num' }, String(dd)),
    h('span', { class: 'mc-marks' },
      examDays.has(d) ? h('i', { class: 'mk-exam' }) : null,
      dueDays.has(d) ? h('i', { class: 'mk-due' }) : null,
      st.total ? h('i', { class: past ? (rate >= 1 ? 'mk-good' : 'mk-part') : 'mk-task' }) : null),
    st.total && !past ? h('small', { class: 'num' }, String(st.total - st.done)) : null));
  }
  // جدول المواعيد بالشهر
  const agenda = [];
  for (let dd = 1; dd <= dim; dd++) {
    const d = iso(new Date(y, m - 1, dd));
    if (d < today) continue;
    const items = [];
    for (const e of exams.filter((x) => x.date === d)) items.push({ ic: 'grad', tint: 'sky', t: `${e.kindLabel}: ${e.subjectName}`, s: `${e.lectures} محاضرة`, on: () => openExam(e.id) });
    for (const t of store.state.tasks.filter((x) => x.due === d && !x.done)) items.push({ ic: 'flag', tint: 'gold', t: t.title, s: 'آخر موعد', on: () => openTaskSheet(t.id) });
    for (const t of tasksOn(d).filter((x) => !x.recur && !isDoneOn(x, d))) items.push({ ic: 'list', tint: 'slate', t: t.title, s: t.time ? time12(t.time) : '', on: () => openTaskSheet(t.id, d) });
    const sh = shiftOn(d);
    if (sh?.first) items.unshift({ ic: sh.kind === 'work' ? 'briefcase' : 'house', tint: sh.kind === 'work' ? 'amber' : 'mint', t: sh.kind === 'work' ? 'أول يوم نوبة الشغل' : 'أول يوم بالبيت', s: `${sh.length} أيام` });
    if (items.length) agenda.push({ d, items });
  }
  return h('div', null,
    h('div', { class: 'wk-nav' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الشهر السابق', onclick: () => { month = addMonths(month, -1); ctx.refresh(); } }, icon('chevR', 20)),
      h('button', { type: 'button', class: 'wk-label', onclick: () => { month = today.slice(0, 7); ctx.refresh(); } }, h('b', null, monthLabel(month)), h('small', null, month === today.slice(0, 7) ? 'هذا الشهر' : 'اضغط للرجوع لهالشهر')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الشهر الجاي', onclick: () => { month = addMonths(month, 1); ctx.refresh(); } }, icon('chevL', 20))),
    h('div', { class: 'group mc-wrap' },
      h('div', { class: 'mc-grid mc-week' }, Array.from({ length: 7 }, (_, i) => h('span', null, WEEK_SHORT[(WEEK_START + i) % 7]))),
      h('div', { class: 'mc-grid' }, cells),
      h('div', { class: 'mc-legend' },
        store.state.settings.shift?.enabled ? [h('span', null, h('i', { class: 'lg-home' }), 'بالبيت'), h('span', null, h('i', { class: 'lg-work' }), 'بالشغل')] : null,
        h('span', null, h('i', { class: 'mk-task' }), 'مهام'),
        h('span', null, h('i', { class: 'mk-exam' }), 'امتحان'),
        h('span', null, h('i', { class: 'mk-due' }), 'آخر موعد'))),
    secTitle('جدول المواعيد', { ic: 'list' }),
    agenda.length ? h('div', { class: 'group' }, agenda.map(({ d, items }) => [
      h('div', { class: 'agenda-day' }, h('span', null, dayLabel(d, today)), h('span', null, shortDate(d))),
      h('div', { class: 'rows' }, items.map((it) => h('button', { type: 'button', class: 'row', onclick: it.on || (() => openDaySheet(d)) },
        badge(it.ic, it.tint, 32), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, it.t), it.s ? h('span', { class: 'row-sub' }, it.s) : null)))),
    ])) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'ما في مواعيد جاية بهالشهر.'))));
}

/* ---------- قائمة التجهيز قبل النوبة ---------- */
export function ensureDefaultChecklist() {
  if ((store.state.checklists || []).length) return store.state.checklists[0];
  const c = { id: uid('cl'), name: 'أغراض الشغل', trigger: 'beforeWork', items: [], runs: {} };
  store.update((s) => { s.checklists.push(c); });
  return c;
}
export function openChecklistRun(id, day = logicalToday()) {
  if (!id) id = ensureDefaultChecklist().id;
  openSheet('جهّز قبل الشغل', (body, close, { setTitle }) => {
    let editing = false;
    function render() {
      const c = store.state.checklists.find((x) => x.id === id);
      if (!c) { close(); return; }
      setTitle(c.name);
      const work = nextShiftStart(day, 'work');
      const runKey = work || day;
      const run = c.runs?.[runKey] || {};
      const done = c.items.filter((i) => run[i.id]).length;
      const toggle = (iid) => { store.update((s) => { const x = s.checklists.find((y) => y.id === id); x.runs = x.runs || {}; x.runs[runKey] = { ...(x.runs[runKey] || {}), [iid]: !run[iid] }; }); haptic('select'); render(); };
      const input = h('input', { type: 'text', placeholder: 'أضف غرض (مثلاً: الأوراق، الشاحن، الدوا)', onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { const v = e.target.value.trim(); store.update((s) => { s.checklists.find((y) => y.id === id).items.push({ id: uid('ci'), text: v }); }); render(); } } });
      fill(body, [
        h('p', { class: 'hint' }, work ? `نوبة الشغل الجاية ${dayLabel(work, logicalToday())} — جهّزت ${done} من ${c.items.length}` : 'فعّل النوبات من الإعدادات مشان القائمة تطلع لحالها قبل كل نوبة.'),
        c.items.length ? h('div', { class: 'rows sheet-rows' }, c.items.map((i) => h('div', { class: 'row' },
          h('button', { type: 'button', class: `tcheck${run[i.id] ? ' on' : ''}`, onclick: () => toggle(i.id) }, icon('check', 15, { stroke: 2.6 })),
          h('span', { class: `row-main${run[i.id] ? ' dim' : ''}`, onclick: () => toggle(i.id) }, i.text),
          editing ? h('button', { type: 'button', class: 'icon-btn ghost small', 'aria-label': 'شيل', onclick: () => { store.update((s) => { const x = s.checklists.find((y) => y.id === id); x.items = x.items.filter((z) => z.id !== i.id); }); render(); } }, icon('trash', 16)) : null))) : null,
        h('div', { class: 'rows sheet-rows' }, h('div', { class: 'row' }, icon('plus', 18), input)),
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { editing = !editing; render(); } }, editing ? 'خلصت تعديل' : 'عدّل'),
          h('button', { type: 'button', class: 'btn', onclick: () => close() }, done === c.items.length && c.items.length ? 'كله جاهز' : 'تمام')),
      ]);
    }
    render();
  });
}
