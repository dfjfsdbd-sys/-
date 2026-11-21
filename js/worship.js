// العبادات: سجلّ الصلوات، الأذكار، ورد القرآن والختمات، والحفظ
import { store, uid } from './store.js';
import { award, revoke, POINTS } from './rewards.js';
import { PRAYERS } from './prayer.js';
import { ADHKAR_LISTS, ADHKAR_ORDER } from './data/adhkar.js';
import { TOTAL_PAGES } from './data/quran-meta.js';
import { addDays, daysBetween } from './dates.js';

/* ---------- الصلوات ---------- */
export const PRAYER_STATUS = {
  jamaah: { label: 'جماعة', short: 'جماعة', tint: 'mint', pts: POINTS.prayerJamaah },
  ontime: { label: 'بوقتها', short: 'بوقتها', tint: 'sky', pts: POINTS.prayer },
  late: { label: 'متأخرة', short: 'متأخرة', tint: 'amber', pts: 1 },
  missed: { label: 'فاتتني', short: 'فاتت', tint: 'coral', pts: 0 },
};
export const prayerOn = (day, key) => store.state.prayers.log?.[day]?.[key] || null;
export function setPrayer(day, key, status) {
  store.update((s) => {
    s.prayers.log[day] = s.prayers.log[day] || {};
    if (status) s.prayers.log[day][key] = status; else delete s.prayers.log[day][key];
  });
  const k = `prayer:${day}:${key}`;
  revoke(k);
  const st = PRAYER_STATUS[status === 'sunnah' ? 'ontime' : status];
  if (st?.pts) award(k, st.pts, `صلاة ${key}`, day);
}
export function prayerSunnah(day, key) { return Boolean(store.state.prayers.log?.[day]?.[`${key}_s`]); }
export function toggleSunnah(day, key) {
  store.update((s) => {
    s.prayers.log[day] = s.prayers.log[day] || {};
    s.prayers.log[day][`${key}_s`] = !s.prayers.log[day][`${key}_s`];
  });
}
const PRAYED = new Set(['jamaah', 'ontime', 'late', 'sunnah']);
export function prayersDone(day) {
  return PRAYERS.filter((k) => PRAYED.has(prayerOn(day, k))).length;
}

/* ---------- الأذكار ---------- */
export function adhkarSettings(id) {
  const st = store.state.adhkar.lists?.[id] || {};
  const def = { enabled: id === 'morning' || id === 'evening' || id === 'sleep', core: false };
  return { ...def, ...st };
}
export function adhkarList(id) {
  const base = ADHKAR_LISTS[id];
  if (!base) {
    const c = (store.state.adhkar.custom || []).find((x) => x.id === id);
    return c ? { ...c, custom: true } : null;
  }
  const edits = store.state.adhkar.edits?.[id] || {};
  const items = base.items.filter((x) => !edits.hidden?.includes(x.id)).map((x) => ({ ...x, count: edits.counts?.[x.id] ?? x.count }))
    .concat(edits.extra || []);
  return { ...base, items, image: adhkarSettings(id).image || null };
}
export function allAdhkarLists() {
  return [...ADHKAR_ORDER.map((id) => adhkarList(id)), ...(store.state.adhkar.custom || []).map((c) => ({ ...c, custom: true }))];
}
export const adhkarDone = (day, id) => Boolean(store.state.adhkar.log?.[day]?.[id]?.done);
export function setAdhkarDone(day, id, done = true) {
  store.update((s) => {
    s.adhkar.log[day] = s.adhkar.log[day] || {};
    if (done) s.adhkar.log[day][id] = { done: true, at: Date.now() };
    else delete s.adhkar.log[day][id];
  });
  const k = `adhkar:${day}:${id}`;
  if (done) award(k, POINTS.adhkar, adhkarList(id)?.name || 'أذكار', day); else revoke(k);
}
// تقدّم جلسة الأذكار الجارية (بيرجع لنفس المكان لو طلعت)
const SESSION_KEY = 'manz:adhkarSession';
export function loadAdhkarSession(day, id) {
  try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); if (s && s.day === day && s.id === id) return s.counts || {}; } catch { /* */ }
  return {};
}
export function saveAdhkarSession(day, id, counts) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ day, id, counts })); } catch { /* */ }
}

