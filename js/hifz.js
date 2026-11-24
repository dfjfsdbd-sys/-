// حفظ القرآن بالصفحات (مصحف المدينة): كل يوم جديد بمقدار خطتك، ومراجعة قريبة (آخر الصفحات اللي حفظتها)،
// ومراجعة بعيدة بتدور على القديم — والصفحة الضعيفة بترجعلك أبكر.
import { store } from './store.js';
import { logicalToday } from './prayer.js';
import { addDays, daysBetween } from './dates.js';
import { SURAHS, TOTAL_PAGES, juzOfPage, juzStart } from './data/quran-meta.js';
import { shiftOn } from './shifts.js';
import { award, POINTS } from './rewards.js';

export const AMOUNTS = { 0.25: 'ربع صفحة', 0.5: 'نص صفحة', 1: 'صفحة', 2: 'صفحتين' };
export const ORDERS = { back: 'من آخر المصحف (الناس ← للخلف)', forward: 'من أول المصحف (الفاتحة ← لقدّام)' };
export const WORK_MODES = { review: 'مراجعة بس', half: 'نص الكمية', same: 'نفس الكمية' };
const PART_NAMES = { 2: ['النص الأول', 'النص التاني'], 4: ['الربع الأول', 'الربع التاني', 'الربع التالت', 'الربع الأخير'] };
export const FAR_PER_DAY = 2;

const q = () => store.state.quran;
export const hifzPlan = () => q().hifzPlan || null;
export const memoOf = (p) => q().memo?.[p] || null;
const complete = (m) => Boolean(m && m.m > 0 && (m.p == null || m.p >= (m.of || 1)));

/* ---------- الصفحات والسور ---------- */
export function surahsOnPage(p) {
  const out = [];
  for (let i = 0; i < SURAHS.length; i++) {
    const s = SURAHS[i], next = SURAHS[i + 1];
    // بمصحف المدينة السورة غالباً بتبلّش من أول الصفحة، فاللي قبلها بتخلص بالصفحة اللي قبل
    const end = next ? (next.page > s.page ? next.page - 1 : s.page) : TOTAL_PAGES;
    if (s.page <= p && p <= end) out.push(s.name);
  }
  return out.length > 3 ? out.slice(-3) : out;
}
export function pagesLabel(pages) {
  const names = [...new Set(pages.flatMap((p) => surahsOnPage(p)))];
  const nm = names.length > 2 ? `${names[0]} … ${names[names.length - 1]}` : names.join(' و');
  const sorted = [...pages].sort((x, y) => x - y);
  const a = sorted[0], b = sorted[sorted.length - 1];
  const contiguous = b - a + 1 === sorted.length;
  return { names: nm, range: a === b ? `ص ${a}` : contiguous ? `ص ${a} – ${b}` : `ص ${sorted.join('، ')}` };
}

/* ---------- الترتيب ---------- */
function orderPages(plan) {
  const out = [];
  if (plan.order === 'forward') { for (let p = plan.start || 1; p <= TOTAL_PAGES; p++) out.push(p); for (let p = 1; p < (plan.start || 1); p++) out.push(p); }
  else { for (let p = plan.start || TOTAL_PAGES; p >= 1; p--) out.push(p); for (let p = TOTAL_PAGES; p > (plan.start || TOTAL_PAGES); p--) out.push(p); }
  return out;
}
export const isWorkDay = (d) => Boolean(store.state.settings.shift?.enabled) && shiftOn(d)?.kind === 'work';
export function amountOn(d) {
  const plan = hifzPlan();
  if (!plan) return 0;
  if (isWorkDay(d)) { if (plan.work === 'review') return 0; if (plan.work === 'half') return Math.max(0.25, plan.amount / 2); }
  return plan.amount;
}
// الجديد: الجزء الجاي اللي ما خلص
export function nextPortion(d = logicalToday()) {
  const plan = hifzPlan();
  const amt = amountOn(d);
  if (!plan || !amt) return null;
  const pages = orderPages(plan);
  if (amt < 1) {
    const parts = Math.round(1 / amt);
    for (const p of pages) {
      const m = memoOf(p);
      if (complete(m)) continue;
      const done = m && m.of === parts ? (m.p || 0) : 0;
      return { pages: [p], part: done + 1, of: parts, label: PART_NAMES[parts]?.[done] || '' };
    }
    return null;
  }
  const out = [];
  for (const p of pages) { if (!complete(memoOf(p))) out.push(p); if (out.length >= amt) break; }
  return out.length ? { pages: out, part: null, of: 1 } : null;
}

