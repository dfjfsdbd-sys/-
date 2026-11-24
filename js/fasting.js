// الصيام (السنن بالهجري)، القضاء (صلوات وأيام صيام بعدّاد)، والسنن الرواتب والنوافل
import { store } from './store.js';
import { addDays, hijriParts, weekday, daysBetween, daysText, inDaysText } from './dates.js';
import { logicalToday } from './prayer.js';
import { award } from './rewards.js';

/* ---------- السنن ---------- */
export const SUNNAH_SLOTS = [
  { k: 'fajr_b', name: 'قبل الفجر', rak: 2, prayer: 'fajr' },
  { k: 'dhuhr_b', name: 'قبل الظهر', rak: 4, prayer: 'dhuhr' },
  { k: 'dhuhr_a', name: 'بعد الظهر', rak: 2, prayer: 'dhuhr' },
  { k: 'maghrib_a', name: 'بعد المغرب', rak: 2, prayer: 'maghrib' },
  { k: 'isha_a', name: 'بعد العشاء', rak: 2, prayer: 'isha' },
];
export const NAWAFIL = [{ k: 'duha', name: 'الضحى', icon: 'sun' }, { k: 'witr', name: 'الوتر', icon: 'moon' }, { k: 'qiyam', name: 'قيام الليل', icon: 'star' }];
export function sunnahOn(day) {
  const s = store.state.sunnah?.[day] || {};
  const legacy = store.state.prayers.log?.[day] || {};
  // النسخة القديمة: «صلّيت السنّة الراتبة» لكل صلاة
  const out = { ...s };
  for (const sl of SUNNAH_SLOTS) if (out[sl.k] == null && legacy[`${sl.prayer}_s`] && SUNNAH_SLOTS.find((x) => x.prayer === sl.prayer) === sl) out[sl.k] = true;
  return out;
}
export function toggleSunnahSlot(day, k) {
  const on = !sunnahOn(day)[k];
  store.update((s) => { s.sunnah = s.sunnah || {}; s.sunnah[day] = { ...(s.sunnah[day] || {}), [k]: on }; });
  if (on) award(`sunnah:${day}:${k}`, 1, 'سنّة', day);
  return on;
}
export const rakaatOn = (day) => { const s = sunnahOn(day); return SUNNAH_SLOTS.reduce((a, x) => a + (s[x.k] ? x.rak : 0), 0); };
export function sunnahStreak(today = logicalToday()) {
  let d = rakaatOn(today) >= 12 ? today : addDays(today, -1);
  let n = 0;
  while (rakaatOn(d) >= 12 && n < 400) { n += 1; d = addDays(d, -1); }
  return n;
}

/* ---------- الصيام ---------- */
const fcfg = () => ({ monThu: false, white: true, special: true, remind: true, ...(store.state.fasting || {}) });
export const fastingCfg = fcfg;
export function setFastingCfg(patch) { store.update((s) => { s.fasting = { ...fcfg(), ...patch, log: s.fasting?.log || {} }; }); }
// شو سبب صيام هاليوم (إن وجد)؟ forbidden = يوم ما بيجوز صيامه
export function fastInfo(day) {
  const c = fcfg();
  const hp = hijriParts(day);
  if (!hp) return { reasons: [], forbidden: false };
  const { month: m, day: d } = hp;
  if ((m === 10 && d === 1) || (m === 12 && d >= 10 && d <= 13)) return { reasons: [], forbidden: true, why: m === 10 ? 'عيد الفطر' : d === 10 ? 'عيد الأضحى' : 'أيام التشريق' };
  const reasons = [];
  if (m === 9) reasons.push({ k: 'ramadan', name: 'رمضان', must: true });
  if (c.special) {
    if (m === 12 && d === 9) reasons.push({ k: 'arafah', name: 'يوم عرفة' });
    if (m === 1 && (d === 9 || d === 10)) reasons.push({ k: 'ashura', name: d === 10 ? 'عاشوراء' : 'تاسوعاء' });
    if (m === 10 && d >= 2) { const n = shawwalCount(day); if (n < 6) reasons.push({ k: 'shawwal', name: `الست من شوال (${n} من 6)` }); }
  }
  if (c.white && d >= 13 && d <= 15 && m !== 9) reasons.push({ k: 'white', name: 'الأيام البيض' });
  if (c.monThu && m !== 9) { const wd = weekday(day); if (wd === 1) reasons.push({ k: 'mon', name: 'الاثنين' }); if (wd === 4) reasons.push({ k: 'thu', name: 'الخميس' }); }
  return { reasons, forbidden: false, hijri: hp };
}
export const fastedOn = (day) => Boolean(store.state.fasting?.log?.[day]);
export function setFasted(day, v) {
  store.update((s) => { s.fasting = s.fasting || fcfg(); s.fasting.log = s.fasting.log || {}; if (v) s.fasting.log[day] = true; else delete s.fasting.log[day]; });
  if (v) award(`fast:${day}`, 15, 'صيام', day);
}
function shawwalCount(day) {
  const hp = hijriParts(day);
  if (!hp) return 0;
  let n = 0;
  for (let i = 1; i <= 30; i++) { const d = addDays(day, -i); const p = hijriParts(d); if (!p || p.month !== 10 || p.year !== hp.year) break; if (fastedOn(d)) n += 1; }
  return n;
}
export function upcomingFasts(today = logicalToday(), n = 4) {
  const out = [];
  for (let i = 0; i < 60 && out.length < n; i++) {
    const d = addDays(today, i);
    const f = fastInfo(d);
    if (f.reasons.length) out.push({ d, ...f });
  }
  return out;
}
export const monthFasts = (monthKey) => Object.keys(store.state.fasting?.log || {}).filter((d) => d.startsWith(monthKey)).length;

/* ---------- القضاء ---------- */
export const QADA_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const qd = () => ({ prayers: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, fasts: 0, log: [], ...(store.state.qada || {}) });
export const qada = qd;
export function qadaAdd(kind, delta, day = logicalToday()) {
  store.update((s) => {
    s.qada = qd();
    if (kind === 'fast') s.qada.fasts = Math.max(0, (s.qada.fasts || 0) + delta);
    else s.qada.prayers[kind] = Math.max(0, (s.qada.prayers[kind] || 0) + delta);
    s.qada.log = [...(s.qada.log || []).slice(-200), { d: day, kind, delta }];
  });
  if (delta < 0) award(`qada:${day}:${kind}:${(store.state.qada.log || []).length}`, 2, 'قضاء', day);
}
export const qadaPrayersTotal = () => Object.values(qd().prayers).reduce((a, b) => a + b, 0);
export function qadaPlanText(today, ramadanDate) {
  const out = [];
  const p = qadaPrayersTotal();
  if (p) out.push(`إذا قضيت صلاة مع كل فرض بتخلص الصلوات خلال ${daysText(Math.ceil(p / 5))}`);
  const f = qd().fasts;
  if (f && ramadanDate) {
    const days = daysBetween(today, ramadanDate);
    const every = Math.max(1, Math.floor(days / f));
    if (days > 0) out.push(`صيام: رمضان ${inDaysText(days)} — يوم ${every === 1 ? 'كل يوم' : every === 2 ? 'كل يومين' : `كل ${daysText(every)}`}`);
  }
  return out;
}
