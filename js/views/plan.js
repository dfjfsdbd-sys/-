// الخطة: الأسبوع (يوم يوم مع التقدّم)، الشهر (تقويم بالنوبات والمواعيد)، والأهداف
import { h, icon, badge, ring, bar, fill, openSheet, toast, haptic, segmented } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday, PERIOD_SKY } from '../prayer.js';
import { tasksOn, isDoneOn, sortTasks, dayTaskStats, deadlines } from '../tasks.js';
import { MONTHS, SHORT_MONTHS, weekStartOf, weekDates, weekLabel, addDays, parseISO, WEEKDAYS, WEEK_SHORT, WEEK_START, monthLabel, addMonths, daysInMonth, iso, dayLabel, shortDate, daysBetween, time12, tasksText, inDaysText } from '../dates.js';
import { shiftOn, SHIFT_NAMES, nextShiftStart } from '../shifts.js';
import { dayVerdict, commitActive } from '../commit.js';
import { prayersDone } from '../worship.js';
import { pointsBetween } from '../rewards.js';
import { taskRow, secTitle } from './components.js';
import { openTaskSheet, openCapture } from './capture.js';
import { openDaySheet } from './daysheet.js';
import { renderGoalsInline } from './goals.js';
import { examsBetween, openExam } from './study.js';
import { EVENT_KINDS, eventsOn, bigEvents } from '../events.js';
import { openEventForm } from './eventform.js';
import { openWeekReview, reviewDone } from './review.js';
import { openActions } from '../ui.js';
import { renderProjectsInline } from './projects.js';

let mode = 'week';
let weekStart = null;
let month = null;

export function renderPlan(ctx) {
  const today = ctx.today;
  if (!weekStart) weekStart = weekStartOf(today);
  if (!month) month = today.slice(0, 7);
  const root = h('div', { class: 'plan' });
  root.append(h('header', { class: 'page-head' }, h('h1', null, 'التخطيط'),
    h('div', { class: 'head-actions' }, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'أضف', onclick: () => openActions('أضف', [{ icon: 'plus', label: 'مهمة', run: () => openCapture() }, { icon: 'calendar-plus', label: 'حدث (موعد، مناسبة، سفر)', run: () => openEventForm(null, {}) }]) }, icon('plus', 20)))));
  root.append(h('div', { style: { padding: '4px 16px 0' } }, segmented([{ value: 'week', label: 'الأسبوع' }, { value: 'month', label: 'الشهر' }, { value: 'year', label: 'السنة' }, { value: 'goals', label: 'الأهداف' }, { value: 'projects', label: 'المشاريع' }], mode, (v) => { mode = v; ctx.refresh(); })));
  if (mode === 'week') root.append(weekView(ctx, today));
  else if (mode === 'month') root.append(monthView(ctx, today));
  else if (mode === 'year') root.append(yearView(ctx, today));
  else if (mode === 'projects') root.append(renderProjectsInline(ctx));
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
    weekStart <= today ? h('button', { type: 'button', class: `rv-open${reviewDone(weekStart) ? ' done' : ''}`, onclick: () => openWeekReview(weekStart) },
      icon(reviewDone(weekStart) ? 'check' : 'calendar-check', 14), reviewDone(weekStart) ? 'راجعت هالأسبوع — افتح المراجعة' : 'مراجعة الأسبوع: أرقامك، وين قصّرت، والجاي', icon('chevL', 12)) : null,
    ex.length ? h('div', { class: 'group rows', style: { marginTop: '10px' } }, ex.map((e) => examRow(e, today))) : null,
    h('div', { class: 'wk-days' }, days.map((d) => dayCard(ctx, d, today))));
}

function examRow(e, today) {
  const n = daysBetween(today, e.date);
  return h('button', { type: 'button', class: 'row', onclick: () => openExam(e.id) },
    badge('grad', 'sky', 36),
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, `${e.kindLabel}: ${e.subjectName}`), h('span', { class: 'row-sub' }, `${dayLabel(e.date, today)}${e.time ? ` ${time12(e.time)}` : ''} — ${e.lectures} محاضرة`)),
    h('span', { class: `pill ${n <= 3 ? 'warn' : 'accent'}` }, n >= 0 ? inDaysText(n) : 'مضى'));
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
    eventsOn(d).length ? h('div', { class: 'dc-evs' }, eventsOn(d).map((e) => h('button', { type: 'button', class: 'dc-ev', style: { '--c': evColor(e) }, onclick: () => openEv(e) }, icon((EVENT_KINDS[e.kind] || EVENT_KINDS.other).icon, 11), e.title, e.time ? h('small', null, time12(e.time)) : null))) : null,
    list.length ? h('div', { class: 'trows' }, list.slice(0, 6).map((t) => taskRow(t, d, { onOpen: (x) => openTaskSheet(x.id, d), today, compact: true }))) : null,
    list.length > 6 ? h('button', { type: 'button', class: 'dc-more', onclick: () => openDaySheet(d) }, `+${list.length - 6} كمان`) : null,
    past ? null : h('button', { type: 'button', class: 'dc-add', onclick: () => openCapture({ date: d }) }, icon('plus', 15), 'أضف'));
}

