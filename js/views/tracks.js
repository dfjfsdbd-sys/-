// المكتبة: بطاقات كبيرة بعمودين — كل قسم بغلافه (صور عناصرك إذا في) وملخّص حي وشريط.
// بتضغط على القسم فبتنفتح صفحته، والعناصر جوّاتها كمان بطاقات بصورها بعمودين.
import { h, icon, bar } from '../ui.js';
import { store } from '../store.js';
import { prayersDone, allAdhkarLists, adhkarDone, adhkarSettings, quranStats } from '../worship.js';
import { activeHabits, habitOk, habitStreak } from '../habits.js';
import { unitsProgress } from '../library.js';
import { daysBetween, inDaysText, shortDate } from '../dates.js';
import { isFemale, care, routineState } from '../care.js';
import { tintHex } from '../icons.js';
import { seriesProgress, openSeriesEdit, nextEp } from './series.js';
import { bookProgress, openBookEdit } from './books.js';
import { examsBetween } from './study.js';
import { sportToday } from '../sport.js';
import { thumbOf } from '../youtube.js';
import { itemCard } from './components.js';

const seriesOf = (kind) => store.state.series.filter((x) => (kind === 'self' ? x.kind === 'self' : x.kind !== 'self'));
const seriesImg = (x) => x.image || (x.episodes || []).find((e) => e.image || e.videoId)?.image || thumbOf((x.episodes || []).find((e) => e.videoId)?.videoId) || null;
const avg = (arr, f) => (arr.length ? arr.reduce((a, x) => a + f(x), 0) / arr.length : 0);

// غلاف القسم: صور عناصره (لحد 3) أو لون وأيقونة
function cover(c, ic, imgs, n) {
  const pics = imgs.filter(Boolean).slice(0, 3);
  return h('span', { class: `lc-cov${pics.length ? ' pics' : ''}`, style: { '--c': c } },
    pics.length ? h('span', { class: 'lc-imgs' }, pics.map((src) => h('img', { src, alt: '', loading: 'lazy' }))) : null,
    h('span', { class: 'lc-ic' }, icon(ic, pics.length ? 18 : 30)),
    n != null && n !== '' ? h('span', { class: 'lc-n num' }, String(n)) : null);
}
function secCard({ c, ic, title, sub, pct, imgs = [], n, pill, wide, onClick }) {
  return h('button', { type: 'button', class: `lc3${wide ? ' wide' : ''}`, style: { '--c': c }, onclick: onClick },
    cover(c, ic, imgs, n),
    h('span', { class: 'lc-bd' },
      h('b', null, title),
      sub ? h('small', null, sub) : null,
      pill ? h('span', { class: 'pill warn' }, pill) : null,
      pct != null ? h('span', { class: 'lc-bar' }, h('i', { style: { width: `${Math.round(Math.min(1, pct) * 100)}%` } })) : null));
}

