// المكتبة: كل الأقسام بشاشة وحدة. فوق «الأساس» (العبادات والرياضة)، بعدها «الدراسة» (المواد والمذاكرات)،
// وتحت شبكة بطاقات صغيرة بأغلفتها (صور عناصرك) لباقي الأقسام، وأزرار للأقسام الصغيرة.
// بتضغط على القسم فبتنفتح صفحته، والعناصر جوّاتها بطاقات بصورها بعمودين.
import { h, icon, bar, openActions } from '../ui.js';
import { store } from '../store.js';
import { prayersDone, prayerOn, allAdhkarLists, adhkarDone, adhkarSettings, wirdToday } from '../worship.js';
import { PRAYERS } from '../prayer.js';
import { activeHabits, habitOk, habitStreak } from '../habits.js';
import { unitsProgress } from '../library.js';
import { daysBetween, inDaysText, shortDate, countText } from '../dates.js';
import { isFemale, care, routineState } from '../care.js';
import { tintHex } from '../icons.js';
import { seriesProgress, openSeriesEdit, nextEp } from './series.js';
import { bookProgress, bookSub, openBookEdit } from './books.js';
import { examsBetween, openSubjectEdit } from './study.js';
import { sportToday } from '../sport.js';
import { thumbOf } from '../youtube.js';
import { itemCard } from './components.js';
import { hifzToday, hifzStats } from '../hifz.js';
import { fastInfo, upcomingFasts, monthFasts } from '../fasting.js';
import { openHabitEdit } from './habits.js';
import { setPlanMode } from './plan.js';

// سلاسل الكتب (kind: 'book') بتطلع جوّا كتابها، مش هون
const seriesOf = (kind) => store.state.series.filter((x) => x.kind !== 'book' && (kind === 'self' ? x.kind === 'self' : x.kind !== 'self'));
const seriesImg = (x) => x.image || (x.episodes || []).find((e) => e.image || e.videoId)?.image || thumbOf((x.episodes || []).find((e) => e.videoId)?.videoId) || null;
const avg = (arr, f) => (arr.length ? arr.reduce((a, x) => a + f(x), 0) / arr.length : 0);

// غلاف البطاقة: صور عناصر القسم (لحد 3) فوق بعض، أو لون وأيقونة كبيرة
function cover(ic, imgs = [], { n, tag, max = 3 } = {}) {
  const pics = imgs.filter(Boolean).slice(0, max);
  return h('span', { class: `lb-cv${pics.length ? ' has' : ''}` },
    pics.length ? h('span', { class: 'lb-imgs' }, pics.map((src) => h('img', { src, alt: '', loading: 'lazy' }))) : null,
    h('span', { class: 'lb-ico' }, icon(ic, pics.length ? 12 : 20)),
    n ? h('em', { class: 'lb-n num' }, String(n)) : null,
    tag ? h('span', { class: 'lb-tag' }, tag) : null);
}
const pctBar = (p) => (p == null ? null : h('span', { class: 'lb-bar' }, h('i', { style: { width: `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%` } })));
// بطاقة الأساس (العبادات والرياضة)
function coreCard({ c, ic, title, sub, tag, extra, onClick }) {
  return h('button', { type: 'button', class: 'lb-core', style: { '--c': c }, onclick: onClick },
    cover(ic, [], { tag }),
    h('span', { class: 'lb-bd' }, h('b', null, title), sub ? h('small', null, sub) : null, extra));
}
// بطاقة صغيرة بالشبكة
function tile({ c, ic, title, sub, pct, imgs = [], n, onClick }) {
  return h('button', { type: 'button', class: 'lb-m3', style: { '--c': c }, onclick: onClick },
    cover(ic, imgs, { n }),
    h('span', { class: 'lb-bd' }, h('b', null, title), sub ? h('small', null, sub) : null, pctBar(pct)));
}