/* ---------- الشهر: الأحداث بأسمائها، والنوبات، ولوح اليوم تحت ---------- */
let selDay = null;
function evColor(e) { return e.kind === 'commit' ? '#35b791' : e.kind === 'ramadan' ? '#35b791' : (EVENT_KINDS[e.kind] || EVENT_KINDS.other).color; }
function openEv(e) { if (e.source === 'exam') openExam(e.id); else if (e.source === 'event') openEventForm(e.id); }

function monthView(ctx, today) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() - WEEK_START + 7) % 7;
  const dim = daysInMonth(y, m - 1);
  if (!selDay || selDay.slice(0, 7) !== month) selDay = month === today.slice(0, 7) ? today : `${month}-01`;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(h('span', { class: 'mc3 out' }));
  for (let dd = 1; dd <= dim; dd++) {
    const d = iso(new Date(y, m - 1, dd));
    const sh = shiftOn(d);
    const evs = eventsOn(d);
    const st = dayTaskStats(d, today);
    const past = d < today;
    const v = commitActive() ? dayVerdict(d) : 'future';
    cells.push(h('button', {
      type: 'button', class: `mc3${d === today ? ' td' : ''}${d === selDay ? ' sel' : ''}${past ? ' past' : ''}${sh ? ` sh-${sh.kind}` : ''}`,
      onclick: () => { selDay = d; haptic('select'); ctx.refresh(); },
    },
    h('b', { class: 'num' }, String(dd), v === 'done' ? h('i', { class: 'mc3-v ok' }) : v === 'broken' ? h('i', { class: 'mc3-v no' }) : null),
    evs.slice(0, 2).map((e) => h('span', { class: `mc3-ev${e.span ? ` span${e.first ? ' s' : ''}${e.last ? ' e' : ''}` : ''}`, style: { '--c': evColor(e) } }, e.span && !e.first && (parseISO(d).getDay() !== WEEK_START) ? ' ' : e.title)),
    evs.length > 2 ? h('small', { class: 'mc3-more' }, `+${evs.length - 2}`) : null,
    !evs.length && st.total ? h('small', { class: `mc3-cnt${past && st.done < st.total ? ' warn' : ''}` }, past ? `${st.done}/${st.total}` : `${st.total} مهام`) : null));
  }
  return h('div', null,
    h('div', { class: 'wk-nav' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الشهر السابق', onclick: () => { month = addMonths(month, -1); ctx.refresh(); } }, icon('chevR', 20)),
      h('button', { type: 'button', class: 'wk-label', onclick: () => { month = today.slice(0, 7); selDay = today; ctx.refresh(); } }, h('b', null, monthLabel(month)), h('small', null, month === today.slice(0, 7) ? 'هذا الشهر' : 'اضغط للرجوع لهالشهر')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الشهر الجاي', onclick: () => { month = addMonths(month, 1); ctx.refresh(); } }, icon('chevL', 20))),
    h('div', { class: 'mc3-wrap' },
      h('div', { class: 'mc3-grid mc3-week' }, Array.from({ length: 7 }, (_, i) => h('span', null, WEEK_SHORT[(WEEK_START + i) % 7]))),
      h('div', { class: 'mc3-grid' }, cells),
      h('div', { class: 'mc3-legend' },
        store.state.settings.shift?.enabled ? [h('span', null, h('i', { style: { background: 'rgba(53,183,145,.55)' } }), 'بالبيت'), h('span', null, h('i', { style: { background: 'rgba(224,160,74,.75)' } }), 'بالشغل')] : null,
        Object.entries(EVENT_KINDS).filter(([k]) => k !== 'other').map(([, v]) => h('span', null, h('i', { style: { background: v.color } }), v.name)))),
    dayPanel(ctx, selDay, today));
}

function dayPanel(ctx, d, today) {
  const evs = eventsOn(d);
  const list = sortTasks(tasksOn(d), d);
  const sh = shiftOn(d);
  let shPill = null;
  if (sh) shPill = sh.kind === 'home' && sh.last ? h('span', { class: 'pill warn' }, 'يوم التجهيز') : h('span', { class: `pill ${sh.kind === 'work' ? 'warn' : 'good'}` }, `${SHIFT_NAMES[sh.kind]} ${sh.dayNo}/${sh.length}`);
  return h('section', { class: 'dp3' },
    h('div', { class: 'dp3-h' }, h('b', null, `${WEEKDAYS[parseISO(d).getDay()]} ${parseISO(d).getDate()} ${MONTHS[parseISO(d).getMonth()]}`), shPill,
      h('span', { class: 'muted' }, list.length ? `${list.length} مهام` : ''),
      h('button', { type: 'button', class: 'link-btn', onclick: () => openDaySheet(d) }, 'التفاصيل')),
    evs.map((e) => h('button', { type: 'button', class: 'dp3-row', style: { '--c': evColor(e) }, onclick: () => openEv(e) },
      h('span', { class: 'dp3-k' }, (EVENT_KINDS[e.kind] || EVENT_KINDS.other).name), h('span', { class: 'dp3-t' }, e.title), h('small', null, e.time ? time12(e.time) : e.span ? 'سفر' : ''))),
    list.length ? h('div', { class: 'trows' }, list.map((t) => taskRow(t, d, { onOpen: (x) => openTaskSheet(x.id, d), today }))) : (!evs.length ? h('p', { class: 'muted', style: { padding: '4px 2px 8px' } }, d < today ? 'ما كان في شي بهاليوم.' : 'فاضي — خطط إله.') : null),
    d >= today ? h('div', { class: 'dp3-add' },
      h('button', { type: 'button', onclick: () => openCapture({ date: d }) }, icon('plus', 13), 'مهمة'),
      h('button', { type: 'button', onclick: () => openEventForm(null, { date: d }) }, icon('calendar-plus', 13), 'حدث')) : null);
}

/* ---------- السنة ---------- */
let yearKey = null;
function yearView(ctx, today) {
  if (!yearKey) yearKey = today.slice(0, 4);
  const y = Number(yearKey);
  const boxes = [];
  for (let mi = 0; mi < 12; mi++) {
    const mk = `${y}-${String(mi + 1).padStart(2, '0')}`;
    const dim = daysInMonth(y, mi);
    const off = (new Date(y, mi, 1).getDay() - WEEK_START + 7) % 7;
    let n = 0;
    const cells = [];
    for (let i = 0; i < off; i++) cells.push(h('i', { class: 'x' }));
    for (let dd = 1; dd <= dim; dd++) {
      const d = iso(new Date(y, mi, dd));
      const evs = eventsOn(d);
      if (evs.length) n += evs.filter((e) => !e.span || e.first).length;
      const sh = shiftOn(d);
      cells.push(h('i', { class: `${sh?.kind === 'work' ? 'w' : ''}${evs.length ? ' e' : ''}${d === today ? ' t' : ''}`, style: evs.length ? { '--c': evColor(evs[0]) } : null }));
    }
    boxes.push(h('button', { type: 'button', class: `ym3${mk === today.slice(0, 7) ? ' cur' : ''}`, onclick: () => { month = mk; mode = 'month'; selDay = mk === today.slice(0, 7) ? today : `${mk}-01`; ctx.refresh(); } },
      h('span', { class: 'ym3-h' }, h('b', null, MONTHS[mi]), n ? h('small', null, `${n} ${n === 1 ? 'حدث' : 'أحداث'}`) : null),
      h('span', { class: 'ym3-g' }, cells)));
  }
  const big = bigEvents(today, 400);
  return h('div', null,
    h('div', { class: 'wk-nav' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'السنة السابقة', onclick: () => { yearKey = String(y - 1); ctx.refresh(); } }, icon('chevR', 20)),
      h('button', { type: 'button', class: 'wk-label', onclick: () => { yearKey = today.slice(0, 4); ctx.refresh(); } }, h('b', null, String(y)), h('small', null, yearKey === today.slice(0, 4) ? 'هالسنة' : 'اضغط للرجوع')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'السنة الجاية', onclick: () => { yearKey = String(y + 1); ctx.refresh(); } }, icon('chevL', 20))),
    h('div', { class: 'ym3-grid' }, boxes),
    secTitle('الأحداث الكبيرة الجاية', { ic: 'flag', count: big.length || null, action: h('button', { type: 'button', class: 'link-btn', onclick: () => openEventForm(null, { kind: 'occasion' }) }, icon('plus', 14), 'حدث') }),
    big.length ? h('div', { class: 'big-list' }, big.slice(0, 12).map((e) => {
      const c = evColor(e);
      const ic = e.kind === 'commit' ? 'seedling' : e.kind === 'ramadan' ? 'moon' : (EVENT_KINDS[e.kind] || EVENT_KINDS.other).icon;
      const dt = parseISO(e.date);
      return h('button', { type: 'button', class: 'big-ev', style: { '--c': c }, onclick: () => (e.source === 'commit' ? ctx.go('progress/commit') : openEv(e)) },
        h('span', { class: 'be-d' }, h('b', { class: 'num' }, String(dt.getDate())), h('small', null, SHORT_MONTHS[dt.getMonth()])),
        h('span', { class: 'be-in' }, h('b', null, e.title), h('small', null, `${inDaysText(e.inDays)}${e.lectures ? ` · ${e.lectures} محاضرة` : ''}`)),
        h('span', { class: 'be-ic' }, icon(ic, 15)));
    })) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'ما في أحداث كبيرة جاية. أضف مناسبة أو سفر أو امتحان.'))));
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
        h('p', { class: 'hint' }, work ? `نوبة الشغل الجاية ${dayLabel(work, logicalToday())} — جهّزت ${done} من ${c.items.length}` : 'فعّل النوبات من الروتين مشان القائمة تطلع لحالها قبل كل نوبة.'),
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