export function renderTracks(ctx) {
  const s = store.state;
  const today = ctx.today;
  const ex = examsBetween(today, '9999-12-31');
  const subs = s.subjects.filter((x) => !x.archived);
  const lects = subs.reduce((a, x) => a + (x.lectures?.length || 0), 0);
  const selfs = seriesOf('self'), others = seriesOf('other');
  const firstNext = (list) => { for (const x of list) { const n = nextEp(x); if (n) return `${x.name}: ${n.title}`; } return null; };
  const reading = s.books.find((b) => bookProgress(b) < 1);
  const qs = quranStats(today);
  const enabled = allAdhkarLists().filter((l) => adhkarSettings(l.id).enabled);
  const adDone = enabled.filter((l) => adhkarDone(today, l.id)).length;
  const hs = activeHabits();
  const hOk = hs.filter((x) => habitOk(today, x.id)).length;
  const best = hs.reduce((m, x) => Math.max(m, habitStreak(x.id, today)), 0);
  const sp = sportToday(today);
  const n0 = ex[0] ? daysBetween(today, ex[0].date) : null;
  return h('div', { class: 'lib' },
    h('div', { class: 'lib-head' }, h('h1', null, 'المكتبة')),
    h('div', { class: 'lib3' },
      secCard({ wide: true, c: '#e0a04a', ic: 'calCheck', title: 'المذاكرات والامتحانات', sub: ex.length ? `${ex.length} قادمة — الأقرب ${ex[0].subjectName} ${inDaysText(n0)}` : 'ما في مذاكرات قادمة — أضفها بتواريخها', pill: ex.length ? inDaysText(n0) : null, onClick: () => ctx.open('tracks/study') }),
      secCard({ c: '#4a9ee0', ic: 'grad', title: 'المواد', n: subs.length, sub: subs.length ? `${lects} محاضرة${ex[0] ? ` · الأقرب: ${ex[0].subjectName}` : ''}` : 'أضف موادك ومحاضراتها', pct: avg(subs, (x) => unitsProgress(x.lectures || [])), imgs: subs.map((x) => x.image), onClick: () => ctx.open('tracks/study') }),
      secCard({ c: '#a682e8', ic: 'spa', title: 'فقه النفس', n: selfs.length, sub: firstNext(selfs) ? `التالية: ${firstNext(selfs)}` : 'سلاسل التزكية بحلقاتها', pct: avg(selfs, seriesProgress), imgs: selfs.map(seriesImg), onClick: () => ctx.open('tracks/sec/self') }),
      secCard({ c: '#e06a9e', ic: 'clapper', title: 'السلاسل', n: others.length, sub: firstNext(others) ? `التالية: ${firstNext(others)}` : 'الدروس وأي سلسلة يوتيوب', pct: avg(others, seriesProgress), imgs: others.map(seriesImg), onClick: () => ctx.open('tracks/sec/series') }),
      secCard({ c: '#c08a4e', ic: 'book', title: 'الكتب', n: s.books.length, sub: reading ? `${reading.name} — ${reading.mode === 'pages' ? `ص ${reading.pagesRead || 0} من ${reading.totalPages || '؟'}` : `${Math.round(bookProgress(reading) * 100)}%`}` : 'الكتب اللي عم تقرأها', pct: avg(s.books, bookProgress), imgs: s.books.map((b) => b.image), onClick: () => ctx.open('tracks/sec/book') }),
      secCard({ c: '#35b791', ic: 'mosque', title: 'العبادات', sub: `الصلوات ${prayersDone(today)}/5 · الأذكار ${adDone}/${enabled.length} · الختمة ${Math.round(qs.pct * 100)}%`, pct: prayersDone(today) / 5, onClick: () => ctx.open('tracks/worship') }),
      isFemale() ? (() => { const am = care() ? routineState('am', today) : null; const ses = (care()?.sessions || []).find((x) => x.next && (x.done || []).length < x.total); return secCard({ c: '#E9839F', ic: 'spa', title: 'العناية', sub: [am ? `روتين الصبح ${am.done} من ${am.total}` : 'روتين البشرة والجسم', ses ? `${ses.name} ${shortDate(ses.next)}` : null].filter(Boolean).join(' · '), pct: am && am.total ? am.done / am.total : null, onClick: () => ctx.open('tracks/care') }); })() : null,
      secCard({ c: '#7bc39a', ic: 'compass', title: 'السلوك', n: hs.length, sub: hs.length ? `اليوم ${hOk} من ${hs.length}${best ? ` · أطول سلسلة ${best}` : ''}` : 'العادات اللي عم تبنيها أو تتركها', pct: hs.length ? hOk / hs.length : null, onClick: () => ctx.open('tracks/habits') }),
      secCard({ wide: true, c: '#e0705f', ic: 'dumbbell', title: 'الرياضة والصحة', sub: [sp.target ? `${sp.kcal} من ${sp.target} سعرة` : 'حدّد ملفك وهدفك', sp.weight ? `الوزن ${sp.weight}` : null, sp.workouts ? `${sp.workouts} تمرين اليوم` : null].filter(Boolean).join(' · '), pct: sp.target ? sp.kcal / sp.target : null, onClick: () => ctx.open('tracks/sport') })));
}

/* ---------- صفحة القسم: العناصر بطاقات بصورها ---------- */
const SEC = {
  self: { title: 'فقه النفس', add: () => openSeriesEdit(null, { kind: 'self' }), empty: 'أضف سلسلة فقه النفس، وحط رابط قائمة التشغيل من يوتيوب لتنضاف الحلقات لحالها.' },
  series: { title: 'السلاسل', add: () => openSeriesEdit(null, { kind: 'sharia' }), empty: 'أضف سلسلة دروس، وحط رابط يوتيوب إذا في.' },
  book: { title: 'الكتب', add: () => openBookEdit(null), empty: 'أضف الكتاب اللي عم تقرأه أو تدرسه.' },
};
export const sectionTitle = (ctx) => SEC[ctx.params.id]?.title || 'القسم';
export function sectionActions(ctx) {
  const sec = SEC[ctx.params.id];
  return sec ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'إضافة', onclick: sec.add }, icon('plus', 20)) : null;
}
export function renderSection(ctx) {
  const id = ctx.params.id;
  const sec = SEC[id];
  if (!sec) return h('div', { class: 'empty' }, 'القسم مش موجود');
  const cards = [];
  if (id === 'book') {
    for (const b of store.state.books) {
      const p = bookProgress(b);
      cards.push(itemCard({ tint: b.color || 'brown', ic: b.icon || 'book', image: b.image, title: b.name, sub: b.mode === 'pages' ? `ص ${b.pagesRead || 0} من ${b.totalPages || '؟'}` : `${(b.units || []).filter((u) => (u.mastery || 0) >= 100).length} من ${(b.units || []).length} ${b.unitWord || 'درس'}`, pct: p, tag: p >= 1 ? 'خلّصته' : null, onClick: () => ctx.open(`tracks/book/${b.id}`) }));
    }
  } else {
    for (const x of seriesOf(id === 'self' ? 'self' : 'other')) {
      const eps = x.episodes || [];
      const n = nextEp(x);
      cards.push(itemCard({ tint: x.color || (id === 'self' ? 'violet' : 'rose'), ic: x.icon || (id === 'self' ? 'spa' : 'clapper'), image: seriesImg(x), title: x.name, sub: `${eps.filter((e) => e.done).length} من ${eps.length} ${x.unitWord || 'حلقة'}${n ? ` · التالية ${n.title}` : ''}`, pct: seriesProgress(x), onClick: () => ctx.open(`tracks/series/${x.id}`) }));
    }
  }
  return h('div', null,
    cards.length ? h('div', { class: 'ic-grid' }, cards)
      : h('div', { class: 'empty' }, h('p', null, sec.empty), h('button', { type: 'button', class: 'btn', onclick: sec.add }, icon('plus', 18), 'إضافة')));
}