/* ---------- القرآن ---------- */
export const quranPage = () => store.state.quran.page || 1;
export function pagesReadOn(day) { return store.state.quran.log?.[day]?.pages || 0; }
// تسجيل قراءة: وصلت للصفحة n (أو قرأت عدداً من الصفحات)
export function readQuranTo(day, toPage) {
  const from = quranPage();
  let pages = toPage - from + 1;
  if (toPage < from) pages = 0;
  if (pages <= 0) return 0;
  let finished = false;
  store.update((s) => {
    const q = s.quran;
    q.log[day] = q.log[day] || { pages: 0 };
    q.log[day].pages += pages;
    q.log[day].to = toPage;
    q.page = toPage + 1;
    if (q.page > TOTAL_PAGES) {
      finished = true;
      q.page = 1;
      const n = (q.khatmas?.length || 0) + 1;
      q.khatmas.push({ id: uid('kh'), n, done: true, end: day, start: q.currentStart || null });
      q.currentStart = addDays(day, 1);
    }
    if (!q.currentStart) q.currentStart = day;
  });
  award(`quran:${day}:${toPage}`, pages * POINTS.quranPage, `قرآن ${pages} صفحة`, day);
  return finished ? -1 : pages;
}
export function addQuranPages(day, n) { return readQuranTo(day, Math.min(TOTAL_PAGES, quranPage() + n - 1)); }
export function undoQuranDay(day) {
  const log = store.state.quran.log?.[day];
  if (!log?.pages) return;
  store.update((s) => {
    s.quran.page = Math.max(1, (s.quran.page || 1) - log.pages);
    delete s.quran.log[day];
  });
  for (const e of [...store.state.rewards.ledger]) if (e.k.startsWith(`quran:${day}:`)) revoke(e.k);
}
export function quranStats(today) {
  const q = store.state.quran;
  const page = q.page || 1;
  const read = page - 1;
  const daily = store.state.settings.quranDaily || 10;
  const left = TOTAL_PAGES - read;
  // متوسط آخر 14 يوماً لتوقّع الختم
  let sum = 0;
  for (let i = 0; i < 14; i++) sum += pagesReadOn(addDays(today, -i));
  const avg = sum / 14;
  const pace = Math.max(avg, 0.0001);
  const etaDays = avg > 0 ? Math.ceil(left / pace) : null;
  return { page, read, left, pct: read / TOTAL_PAGES, daily, todayPages: pagesReadOn(today), avg, etaDays, eta: etaDays != null ? addDays(today, etaDays) : null, khatmas: (q.khatmas || []).length, daysToGoal: Math.ceil(left / daily) };
}
export function quranStreak(today) {
  let n = 0, d = pagesReadOn(today) ? today : addDays(today, -1);
  for (let i = 0; i < 400; i++) { if (pagesReadOn(d) > 0) { n += 1; d = addDays(d, -1); } else break; }
  return n;
}

/* ---------- الحفظ ---------- */
// كل عنصر حفظ: سورة أو صفحات، فيه وحدات، لكل وحدة: جديد/قيد الحفظ/محفوظ، وآخر مراجعة
export function hifzDue(today) {
  const out = [];
  for (const h of store.state.quran.hifz || []) {
    for (const u of h.units || []) {
      if (u.mastery >= 100 && u.lastReview) {
        const gap = daysBetween(u.lastReview, today);
        const interval = Math.min(30, 2 ** Math.min(5, u.reviews || 0));
        if (gap >= interval) out.push({ h, u, gap });
      }
    }
  }
  return out;
}
