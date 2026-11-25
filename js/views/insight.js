// «وين مقصّر هالأسبوع» والمجالات: من سجلّك الحقيقي، مع مقارنة بنفس الأيام من الأسبوع الماضي
import { h, icon, bar, toast } from '../ui.js';
import { store } from '../store.js';
import { PRAYERS, PRAYER_NAMES, adhanFor, nowMinOfLogical } from '../prayer.js';
import { addDays, weekStartOf, toMin, daysText, countText, inDaysText, daysBetween } from '../dates.js';
import { tasksOn, isDoneOn } from '../tasks.js';
import { prayerOn, pagesReadOn, adhkarDone, adhkarSettings, allAdhkarLists, wirdToday } from '../worship.js';
import { activeHabits, habitScore, passThreshold } from '../habits.js';
import { shiftOn } from '../shifts.js';
import { muhasabaDone, openMuhasaba } from './muhasaba.js';
import { openKhatma } from './khatma.js';
import { openExam, EXAM_KINDS } from './study.js';
import { planExam } from './exams.js';
import { plannedUnits } from '../libitems.js';

// النقاط اللي سكّرتها هالأسبوع (بالـ×): بتختفي لحد الأسبوع الجاي
const offKeys = (ws) => new Set(store.state.weakOff?.[ws] || []);
function hideWeak(ws, key) {
  store.update((s) => {
    const all = { ...(s.weakOff || {}) };
    for (const k of Object.keys(all)) if (k < addDays(ws, -21)) delete all[k];
    all[ws] = [...new Set([...(all[ws] || []), key])];
    s.weakOff = all;
  });
}

const ON_TIME = new Set(['ontime', 'jamaah', 'sunnah']);
const range = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };

// كم صلاة صار وقتها بيوم (اليوم: لحد هلّق)
function duePrayers(d, today) {
  if (d < today) return PRAYERS;
  const a = adhanFor(d), now = nowMinOfLogical();
  return PRAYERS.filter((k) => k === 'fajr' || toMin(a[k]) <= now);
}

/* ---------- المجالات ---------- */
const AREAS = [
  { key: 'prayers', short: 'الصلوات', name: 'الصلوات بوقتها', ic: 'mosque', c: '#35b791', go: 'tracks/worship' },
  { key: 'quran', short: 'الختمة', name: 'القرآن', ic: 'quran', c: '#35b791', run: () => openKhatma() },
  { key: 'adhkar', short: 'الأذكار', name: 'الأذكار', ic: 'hands', c: '#35b791', go: 'tracks/worship' },
  { key: 'study', short: 'الدراسة', name: 'الدراسة', ic: 'grad', c: '#4a9ee0', go: 'tracks/study', tags: ['study'] },
  { key: 'series', short: 'السلاسل', name: 'فقه النفس والسلاسل', ic: 'spa', c: '#a682e8', go: 'tracks/series', tags: ['self', 'series'] },
  { key: 'books', short: 'الكتب', name: 'الكتب', ic: 'book', c: '#c08a4e', go: 'tracks/books', tags: ['book'] },
  { key: 'habits', short: 'السلوك', name: 'السلوك', ic: 'compass', c: '#7bc39a', go: 'tracks/habits' },
  { key: 'sport', short: 'الرياضة', name: 'الرياضة', ic: 'dumbbell', c: '#e0705f', go: 'tracks/sport' },
];

