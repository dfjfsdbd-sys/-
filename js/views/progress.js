// إنجازي: المستوى والنقاط، التعهّد، منحنى الأيام، والأرقام اللي بتفرّح
import { h, icon, badge, ring, bar } from '../ui.js';
import { store } from '../store.js';
import { addDays, parseISO, WEEK_SHORT, weekStartOf, durText, daysText, monthLabel, shortDate } from '../dates.js';
import { levelOf, totalPoints, balance, pointsOn, pointsBetween } from '../rewards.js';
import { commitActive, commitStats, dayVerdict, verdictPct, dayDetail } from '../commit.js';
import { dayTaskStats } from '../tasks.js';
import { prayersDone, pagesReadOn, prayerOn } from '../worship.js';
import { activeHabits, habitOk } from '../habits.js';
import { secTitle } from './components.js';
import { openDaySheet } from './daysheet.js';
import { goalPace } from './goals.js';

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
  const root = h('div', null, h('header', { class: 'page-head' }, h('h1', null, 'إنجازي'),
    h('div', { class: 'head-actions' }, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'المكافآت', onclick: () => ctx.open('progress/rewards') }, icon('gift', 20)))));
  // المستوى
  root.append(h('div', { class: 'lvl-card' },
    ring(lv.pct, 86, { stroke: 6, color: 'var(--gold)', label: String(lv.level) }),
    h('div', { class: 'lvl-info' },
      h('small', null, `المستوى ${lv.level}`),
      h('strong', null, lv.title),
      h('span', null, `${lv.need - lv.into} نقطة للمستوى الجاي`),
      bar(lv.pct, { cls: 'gold' })),
    h('div', { class: 'lvl-pts' },
      h('div', null, h('b', { class: 'num' }, String(pointsOn(today))), h('small', null, 'اليوم')),
      h('div', null, h('b', { class: 'num' }, String(pointsBetween(weekFrom, today))), h('small', null, 'الأسبوع')),
      h('button', { type: 'button', onclick: () => ctx.open('progress/rewards') }, h('b', { class: 'num' }, String(balance())), h('small', null, 'رصيدك')))));
  // التعهّد
  if (commitActive()) {
    const st = commitStats(today);
    root.append(h('button', { type: 'button', class: 'cm-hero', onclick: () => ctx.open('progress/commit') },
      h('div', { class: 'cmh-top' },
        h('div', null, h('small', null, 'تتجهّز لـ'), h('strong', null, store.state.commitment.reward || 'التعهّد')),
        icon('chevL', 18)),
      h('div', { class: 'cmh-nums' },
        h('div', null, h('b', { class: 'num' }, `${st.dayNumber}`), h('small', null, `من ${st.totalDays}`)),
        h('div', null, h('b', { class: 'num good' }, String(st.done + (st.todayDone ? 1 : 0))), h('small', null, 'يوم مكتمل')),
        h('div', null, h('b', { class: 'num bad' }, String(st.broken)), h('small', null, 'ناقص')),
        h('div', null, h('b', { class: 'num' }, String(st.streak)), h('small', null, 'ورا بعض'))),
      bar(st.pct, { cls: 'good' }),
      h('span', { class: 'cmh-end' }, st.completed ? 'أتممت التعهّد — الله يبارك' : `باقي ${daysText(st.remaining)} سليمة — النهاية ${shortDate(st.endIso)}`)));
  } else {
    root.append(h('button', { type: 'button', class: 'banner tap', onclick: () => ctx.open('progress/commit') }, h('span', { class: 'banner-ic' }, icon('shield', 22)), h('p', null, h('b', null, 'ابدأ تعهّد'), h('br'), 'فترة تركيز (60 يوم مثلاً) بشروط يومية: صلوات، أذكار، عادات تتركها أو تبنيها'), icon('chevL', 18)));
  }
  // منحنى آخر 14 يوم
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const scores = days.map((d) => dayScore(d, today));
  root.append(secTitle('آخر أسبوعين', { ic: 'trend' }), h('div', { class: 'group chart-card' }, curve(days, scores, today)));
  // خريطة 12 أسبوع
  root.append(secTitle('خريطة الالتزام', { ic: 'grid', count: '12 أسبوع' }), heatmap(today));
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

function curve(days, scores, today) {
  const W = 320, H = 120, pad = 10;
  const step = (W - pad * 2) / (days.length - 1);
  const pts = scores.map((s, i) => (s == null ? null : [pad + i * step, H - pad - s * (H - pad * 2)]));
  let path = '', area = '';
  const valid = pts.filter(Boolean);
  if (valid.length) {
    path = valid.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    area = `${path} L${valid[valid.length - 1][0].toFixed(1)},${H - pad} L${valid[0][0].toFixed(1)},${H - pad} Z`;
  }
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="curve" preserveAspectRatio="none">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8E9BFF" stop-opacity=".35"/><stop offset="1" stop-color="#8E9BFF" stop-opacity="0"/></linearGradient></defs>
    <line x1="${pad}" x2="${W - pad}" y1="${H - pad - 0.6 * (H - pad * 2)}" y2="${H - pad - 0.6 * (H - pad * 2)}" stroke="rgba(242,196,107,.35)" stroke-dasharray="3 4"/>
    ${area ? `<path d="${area}" fill="url(#cg)"/><path d="${path}" fill="none" stroke="#A1ABFF" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${pts.map((p, i) => (p ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${days[i] === today ? 4.5 : 3}" fill="${scores[i] >= 0.6 ? '#4FD1A1' : '#F2A65A'}"/>` : '')).join('')}
  </svg>`;
  const wrap = h('div', { class: 'curve-wrap', html: svg });
  const labels = h('div', { class: 'curve-labels' }, days.map((d) => h('button', { type: 'button', onclick: () => openDaySheet(d), class: d === today ? 'on' : '' }, WEEK_SHORT[parseISO(d).getDay()])));
  return h('div', null, wrap, labels, h('p', { class: 'chart-note' }, 'الخط الذهبي = 60%. كل نقطة يوم: مهامك وصلواتك وعاداتك. اضغط على يوم لتفتحه.'));
}

function heatmap(today) {
  const start = addDays(weekStartOf(today), -7 * 11);
  const cols = [];
  for (let w = 0; w < 12; w++) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      if (d > today) { cells.push(h('i', { class: 'hm-cell future' })); continue; }
      const v = commitActive() ? dayVerdict(d) : 'future';
      const sc = v !== 'future' ? (v === 'done' ? 1 : verdictPct(dayDetail(d)) || 0.1) : dayScore(d, today);
      const lvl = sc == null ? 0 : sc >= 0.9 ? 4 : sc >= 0.6 ? 3 : sc >= 0.3 ? 2 : sc > 0 ? 1 : 0;
      cells.push(h('button', { type: 'button', class: `hm-cell l${lvl}${d === today ? ' today' : ''}`, title: d, 'aria-label': d, onclick: () => openDaySheet(d) }));
    }
    cols.push(h('div', { class: 'hm-col' }, cells));
  }
  return h('div', { class: 'group hm-wrap' }, h('div', { class: 'hm' }, cols), h('div', { class: 'hm-legend' }, h('span', null, 'أقل'), [0, 1, 2, 3, 4].map((l) => h('i', { class: `hm-cell l${l}` })), h('span', null, 'أكتر')));
}
