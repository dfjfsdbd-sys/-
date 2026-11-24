// الأوسمة: بتنفتح لحالها لما توصل لإنجاز حقيقي، والمقفولة بتبيّن قدّيش باقيلك
import { store } from './store.js';
import { logicalToday } from './prayer.js';
import { daysBetween } from './dates.js';
import { commitStats } from './commit.js';
import { totalPoints } from './rewards.js';
import { sunnahStreak } from './fasting.js';
import { wakeStreak } from './sleep.js';
import { juzStart } from './data/quran-meta.js';

const ON_TIME = new Set(['ontime', 'jamaah', 'sunnah']);
function bestStreak(dates) {
  const sorted = [...new Set(dates)].sort();
  let best = 0, run = 0, prev = null;
  for (const d of sorted) { run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}
const fajrDays = () => Object.entries(store.state.prayers.log || {}).filter(([, v]) => ON_TIME.has(v?.fajr)).map(([d]) => d);
function juzBest() {
  const memo = store.state.quran.memo || {};
  let best = 0;
  for (let j = 1; j <= 30; j++) { const a = juzStart(j), b = j === 30 ? 604 : juzStart(j + 1) - 1; let n = 0; for (let p = a; p <= b; p++) if (memo[p]?.m > 0 && (memo[p].p == null || memo[p].p >= (memo[p].of || 1))) n += 1; best = Math.max(best, n / (b - a + 1)); }
  return Math.round(best * 20);
}
const dhikrTotal = (id) => Object.values(store.state.dhikr?.counts || {}).reduce((a, d) => a + (d[id] || 0), 0);

export const BADGES = [
  { id: 'fajr7', name: 'فجر أسبوع', icon: 'sun', c: '#F0C96A', desc: 'الفجر بوقته 7 أيام ورا بعض', target: 7, cur: () => bestStreak(fajrDays()) },
  { id: 'fajr30', name: 'فجر شهر', icon: 'sun', c: '#F0A35E', desc: 'الفجر بوقته 30 يوم ورا بعض', target: 30, cur: () => bestStreak(fajrDays()) },
  { id: 'khatma1', name: 'أول ختمة', icon: 'quran', c: '#35b791', desc: 'ختمت القرآن', target: 604, cur: () => ((store.state.quran.khatmas || []).length ? 604 : (store.state.quran.page || 1) - 1), unit: 'ص' },
  { id: 'juz1', name: 'جزء محفوظ', icon: 'book-quran', c: '#35b791', desc: 'حفظت جزء كامل', target: 20, cur: juzBest, unit: 'ص' },
  { id: 'lect100', name: '100 محاضرة', icon: 'graduation-cap', c: '#4a9ee0', desc: 'درست 100 محاضرة', target: 100, cur: () => (store.state.subjects || []).reduce((a, s) => a + (s.lectures || []).filter((l) => (l.mastery || 0) >= 50).length, 0) },
  { id: 'eps50', name: '50 حلقة', icon: 'clapperboard', c: '#e06a9e', desc: 'خلّصت 50 حلقة', target: 50, cur: () => (store.state.series || []).reduce((a, s) => a + (s.episodes || []).filter((e) => e.done).length, 0) },
  { id: 'books3', name: '3 كتب', icon: 'book', c: '#c08a4e', desc: 'خلّصت 3 كتب', target: 3, cur: () => (store.state.books || []).filter((b) => (b.mode === 'pages' ? b.totalPages && (b.pagesRead || 0) >= b.totalPages : (b.units || []).length && (b.units || []).every((u) => (u.mastery || 0) >= 100))).length },
  { id: 'commit30', name: 'شهر تعهّد', icon: 'seedling', c: '#e0705f', desc: '30 يوم تعهّد ورا بعض', target: 30, cur: () => (store.state.commitment?.active ? commitStats(logicalToday())?.best || 0 : 0) },
  { id: 'muhasaba30', name: '30 ليلة محاسبة', icon: 'feather', c: '#a682e8', desc: 'حاسبت حالك 30 ليلة', target: 30, cur: () => Object.values(store.state.muhasaba || {}).filter((x) => x?.at).length },
  { id: 'sunnah7', name: 'السنن أسبوع', icon: 'star', c: '#35b791', desc: '12 ركعة سنن 7 أيام ورا بعض', target: 7, cur: () => sunnahStreak(logicalToday()) },
  { id: 'fast10', name: '10 أيام صيام', icon: 'moon', c: '#6F86D9', desc: 'صمت 10 أيام سنّة', target: 10, cur: () => Object.keys(store.state.fasting?.log || {}).length },
  { id: 'wake14', name: 'صحيان أسبوعين', icon: 'cloud-sun', c: '#F0C96A', desc: 'صحيت عالفجر 14 يوم ورا بعض', target: 14, cur: () => wakeStreak(logicalToday()) },
  { id: 'istighfar1000', name: '1000 استغفار', icon: 'hands-praying', c: '#35b791', desc: 'استغفرت 1000 مرة بالعدّاد', target: 1000, cur: () => dhikrTotal('istighfar') },
  { id: 'work30', name: '30 تمرين', icon: 'dumbbell', c: '#e0705f', desc: 'تمرّنت 30 مرة', target: 30, cur: () => (store.state.sport.workouts || []).length },
  { id: 'review4', name: '4 مراجعات', icon: 'calendar-check', c: '#4cb8d4', desc: 'راجعت 4 أسابيع', target: 4, cur: () => Object.values(store.state.reviews || {}).filter((x) => x?.at).length },
  { id: 'project1', name: 'مشروع خلص', icon: 'flag-checkered', c: '#e8c46a', desc: 'خلّصت كل خطوات مشروع', target: 1, cur: () => (store.state.projects || []).filter((p) => { const st = p.phases.flatMap((x) => x.steps); return st.length && st.every((x) => x.done); }).length },
  { id: 'points1000', name: '1000 نقطة', icon: 'coins', c: '#e8c46a', desc: 'جمعت 1000 نقطة', target: 1000, cur: () => totalPoints() },
  { id: 'points5000', name: '5000 نقطة', icon: 'trophy', c: '#e8c46a', desc: 'جمعت 5000 نقطة', target: 5000, cur: () => totalPoints() },
];

export const earnedAt = (id) => store.state.badges?.[id] || null;
export function badgeState(b) {
  let cur = 0;
  try { cur = Math.max(0, Number(b.cur()) || 0); } catch { cur = 0; }
  return { ...b, cur: Math.min(cur, b.target), pct: Math.min(1, cur / b.target), at: earnedAt(b.id) };
}
// منفحص ومنعطي الجديد — بترجع الأوسمة اللي انفتحت هلّق
export function checkBadges() {
  const today = logicalToday();
  const fresh = [];
  for (const b of BADGES) {
    if (earnedAt(b.id)) continue;
    const st = badgeState(b);
    if (st.cur >= b.target) fresh.push(b);
  }
  if (fresh.length) store.update((s) => { s.badges = s.badges || {}; for (const b of fresh) s.badges[b.id] = today; });
  return fresh;
}