function areaOn(a, days, today) {
  const s = store.state;
  let done = 0, total = 0, sub = '';
  if (a.key === 'prayers') {
    for (const d of days) for (const k of duePrayers(d, today)) { total += 1; if (ON_TIME.has(prayerOn(d, k))) done += 1; }
    sub = `${done} من ${total}`;
  } else if (a.key === 'quran') {
    const per = wirdToday(today).target || s.settings.quranDaily || 10;
    for (const d of days) done += pagesReadOn(d);
    total = per * days.length;
    if (!s.quran.plan && !s.quran.core && !done) total = 0;
    sub = `${done} من ${total} ص`;
  } else if (a.key === 'adhkar') {
    const lists = allAdhkarLists().filter((l) => adhkarSettings(l.id).enabled);
    for (const d of days) for (const l of lists) { total += 1; if (adhkarDone(d, l.id)) done += 1; }
    sub = `${done} من ${total}`;
  } else if (a.tags) {
    for (const d of days) for (const t of tasksOn(d)) if (a.tags.includes(t.tag)) { total += 1; if (isDoneOn(t, d)) done += 1; }
    sub = `${done} من ${total}`;
  } else if (a.key === 'habits') {
    let sum = 0, n = 0;
    for (const d of days) for (const hb of activeHabits()) { const sc = habitScore(d, hb.id); if (sc != null) { sum += sc; n += 1; } }
    if (n) { done = sum; total = n; }
    sub = n ? `متوسط ${Math.round((sum / n) * 100)}%` : '';
  } else if (a.key === 'sport') {
    const per = Number(s.sport.profile?.daysPerWeek) || 0;
    done = (s.sport.workouts || []).filter((w) => w.d >= days[0] && w.d <= days[days.length - 1]).length;
    total = per ? Math.max(1, Math.round((per * days.length) / 7)) : (done ? done : 0);
    sub = `${done} من ${total} تمارين`;
  }
  return { ...a, done, total, pct: total ? Math.min(1, done / total) : null, sub };
}

export function areaStats(today) {
  const ws = weekStartOf(today);
  const days = range(ws, today);
  const prevDays = days.map((d) => addDays(d, -7));
  return AREAS.map((a) => {
    const cur = areaOn(a, days, today);
    const prev = areaOn(a, prevDays, today);
    return { ...cur, prevPct: prev.pct };
  }).filter((x) => x.total > 0);
}

