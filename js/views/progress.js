// إنجازي: المستوى والنقاط، التعهّد، منحنى الأيام، والأرقام اللي بتفرّح
import { h, icon, badge, ring, bar, fill } from '../ui.js';
import { store } from '../store.js';
import { addDays, parseISO, WEEKDAYS, weekStartOf, durText, daysText, monthLabel, shortDate } from '../dates.js';
import { levelOf, totalPoints, balance, pointsOn, pointsBetween } from '../rewards.js';
import { commitActive, commitStats, dayVerdict, verdictPct, dayDetail } from '../commit.js';
import { dayTaskStats } from '../tasks.js';
import { prayersDone, pagesReadOn, prayerOn } from '../worship.js';
import { activeHabits, habitOk, passThreshold } from '../habits.js';
import { secTitle } from './components.js';
import { openDaySheet } from './daysheet.js';
import { goalPace } from './goals.js';
import { weakCard, areasCard } from './insight.js';

// نسبة يوم شاملة: المهام + الصلوات + العادات (للمنحنى والخريطة)
export function dayScore(d, today) {
  const parts = [];
  const st = dayTaskStats(d, today);
  const lg = store.state.legacyHistory?.[d];
  if (st.total) parts.push(st.done / st.total); else if (lg?.total) parts.push(lg.done / lg.total);
  const pdone = prayersDone(d);
  if (pdone || d <= today) parts.push(pdone / 5);
  const hs = activeHabits();
  if (hs.length) parts.push(hs.filter((x) => habitOk(d, x.id)).length / hs.length);
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function renderProgress(ctx) {
  const today = ctx.today;
  const lv = levelOf(totalPoints());
  const weekFrom = weekStartOf(today);
  const root = h('div', null, h('header', { class: 'page-head' }, h('h1', null, 'الإنجاز'),
    h('div', { class: 'head-actions' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الأوسمة', onclick: () => ctx.open('progress/badges') }, icon('medal', 20)),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'المكافآت', onclick: () => ctx.open('progress/rewards') }, icon('gift', 20)))));
  // وين مقصّر هالأسبوع، والمجالات
  root.append(h('div', { class: 'in-wrap' }, weakCard(ctx)));
  const areas = areasCard(ctx);
  if (areas) root.append(secTitle('المجالات هالأسبوع', { ic: 'chart', action: h('span', { class: 'sec-hint' }, 'مقارنة بالأسبوع الماضي') }), areas);
  // النقاط
  root.append(secTitle('النقاط والمستوى', { ic: 'medal' }), h('div', { class: 'lvl-card' },
    ring(lv.pct, 86, { stroke: 6, color: 'var(--gold)', label: String(lv.level) }),
    h('div', { class: 'lvl-info' },
      h('small', null, `المستوى ${lv.level}`),
      h('strong', null, lv.title),
      h('span', null, `باقي ${lv.need - lv.into} نقطة للمستوى ${lv.level + 1}`),
      bar(lv.pct, { cls: 'gold' })),
    h('div', { class: 'lvl-pts' },
      h('div', null, h('b', { class: 'num good-t' }, `+${pointsOn(today)}`), h('small', null, 'نقاط اليوم')),
      h('div', null, h('b', { class: 'num' }, `+${pointsBetween(weekFrom, today)}`), h('small', null, 'نقاط الأسبوع')),
      h('button', { type: 'button', onclick: () => ctx.open('progress/rewards') }, h('b', { class: 'num gold-t' }, String(balance())), h('small', null, 'رصيد المكافآت', icon('chevL', 10))))));
  // التعهّد
  if (commitActive()) {
    const st = commitStats(today);
    const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    root.append(secTitle('التعهّد', { ic: 'seedling' }), h('button', { type: 'button', class: 'cm-hero', onclick: () => ctx.open('progress/commit') },
      h('div', { class: 'cmh-top' },
        h('div', null, h('small', null, 'تتجهّز لـ'), h('strong', null, store.state.commitment.reward || 'التعهّد')),
        icon('chevL', 18)),
      h('div', { class: 'cmh-nums' },
        h('div', null, h('b', { class: 'num' }, `${st.dayNumber}`), h('small', null, `يوم من ${st.totalDays}`)),
        h('div', null, h('b', { class: 'num good' }, String(st.done + (st.todayDone ? 1 : 0))), h('small', null, 'مكتمل')),
        h('div', null, h('b', { class: 'num bad' }, String(st.broken)), h('small', null, 'ناقص')),
        h('div', null, h('b', { class: 'num' }, String(st.streak)), h('small', null, 'ورا بعض'))),
      bar(st.pct, { cls: 'good' }),
      h('div', { class: 'cm-chain' }, h('small', null, 'آخر 7 أيام'), h('span', null, last7.map((d) => {
        const v = dayVerdict(d);
        return h('i', { class: d === today ? (v === 'done' ? 'y' : 't') : v === 'done' ? 'y' : v === 'broken' ? 'n' : 'x' }, d === today && v !== 'done' ? '؟' : v === 'done' ? icon('check', 9) : v === 'broken' ? icon('close', 9) : '');
      }))),
      h('span', { class: 'cmh-end' }, st.completed ? 'أتممت التعهّد — الله يبارك' : `باقي ${daysText(st.remaining)} سليمة — النهاية ${shortDate(st.endIso)}`)));
  } else {
    root.append(h('button', { type: 'button', class: 'banner tap', onclick: () => ctx.open('progress/commit') }, h('span', { class: 'banner-ic' }, icon('shield', 22)), h('p', null, h('b', null, 'ابدأ تعهّد'), h('br'), 'فترة تركيز (60 يوم مثلاً) بشروط يومية: صلوات، أذكار، عادات تتركها أو تبنيها'), icon('chevL', 18)));
  }
  // آخر أسبوعين: أعمدة بثلاث ألوان، وبالضغط بيطلع تفصيل اليوم
  const detail = h('div', { class: 'day-info' }, 'اضغط على أي يوم لتشوف نسبته وتفاصيله');
  root.append(secTitle('آخر أسبوعين', { ic: 'chart', action: h('span', { class: 'sec-hint' }, 'اضغط على يوم') }), h('div', { class: 'group chart-card' }, bars(today, detail), legend3(), detail));
  // خريطة 12 أسبوع
  const hdetail = h('div', { class: 'day-info' }, 'اضغط على أي مربّع لتشوف تفاصيل يومه');
  root.append(secTitle('خريطة الالتزام', { ic: 'grid', count: '12 أسبوع' }), heatmap(today, hdetail));
  // أرقام الشهر
  const mFrom = `${today.slice(0, 7)}-01`;
  let onTime = 0, prTotal = 0, pages = 0, tasksDone = 0;
  for (let d = mFrom; d <= today; d = addDays(d, 1)) {
    for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) { const s = prayerOn(d, k); prTotal += 1; if (s === 'jamaah' || s === 'ontime' || s === 'sunnah') onTime += 1; }
    pages += pagesReadOn(d);
    tasksDone += dayTaskStats(d, today).done;
  }
  const focus = (store.state.focusLog || []).filter((f) => f.d >= mFrom).reduce((a, f) => a + f.sec, 0);
  const units = (store.state.unitLog || []).filter((u) => u.d >= mFrom && u.kind !== 'book').length;
  const workouts = (store.state.sport.workouts || []).filter((w) => w.d >= mFrom).length;
  root.append(secTitle(`أرقام ${monthLabel(today.slice(0, 7), { year: false })}`, { ic: 'chart' }),
    h('div', { class: 'stat-grid' },
      stat('mosque', 'mint', 'صلاة بوقتها', `${prTotal ? Math.round((onTime / prTotal) * 100) : 0}%`, `${onTime} من ${prTotal}`),
      stat('quran', 'sky', 'صفحات قرآن', String(pages), ''),
      stat('list', 'dawn', 'مهام خلصت', String(tasksDone), ''),
      stat('grad', 'violet', 'محاضرات وحلقات', String(units), ''),
      stat('timer', 'gold', 'وقت تركيز', focus ? durText(focus / 60) : '0', ''),
      stat('dumbbell', 'amber', 'تمارين', String(workouts), '')));
  // أهداف الشهر
  const goals = store.state.goals.filter((g) => g.horizon === 'month' && g.key === today.slice(0, 7));
  if (goals.length) {
    root.append(secTitle('أهداف الشهر', { ic: 'target', action: h('button', { type: 'button', class: 'link-btn', onclick: () => ctx.open('plan/goals') }, 'الكل', icon('chevL', 14)) }),
      h('div', { class: 'group rows' }, goals.map((g) => { const p = goalPace(g, today); return h('div', { class: 'row' }, badge(g.icon || 'target', g.color || 'gold', 34), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, g.title), bar(p.prog, { cls: 'thin gold' })), h('span', { class: `pill ${p.cls}` }, p.label)); })));
  }
  return root;
}

function stat(ic, tint, label, value, sub) {
  return h('div', { class: 'stat-tile' }, badge(ic, tint, 34), h('div', null, h('small', null, label), h('b', { class: 'num' }, value), sub ? h('span', null, sub) : null));
}

/* ---------- ثلاث ألوان: مكتمل / جزئي / ضعيف ---------- */
// نسبة اليوم ولونه: إذا في تعهّد بنعتمد حكمه، وإلا نسبة المهام والصلوات والعادات
function dayLevel(d, today) {
  const v = commitActive() ? dayVerdict(d) : 'future';
  if (v === 'done') return { sc: verdictPct(dayDetail(d)) ?? 1, lvl: 'g', v };
  const sc = v !== 'future' && v !== 'pending' ? (verdictPct(dayDetail(d)) ?? 0) : dayScore(d, today);
  if (sc == null) return { sc: null, lvl: 'e', v };
  const th = passThreshold();
  return { sc, lvl: v === 'broken' ? (sc >= 0.4 ? 'a' : 'r') : sc >= th ? 'g' : sc >= 0.4 ? 'a' : 'r', v };
}
const LVL_NAME = { g: 'مكتمل', a: 'جزئي', r: 'ضعيف', e: 'بلا بيانات' };
const LVL_COLOR = { g: '#2fae86', a: '#d99a45', r: '#b04a4a' };

function legend3() {
  return h('div', { class: 'lg3' }, ['g', 'a', 'r'].map((k) => h('span', null, h('i', { style: { background: LVL_COLOR[k] } }), LVL_NAME[k])));
}

// تفصيل يوم تحت الرسمة
function showDay(el, d, today) {
  const L = dayLevel(d, today);
  const st = dayTaskStats(d, today);
  const pr = prayersDone(d);
  const hs = activeHabits();
  const okH = hs.filter((x) => habitOk(d, x.id)).length;
  const det = commitActive() ? dayDetail(d) : null;
  const miss = det?.items?.filter((x) => !x.ok).map((x) => x.name) || [];
  const dt = parseISO(d);
  fill(el, [
    h('div', { class: 'di-h' },
      h('b', null, d === today ? 'اليوم' : `${WEEKDAYS[dt.getDay()]} ${shortDate(d)}`),
      L.sc != null ? h('span', { class: `di-pill ${L.lvl}` }, `${Math.round(L.sc * 100)}% · ${d === today && L.lvl !== 'g' ? 'لسّا ما خلص' : LVL_NAME[L.lvl]}`) : h('span', { class: 'di-pill' }, LVL_NAME.e),
      h('button', { type: 'button', class: 'link-btn', onclick: () => openDaySheet(d) }, 'افتح اليوم', icon('chevL', 12))),
    h('div', { class: 'di-parts' },
      st.total ? h('span', null, icon('listCheck', 11), `المهام ${st.done}/${st.total}`) : null,
      h('span', null, icon('mosque', 11), `الصلوات ${pr}/5`),
      hs.length ? h('span', null, icon('compass', 11), `السلوك ${okH}/${hs.length}`) : null),
    miss.length ? h('p', { class: 'di-miss' }, 'فاتك: ', miss.join('، ')) : null,
  ]);
}

function bars(today, detail) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const th = passThreshold();
  const cols = [];
  const wrap = h('div', { class: 'bars3' },
    h('div', { class: 'b3-th', style: { bottom: `${th * 100}%` } }, h('span', null, `الحد ${Math.round(th * 100)}%`)));
  for (const d of days) {
    const L = dayLevel(d, today);
    const isT = d === today;
    const col = h('button', {
      type: 'button', class: `b3${isT ? ' t' : ''} ${L.lvl}`, 'aria-label': d,
      onclick: () => { cols.forEach((c) => c.classList.remove('sel')); col.classList.add('sel'); showDay(detail, d, today); },
    }, h('i', { style: { height: `${Math.max(4, Math.round((L.sc ?? 0) * 100))}%` } }));
    cols.push(col);
    wrap.append(col);
  }
  const labels = h('div', { class: 'b3-lbl' }, days.map((d) => h('span', { class: d === today ? 't' : '' }, d === today ? 'اليوم' : String(parseISO(d).getDate()))));
  return h('div', null, wrap, labels);
}

function heatmap(today, detail) {
  const start = addDays(weekStartOf(today), -7 * 11);
  const cols = [];
  const all = [];
  for (let w = 0; w < 12; w++) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      if (d > today) { cells.push(h('i', { class: 'hm3 future' })); continue; }
      const L = dayLevel(d, today);
      const cell = h('button', {
        type: 'button', class: `hm3 ${L.lvl}${d === today ? ' today' : ''}`, 'aria-label': d,
        onclick: () => { all.forEach((c) => c.classList.remove('sel')); cell.classList.add('sel'); showDay(detail, d, today); },
      });
      all.push(cell);
      cells.push(cell);
    }
    cols.push(h('div', { class: 'hm-col' }, cells));
  }
  return h('div', { class: 'group hm-wrap' }, h('div', { class: 'hm' }, cols),
    h('div', { class: 'lg3' }, ['g', 'a', 'r'].map((k) => h('span', null, h('i', { style: { background: LVL_COLOR[k] } }), LVL_NAME[k])), h('span', null, h('i', { style: { background: 'var(--s3)' } }), LVL_NAME.e)),
    detail);
}