/* ---------- المراجعة ---------- */
const memorized = () => Object.entries(q().memo || {}).filter(([, m]) => complete(m)).map(([p, m]) => ({ p: Number(p), ...m }));
export function nearPages(d = logicalToday()) {
  const plan = hifzPlan();
  const n = plan?.near || 5;
  // القريبة: بس الصفحات اللي حفظتها بالخطة (مش القديم اللي علّمته محفوظ)
  return memorized().filter((x) => x.at && x.at !== d && x.seq > 0).sort((a, b) => (b.at || '').localeCompare(a.at || '') || b.seq - a.seq).slice(0, n).map((x) => x.p).sort((a, b) => a - b);
}
const interval = (m) => (m.m >= 90 ? Math.min(30, 2 ** Math.min(5, m.r || 0)) : m.m >= 60 ? 2 : 1);
export function farPages(d = logicalToday()) {
  const near = new Set(nearPages(d));
  const due = memorized().filter((x) => !near.has(x.p) && (!x.last || daysBetween(x.last, d) >= interval(x)))
    .sort((a, b) => (a.last || '').localeCompare(b.last || '') || a.m - b.m);
  if (!due.length) return [];
  // منجمّع صفحات متتالية مشان تكون المراجعة مقطع واحد
  const first = due[0].p;
  const set = new Set(due.map((x) => x.p));
  const out = [first];
  for (let k = 1; out.length < FAR_PER_DAY && k < 20; k++) { if (set.has(first + k)) out.push(first + k); else if (set.has(first - k)) out.unshift(first - k); }
  return out.sort((a, b) => a - b);
}

/* ---------- سجل اليوم ---------- */
export const hifzLog = (d) => q().hifzLog?.[d] || {};
function logSet(d, key, val) {
  store.update((s) => { s.quran.hifzLog = s.quran.hifzLog || {}; s.quran.hifzLog[d] = { ...(s.quran.hifzLog[d] || {}), [key]: val }; });
}
let seqN = Date.now();
// تقييم الجديد: good متقن، mid فيه أخطاء، redo بدّه إعادة
export function rateNew(d, portion, rate) {
  if (!portion) return;
  if (rate !== 'redo') {
    store.update((s) => {
      s.quran.memo = s.quran.memo || {};
      for (const p of portion.pages) {
        const prev = s.quran.memo[p] || {};
        if (portion.of > 1) {
          const done = prev.of === portion.of ? (prev.p || 0) : 0;
          const np = Math.max(done, portion.part);
          s.quran.memo[p] = { ...prev, of: portion.of, p: np, m: np >= portion.of ? (rate === 'good' ? 80 : 50) : (prev.m || 0) || 1, at: d, last: d, r: 0, seq: (seqN += 1) };
        } else s.quran.memo[p] = { m: rate === 'good' ? 80 : 50, at: d, last: d, r: 0, seq: (seqN += 1) };
      }
    }, { silent: true });
    award(`hifz:${d}:new`, POINTS.unit, 'حفظ جديد', d);
  }
  logSet(d, 'new', { pages: portion.pages, part: portion.part, of: portion.of, rate });
}
export function rateReview(d, key, pages, rate) {
  store.update((s) => {
    s.quran.memo = s.quran.memo || {};
    for (const p of pages) {
      const m = s.quran.memo[p];
      if (!m) continue;
      if (rate === 'good') { m.m = Math.min(100, (m.m || 50) + 15); m.r = (m.r || 0) + 1; }
      else if (rate === 'mid') { m.m = Math.max(40, (m.m || 50) - 10); m.r = Math.max(0, (m.r || 0) - 1); }
      else { m.m = 30; m.r = 0; }
      m.last = d;
    }
  }, { silent: true });
  award(`hifz:${d}:${key}`, 2, 'مراجعة حفظ', d);
  logSet(d, key, { pages, rate });
}
export function undoRate(d, key) {
  store.update((s) => { if (s.quran.hifzLog?.[d]) delete s.quran.hifzLog[d][key]; });
}

