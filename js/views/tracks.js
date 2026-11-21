// مساراتي: كل أقسام الحياة بمكان واحد، ولكل قسم ملخّص حيّ
import { h, icon, badge, ring, bar } from '../ui.js';
import { store } from '../store.js';
import { prayersDone, allAdhkarLists, adhkarDone, adhkarSettings, quranStats } from '../worship.js';
import { activeHabits, habitOk, habitStreak } from '../habits.js';
import { unitsProgress } from '../library.js';
import { daysBetween, dayLabel } from '../dates.js';
import { seriesProgress } from './series.js';
import { bookProgress } from './books.js';
import { sportToday } from '../sport.js';

export function renderTracks(ctx) {
  const today = ctx.today;
  const s = store.state;
  const qs = quranStats(today);
  const enabled = allAdhkarLists().filter((l) => adhkarSettings(l.id).enabled);
  const adDone = enabled.filter((l) => adhkarDone(today, l.id)).length;
  const exams = (s.exams || []).filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const ex = exams[0];
  const exSub = ex ? s.subjects.find((x) => x.id === ex.subjectId) : null;
  const studyP = s.subjects.length ? s.subjects.reduce((a, x) => a + unitsProgress(x.lectures), 0) / s.subjects.length : 0;
  const readingBook = s.books.find((b) => bookProgress(b) < 1);
  const nextSeries = s.series.find((x) => (x.episodes || []).some((e) => !e.done));
  const habits = activeHabits();
  const hOk = habits.filter((x) => habitOk(today, x.id)).length;
  const best = habits.reduce((a, x) => Math.max(a, habitStreak(x.id, today)), 0);
  const sp = sportToday(today);
  const tile = (path, ic, tint, title, line1, line2, extra) => h('button', { type: 'button', class: 'tr-tile', style: { '--tint': `var(--tt-${tint}, ${tint})` }, onclick: () => ctx.open(path) },
    h('div', { class: 'tr-top' }, badge(ic, tint, 40), extra || null),
    h('b', null, title), h('span', null, line1), line2 ? h('small', null, line2) : null);
  return h('div', null,
    h('header', { class: 'page-head' }, h('h1', null, 'مساراتي')),
    h('button', { type: 'button', class: 'tr-hero', onclick: () => ctx.open('tracks/worship') },
      h('div', { class: 'trh-head' }, badge('mosque', 'mint', 44), h('div', null, h('b', null, 'العبادات'), h('small', null, 'الصلوات، الأذكار، القرآن، الحفظ')), icon('chevL', 18)),
      h('div', { class: 'trh-stats' },
        h('div', null, ring(prayersDone(today) / 5, 46, { stroke: 4, color: 'var(--good)', label: `${prayersDone(today)}/5` }), h('small', null, 'الصلوات')),
        h('div', null, ring(enabled.length ? adDone / enabled.length : 0, 46, { stroke: 4, color: 'var(--gold)', label: `${adDone}/${enabled.length}` }), h('small', null, 'الأذكار')),
        h('div', null, ring(Math.min(1, qs.todayPages / qs.daily), 46, { stroke: 4, color: 'var(--accent)', label: String(qs.todayPages) }), h('small', null, 'صفحات')),
        h('div', null, ring(qs.pct, 46, { stroke: 4, color: 'var(--sky-dhuhr)', label: `${Math.round(qs.pct * 100)}%` }), h('small', null, 'الختمة')))),
    h('div', { class: 'tr-grid' },
      tile('tracks/study', 'grad', 'sky', 'الدراسة', `${s.subjects.length} مواد — ${Math.round(studyP * 100)}%`, ex ? `${ex.kind === 'final' ? 'امتحان' : 'مذاكرة'} ${exSub?.name || ''} بعد ${daysBetween(today, ex.date)} يوم` : 'ما في امتحانات قريبة', ex && daysBetween(today, ex.date) <= 7 ? h('span', { class: 'pill warn' }, `${daysBetween(today, ex.date)} يوم`) : null),
      tile('tracks/series', 'youtube', 'violet', 'السلاسل والدروس', `${s.series.length} سلاسل`, nextSeries ? `${nextSeries.name}: ${Math.round(seriesProgress(nextSeries) * 100)}%` : 'أضف سلسلة من يوتيوب'),
      tile('tracks/books', 'book', 'coral', 'الكتب', readingBook ? readingBook.name : `${s.books.length} كتب`, readingBook ? `${Math.round(bookProgress(readingBook) * 100)}% مقروء` : 'أضف كتاب'),
      tile('tracks/habits', 'leaf', 'mint', 'العادات والسلوك', habits.length ? `${hOk} من ${habits.length} اليوم` : 'أضف عادة', best ? `أطول سلسلة حالية ${best} يوم` : null),
      tile('tracks/sport', 'dumbbell', 'gold', 'الرياضة والصحة', sp.weight ? `الوزن ${sp.weight} كغ` : 'سجّل وزنك', sp.target ? `أكلت ${sp.kcal} من ${sp.target} سعرة` : 'حدّد هدفك من السعرات'),
      tile('plan/goals', 'target', 'dawn', 'الأهداف', `${s.goals.filter((g) => g.horizon === 'month' && g.key === today.slice(0, 7)).length} أهداف هالشهر`, `${s.goals.filter((g) => g.horizon === 'year').length} أهداف للسنة`)));
}