/* ---------- وين مقصّر ---------- */
export function weakTop(today) {
  const s = store.state;
  const ws = weekStartOf(today);
  const past = range(ws, addDays(today, -1));
  const out = [];
  // الصلوات: أكتر صلاة فاتت (من الأيام اللي سجّلت فيها)
  const logged = past.filter((d) => PRAYERS.some((k) => prayerOn(d, k)));
  let worst = null;
  for (const k of PRAYERS) {
    const miss = logged.filter((d) => !ON_TIME.has(prayerOn(d, k)));
    if (miss.length >= 2 && (!worst || miss.length > worst.miss.length)) worst = { k, miss };
  }
  if (worst) {
    const work = worst.miss.filter((d) => shiftOn(d)?.kind === 'work').length;
    out.push({
      key: `pr:${worst.k}`,
      sev: worst.miss.length / Math.max(1, logged.length) + (worst.k === 'fajr' ? 0.15 : 0.1),
      t: `صلاة ${PRAYER_NAMES[worst.k]} بوقتها ${logged.length - worst.miss.length} من ${logged.length}`,
      s: work ? `${work === worst.miss.length ? 'كل اللي فاتوا' : `${work} من اللي فاتوا`} بأيام الشغل` : `فاتتك ${countText(worst.miss.length, ['مرة', 'مرتين', 'مرات', 'مرة'])} هالأسبوع`,
      fix: worst.k === 'fajr' ? { ic: 'moon', label: 'رتّب نومك على دورات', go: 'settings/sleep' } : { ic: 'mosque', label: 'افتح الصلوات', go: 'tracks/worship' },
    });
  }
  // مذاكرة قريبة وفيها محاضرات ما خلصت — واللي انوزّعت كمهام على أيامك ما عادت تقصير
  const planned = plannedUnits();
  for (const e of s.exams || []) {
    const n = daysBetween(today, e.date);
    if (n < 0 || n > 10) continue;
    const sj = s.subjects.find((x) => x.id === e.subjectId);
    const lects = (sj?.lectures || []).filter((l) => e.lectureIds?.includes(l.id) && (l.mastery || 0) < 75 && !planned.has(l.id));
    if (!lects.length) continue;
    out.push({
      key: `ex:${e.id}`,
      // المذاكرة القريبة أهم شي: كل ما قربت وكتر الباقي بتطلع لفوق
      sev: 0.8 + Math.min(0.5, lects.length / Math.max(1, n + 1) / 2),
      t: `${sj.name}: باقي ${countText(lects.length, ['محاضرة', 'محاضرتين', 'محاضرات', 'محاضرة'])} ما انوزّعت`,
      s: `${EXAM_KINDS[e.kind] || 'الامتحان'} ${inDaysText(n)}`,
      fix: n > 0 ? { ic: 'wand', label: 'وزّعهم على الأيام', run: () => planExam(e, lects, today) } : { ic: 'calendar-check', label: 'افتح المذاكرة', run: () => openExam(e.id) },
    });
  }
  // المجالات الضعيفة
  for (const a of areaStats(today)) {
    if (a.key === 'prayers' || a.pct == null || a.pct >= 0.6 || a.total < 2) continue;
    if (a.key === 'quran') {
      const w = wirdToday(today);
      out.push({ key: 'ar:quran', sev: 1 - a.pct, t: `ورد القرآن ${a.done} من ${a.total} صفحة`, s: w.plan ? `الختمة متأخرة — الورد اليومي صار ${w.target}` : 'هالأسبوع لحد هلّق', fix: { ic: 'quran', label: 'افتح الختمة', run: () => openKhatma() } });
    } else if (a.key === 'habits') {
      const th = passThreshold();
      let low = null;
      for (const hb of activeHabits()) { const n = past.filter((d) => { const sc = habitScore(d, hb.id); return sc != null && sc < th; }).length; if (n >= 2 && (!low || n > low.n)) low = { hb, n }; }
      if (low) out.push({ key: `hb:${low.hb.id}`, sev: 1 - a.pct, t: `${low.hb.name} تحت الحد ${daysText(low.n)}`, s: `متوسط السلوك ${Math.round(a.pct * 100)}%`, fix: { ic: 'compass', label: 'افتح السلوك', go: 'tracks/habits' } });
    } else {
      out.push({ key: `ar:${a.key}`, sev: (1 - a.pct) * 0.9, t: `${a.name}: ${a.sub}`, s: a.prevPct != null && a.prevPct > a.pct ? `الأسبوع الماضي كانت ${Math.round(a.prevPct * 100)}%` : 'هالأسبوع لحد هلّق', fix: { ic: a.ic, label: `افتح ${a.short}`, go: a.go } });
    }
  }
  // محاسبة النفس
  if (past.length >= 3) {
    const nights = past.filter((d) => muhasabaDone(d)).length;
    if (nights < past.length / 2) out.push({ key: 'mh', sev: 0.35, t: `محاسبة النفس ${nights} من ${past.length} ليالي`, s: 'دقيقتين قبل النوم بيفرقوا', fix: { ic: 'feather', label: 'حاسب حالك الليلة', run: () => openMuhasaba(today) } });
  }
  const off = offKeys(ws);
  return out.filter((x) => !off.has(x.key)).sort((a, b) => b.sev - a.sev).slice(0, 3);
}

export function strengthsOf(today) {
  const ws = weekStartOf(today);
  const days = range(ws, today);
  const out = [];
  const past = days.filter((d) => d < today);
  if (past.length >= 2) {
    for (const k of PRAYERS) if (past.every((d) => ON_TIME.has(prayerOn(d, k)))) out.push(`${PRAYER_NAMES[k]} ${past.length}/${past.length}`);
    for (const l of allAdhkarLists()) if (adhkarSettings(l.id).enabled && past.every((d) => adhkarDone(d, l.id))) out.push(`${l.short || l.name} كل يوم`);
    const nights = past.filter((d) => muhasabaDone(d)).length;
    if (nights >= Math.max(2, past.length - 1)) out.push(`المحاسبة ${nights} ليالي`);
  }
  for (const a of areaStats(today)) if (a.pct != null && a.pct >= 0.9 && a.total >= 3 && a.key !== 'prayers') out.push(`${a.name} ${Math.round(a.pct * 100)}%`);
  return out.slice(0, 5);
}