// حالة اليوم: شو مطلوب وشو خلص
export function hifzToday(d = logicalToday()) {
  const plan = hifzPlan();
  if (!plan) return null;
  const log = hifzLog(d);
  const portion = log.new ? null : nextPortion(d);
  const near = log.near ? log.near.pages : nearPages(d);
  const far = log.far ? log.far.pages : farPages(d);
  const need = [!log.new && portion ? 1 : 0, !log.near && near.length ? 1 : 0, !log.far && far.length ? 1 : 0].reduce((a, b) => a + b, 0);
  return { plan, log, portion, near, far, need, done: need === 0 };
}

/* ---------- الأرقام والخريطة ---------- */
export function hifzStats(d = logicalToday()) {
  const mem = memorized();
  const plan = hifzPlan();
  const nx = nextPortion(d);
  const curJuz = nx ? juzOfPage(nx.pages[0]) : null;
  const due = new Set(farPages(d));
  const juz = [];
  for (let j = 1; j <= 30; j++) {
    const a = juzStart(j), b = j === 30 ? TOTAL_PAGES : juzStart(j + 1) - 1;
    const ps = mem.filter((x) => x.p >= a && x.p <= b);
    const weak = ps.filter((x) => x.m < 60 || due.has(x.p)).length;
    let st = '';
    if (j === curJuz) st = 'n';
    else if (ps.length && weak) st = 'w';
    else if (ps.length) st = 's';
    juz.push({ j, st, n: ps.length, len: b - a + 1 });
  }
  // متى بتخلص الجزء الحالي
  let eta = null;
  if (plan && nx && curJuz) {
    const a = juzStart(curJuz), b = curJuz === 30 ? TOTAL_PAGES : juzStart(curJuz + 1) - 1;
    let left = 0; for (let p = a; p <= b; p++) if (!complete(memoOf(p))) left += 1;
    const perDay = plan.amount;
    const homeShare = store.state.settings.shift?.enabled && plan.work === 'review' ? 0.5 : store.state.settings.shift?.enabled && plan.work === 'half' ? 0.75 : 1;
    eta = { juz: curJuz, left, days: Math.ceil(left / perDay / homeShare) };
  }
  return { pages: mem.length, juzCount: mem.length / 20, juz, eta };
}

/* ---------- الخطة والمحفوظ القديم ---------- */
export function setHifzPlan(patch) {
  store.update((s) => { s.quran.hifzPlan = { amount: 0.5, order: 'back', start: TOTAL_PAGES, work: 'review', near: 5, since: logicalToday(), ...(s.quran.hifzPlan || {}), ...patch }; });
}
export function clearHifzPlan() { store.update((s) => { s.quran.hifzPlan = null; }); }
// «حافظه من قبل»: صفحات بمتانة منيحة
export function markMemorized(pages, strong = true) {
  const d = logicalToday();
  store.update((s) => {
    s.quran.memo = s.quran.memo || {};
    for (const p of pages) if (p >= 1 && p <= TOTAL_PAGES) s.quran.memo[p] = { m: strong ? 90 : 60, at: addDays(d, -30), last: addDays(d, -(3 + (p % 7))), r: strong ? 2 : 0, seq: 0 };
  });
}
export function unmarkPages(pages) {
  store.update((s) => { for (const p of pages) if (s.quran.memo) delete s.quran.memo[p]; });
}
export const juzPages = (j) => { const a = juzStart(j), b = j === 30 ? TOTAL_PAGES : juzStart(j + 1) - 1; return Array.from({ length: b - a + 1 }, (_, i) => a + i); };
export function surahPages(n) {
  const s = SURAHS[n - 1], next = SURAHS[n];
  const end = next ? Math.max(s.page, next.page - (next.page > s.page ? 1 : 0)) : TOTAL_PAGES;
  return Array.from({ length: end - s.page + 1 }, (_, i) => s.page + i);
}

// نقل الحفظ القديم (سور ووحدات) لنظام الصفحات — مرة وحدة
export function migrateLegacyHifz() {
  const qq = q();
  if (qq.memoMigrated || !(qq.hifz || []).length) return;
  const pages = new Set();
  for (const it of qq.hifz) {
    if (it.kind === 'pages') { for (const u of it.units || []) if ((u.mastery || 0) >= 100 && u.page) pages.add(u.page); }
    else if (it.kind === 'surah' && it.surah && (it.units || []).length && it.units.every((u) => (u.mastery || 0) >= 100)) surahPages(it.surah).forEach((p) => pages.add(p));
  }
  if (pages.size) markMemorized([...pages]);
  store.update((s) => { s.quran.memoMigrated = true; }, { silent: true });
}