export function renderTracks(ctx) {
  const s = store.state;
  const today = ctx.today;
  const ex = examsBetween(today, '9999-12-31');
  const subs = s.subjects.filter((x) => !x.archived);
  const lects = subs.reduce((a, x) => a + (x.lectures?.length || 0), 0);
  const selfs = seriesOf('self'), others = seriesOf('other');
  const nextOf = (list) => { for (const x of list) { const n = nextEp(x); if (n) return n.title; } return null; };
  const reading = s.books.find((b) => bookProgress(b) < 1);
  const w = wirdToday(today);
  const enabled = allAdhkarLists().filter((l) => adhkarSettings(l.id).enabled);
  const adDone = enabled.filter((l) => adhkarDone(today, l.id)).length;
  const hs = activeHabits();
  const hOk = hs.filter((x) => habitOk(today, x.id)).length;
  const best = hs.reduce((m, x) => Math.max(m, habitStreak(x.id, today)), 0);
  const sp = sportToday(today);
  const n0 = ex[0] ? daysBetween(today, ex[0].date) : null;
  const hz = hifzToday(today), hst = hifzStats(today);
  const fiToday = fastInfo(today), nextFast = upcomingFasts(today, 1)[0];
  const female = isFemale();

  const fastTile = tile({ c: '#e8c46a', ic: 'moon', title: 'الصيام', n: monthFasts(today.slice(0, 7)) || null,
    sub: fiToday.reasons.length ? `اليوم ${fiToday.reasons[0].name}` : nextFast ? `${nextFast.reasons[0].name} ${inDaysText(daysBetween(today, nextFast.d))}` : 'والقضاء والسنن',
    onClick: () => ctx.open('tracks/fasting') });
  const careTile = female ? (() => {
    const am = care() ? routineState('am', today) : null;
    const ses = (care()?.sessions || []).find((x) => x.next && (x.done || []).length < x.total);
    return tile({ c: '#E9839F', ic: 'spa', title: 'العناية', sub: ses ? `${ses.name} ${shortDate(ses.next)}` : am ? `الصبح ${am.done} من ${am.total}` : 'روتين البشرة', pct: am && am.total ? am.done / am.total : null, onClick: () => ctx.open('tracks/care') });
  })() : null;

  const addMenu = () => openActions('شو بدك تضيف؟', [
    { icon: 'graduation-cap', label: 'مادة', sub: 'بمحاضراتها', run: () => openSubjectEdit(null) },
    { icon: 'spa', label: 'سلسلة فقه النفس', run: () => openSeriesEdit(null, { kind: 'self' }) },
    { icon: 'clapperboard', label: 'سلسلة دروس', sub: 'من يوتيوب أو بإيدك', run: () => openSeriesEdit(null, { kind: 'sharia' }) },
    { icon: 'book', label: 'كتاب', run: () => openBookEdit(null) },
    { icon: 'compass', label: 'عادة أو سلوك', run: () => openHabitEdit(null) },
  ]);

  return h('div', { class: 'lib lb' },
    h('div', { class: 'lib-head' }, h('h1', null, 'المكتبة')),
    // الأساس
    h('div', { class: 'lb-core2' },
      coreCard({ c: '#35b791', ic: 'mosque', title: 'العبادات', tag: `الصلوات ${prayersDone(today)}/5`,
        sub: `الورد ${w.read} من ${w.target}${enabled.length ? ` · الأذكار ${adDone}/${enabled.length}` : ''}`,
        extra: h('span', { class: 'lb-dots' }, PRAYERS.map((k) => { const st = prayerOn(today, k); return h('i', { class: st && st !== 'missed' ? 'ok' : st === 'missed' ? 'miss' : '' }); })),
        onClick: () => ctx.open('tracks/worship') }),
      coreCard({ c: '#e0705f', ic: 'dumbbell', title: 'الرياضة والصحة', tag: sp.workouts ? `${countText(sp.workouts, ['تمرين واحد', 'تمرينين', 'تمارين', 'تمرين'])} اليوم` : sp.weight ? `الوزن ${sp.weight}` : null,
        sub: sp.target ? `${sp.kcal} من ${sp.target} سعرة` : 'حدّد ملفك وهدفك',
        extra: pctBar(sp.target ? sp.kcal / sp.target : null), onClick: () => ctx.open('tracks/sport') })),
    // الدراسة: المواد والمذاكرات بقسم واحد
    h('button', { type: 'button', class: 'lb-study', style: { '--c': '#4a9ee0' }, onclick: () => ctx.open('tracks/study') },
      cover('grad', subs.map((x) => x.image), { max: 2 }),
      h('span', { class: 'lb-bd' },
        h('span', { class: 'lb-r1' }, h('b', null, 'الدراسة'),
          ex[0] ? h('span', { class: `lb-nx${n0 <= 1 ? ' soon' : ''}` }, icon('calCheck', 10), `${ex[0].subjectName} ${inDaysText(n0)}`) : null),
        h('small', null, subs.length ? `${countText(subs.length, ['مادة وحدة', 'مادتين', 'مواد', 'مادة'])} · ${countText(lects, ['محاضرة وحدة', 'محاضرتين', 'محاضرات', 'محاضرة'])}${ex.length > 1 ? ` · ${countText(ex.length, ['مذاكرة', 'مذاكرتين', 'مذاكرات', 'مذاكرة'])} جايين` : ''}` : 'أضف موادك ومحاضراتها ومذاكراتك'),
        pctBar(subs.length ? avg(subs, (x) => unitsProgress(x.lectures || [])) : null))),
    // باقي الأقسام
    h('div', { class: 'lb-grid' },
      tile({ c: '#a682e8', ic: 'spa', title: 'فقه النفس', n: selfs.length, sub: nextOf(selfs) ? `التالية: ${nextOf(selfs)}` : 'سلاسل التزكية', pct: selfs.length ? avg(selfs, seriesProgress) : null, imgs: selfs.map(seriesImg), onClick: () => ctx.open('tracks/sec/self') }),
      tile({ c: '#e06a9e', ic: 'clapper', title: 'السلاسل', n: others.length, sub: nextOf(others) ? `التالية: ${nextOf(others)}` : 'دروس يوتيوب', pct: others.length ? avg(others, seriesProgress) : null, imgs: others.map(seriesImg), onClick: () => ctx.open('tracks/sec/series') }),
      tile({ c: '#c08a4e', ic: 'book', title: 'الكتب', n: s.books.length, sub: reading ? reading.name : 'اللي عم تقرأها', pct: reading ? bookProgress(reading) : null, imgs: s.books.map((b) => b.image), onClick: () => ctx.open('tracks/sec/book') }),
      tile({ c: '#7bc39a', ic: 'compass', title: 'السلوك', n: hs.length, sub: hs.length ? `اليوم ${hOk} من ${hs.length}${best ? ` · ${best}` : ''}` : 'عاداتك', pct: hs.length ? hOk / hs.length : null, onClick: () => ctx.open('tracks/habits') }),
      tile({ c: '#35b791', ic: 'brain', title: 'الحفظ', sub: hz?.portion ? `جديد ص ${hz.portion.pages[0]}` : hst.pages ? `${hst.pages} صفحة محفوظة` : 'ابدأ خطة حفظ', pct: hst.pages ? hst.pages / 604 : null, onClick: () => ctx.open('tracks/hifz') }),
      female ? careTile : fastTile),
    h('div', { class: 'lb-pills' },
      female ? h('button', { type: 'button', style: { '--c': '#e8c46a' }, onclick: () => ctx.open('tracks/fasting') }, icon('moon', 13), 'الصيام') : null,
      h('button', { type: 'button', style: { '--c': '#6F86D9' }, onclick: () => ctx.open('tracks/duas') }, icon('hands', 13), female ? 'الأدعية' : 'الأدعية والعدّاد'),
      h('button', { type: 'button', style: { '--c': '#4cb8d4' }, onclick: () => { setPlanMode('projects'); ctx.go('plan'); } }, icon('diagram-project', 13), 'المشاريع'),
      h('button', { type: 'button', style: { '--c': '#8a8a99' }, onclick: addMenu }, icon('plus', 13), 'أضف')));
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
      cards.push(itemCard({ tint: b.color || 'brown', ic: b.icon || 'book', image: b.image, title: b.name, sub: bookSub(b), pct: p, tag: p >= 1 ? 'خلّصته' : b.seriesId ? 'يوتيوب' : null, tagCls: p >= 1 ? 'warn' : 'yt', onClick: () => ctx.open(`tracks/book/${b.id}`) }));
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