/* ---------- العرض ---------- */
const colorOf = (p) => (p >= 0.75 ? '#35b791' : p >= 0.5 ? '#d99a45' : '#d05454');

export function weakCard(ctx) {
  const today = ctx.today;
  const top = weakTop(today);
  const runFix = (f) => (f.run ? f.run() : ctx.open(f.go));
  if (!top.length) {
    return h('div', { class: 'wm ok' },
      h('h3', null, icon('star', 15), 'ماشي منيح هالأسبوع'),
      h('p', { class: 'wm-sub' }, 'ما لقينا شي واضح مقصّر فيه لحد هلّق — كمّل هيك، والله يبارك.'));
  }
  return h('div', { class: 'wm' },
    h('h3', null, icon('magnifying-glass-chart', 15), 'وين مقصّر هالأسبوع'),
    h('p', { class: 'wm-sub' }, 'من سجلّك — بصراحة ومن غير جلد للذات'),
    h('div', { class: 'wm-list' }, top.map((x, i) => h('div', { class: 'wm-it' },
      h('span', { class: 'wm-n num' }, String(i + 1)),
      h('div', null, h('b', null, x.t), h('small', null, x.s),
        x.fix ? h('button', { type: 'button', class: 'wm-fix', onclick: () => runFix(x.fix) }, icon(x.fix.ic, 11), x.fix.label) : null),
      // سكّرها لهالأسبوع (مثلاً إذا عالجتها بطريقة تانية)
      x.key ? h('button', { type: 'button', class: 'wm-x', 'aria-label': 'خبّيها لهالأسبوع', onclick: () => { const ws = weekStartOf(today); hideWeak(ws, x.key); toast('انخبّت لهالأسبوع', { action: 'تراجع', onAction: () => store.update((s) => { s.weakOff = { ...(s.weakOff || {}), [ws]: (s.weakOff?.[ws] || []).filter((k) => k !== x.key) }; }) }); } }, icon('close', 11)) : null))));
}

export function areasCard(ctx) {
  const today = ctx.today;
  const list = areaStats(today);
  const good = strengthsOf(today);
  if (!list.length) return null;
  return h('div', { class: 'group ar-card' },
    h('div', { class: 'ar-list' }, list.map((a) => {
      const pct = a.pct ?? 0;
      const delta = a.prevPct == null ? null : Math.round((pct - a.prevPct) * 100);
      return h('button', { type: 'button', class: 'ar', style: { '--c': a.c }, onclick: () => (a.run ? a.run() : ctx.open(a.go)) },
        h('span', { class: 'ar-ic' }, icon(a.ic, 13)),
        h('span', { class: 'ar-mid' }, h('span', { class: 'ar-nm' }, h('span', null, a.name), h('small', null, a.sub)),
          h('span', { class: 'ar-bar' }, h('i', { style: { width: `${Math.round(pct * 100)}%`, background: colorOf(pct) } }))),
        h('span', { class: 'ar-pc' }, h('b', { class: 'num' }, `${Math.round(pct * 100)}%`),
          delta == null ? null : h('small', { class: delta > 0 ? 'up' : delta < 0 ? 'dn' : '' }, delta ? [icon(delta > 0 ? 'arrow-up' : 'arrow-down', 9), ` ${Math.abs(delta)}`] : '=')));
    })),
    good.length ? h('div', { class: 'ar-good' }, good.map((g) => h('span', null, icon('star', 10), g))) : null);
}
