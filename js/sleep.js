// الروتين الثابت والنوم: النوم بينحسب من الفجر الجاي (قدّيش بدك تنام وقدّيش قبل الأذان بدك تصحى)،
// ومنه ومن القيلولة ودوام الشغل (بأيام الشغل) بينحسب الفراغ الحقيقي بكل فترة.
import { store } from './store.js';
import { adhanFor, periodsFor, PERIODS, PRAYERS } from './prayer.js';
import { addDays, toMin } from './dates.js';
import { shiftOn } from './shifts.js';

// النوم بدورات: كل دورة شي ساعة ونص، وربع ساعة لتغفى. الصحيان بآخر دورة (مش بنصها) بيخلّيك تفيق نشيط.
export const CYCLE = 90;
const DEF = { cycles: 5, fallAsleep: 15, wakeMode: 'fajr', wakeBefore: 15, wakeTime: '04:00', nap: { on: false, period: 'dhuhr', minutes: 20 }, work: { on: true, from: '07:00', to: '15:00' }, remind: true };
export const WAKE_MODES = { fajr: 'قبل الفجر', qiyam: 'قيام الليل', custom: 'ساعة تانية' };
export function sleepCfg() {
  const c = store.state.settings.sleep || {};
  const out = { ...DEF, ...c, nap: { ...DEF.nap, ...(c.nap || {}) }, work: { ...DEF.work, ...(c.work || {}) } };
  // النسخة الأولى كانت بالساعات: منحوّلها لأقرب عدد دورات
  if (c.cycles == null && c.hours) out.cycles = Math.max(3, Math.min(6, Math.round((Number(c.hours) * 60) / CYCLE)));
  out.hours = (out.cycles * CYCLE) / 60;
  return out;
}
export const NAP_PERIODS = { fajr: 'بعد الفجر', dhuhr: 'بعد الظهر', asr: 'بعد العصر' };

export const isWorkDay = (d) => Boolean(store.state.settings.shift?.enabled) && shiftOn(d)?.kind === 'work';

// وقت الصحيان المطلوب بالدقائق من نص ليل اليوم المنطقي (بعد نص الليل = +1440)
export function wakeTarget(day, c = sleepCfg()) {
  const fajr = toMin(adhanFor(addDays(day, 1)).fajr) + 1440;
  if (c.wakeMode === 'fajr' || !c.wakeTime) return { wake: fajr - (Number(c.wakeBefore) || 0), fajr };
  let w = toMin(c.wakeTime);
  if (w < 12 * 60) w += 1440; // ساعة بالليل/الصبح = بعد نص الليل
  return { wake: w, fajr };
}
// أوقات الليلة اللي بآخر اليوم المنطقي
export function sleepTimes(day) {
  const c = sleepCfg();
  const { wake, fajr } = wakeTarget(day, c);
  const bed = wake - c.cycles * CYCLE - (Number(c.fallAsleep) || 0);
  return { bed, wake, fajr, cycles: c.cycles };
}

// اقتراحات وقت النوم لصحيان معيّن: 6، 5، 4، 3 دورات
export function bedSuggestions(day) {
  const c = sleepCfg();
  const { wake } = wakeTarget(day, c);
  const p = periodsFor(day);
  const busy = lastBusyTonight(day);
  return [6, 5, 4, 3].map((n) => {
    const bed = wake - n * CYCLE - (Number(c.fallAsleep) || 0);
    const early = bed < p.isha.from;
    const clash = busy != null && bed < busy;
    return { n, bed, hours: (n * CYCLE) / 60, mine: n === c.cycles, early, clash };
  });
}
// آخر مهمة بساعة محددة الليلة (مع مدتها) — مشان ما نقترح نوم قبلها
export function lastBusyTonight(day) {
  const p = periodsFor(day);
  let last = null;
  for (const t of store.state.tasks) {
    if (t.date !== day || !t.time || t.done) continue;
    let m = toMin(t.time);
    if (m < p.fajr.from - 60) m += 1440;
    if (m < p.maghrib.from) continue;
    const end = m + (t.estimate || 30);
    if (last == null || end > last) last = end;
  }
  return last;
}
// العكس: إذا نمت هلّق، فيق إيمت؟
export function wakeOptions(bedMin) {
  const c = sleepCfg();
  return [1, 2, 3, 4, 5, 6].map((n) => ({ n, wake: bedMin + (Number(c.fallAsleep) || 0) + n * CYCLE }));
}
// هل الصحيان بيجي بنص دورة؟
export function midCycle(bedMin, wakeMin) {
  const c = sleepCfg();
  const k = (wakeMin - bedMin - (Number(c.fallAsleep) || 0)) / CYCLE;
  const frac = k - Math.floor(k);
  return k > 0.5 && frac > 0.2 && frac < 0.8 ? { k, before: bedMin + (Number(c.fallAsleep) || 0) + Math.floor(k) * CYCLE, after: bedMin + (Number(c.fallAsleep) || 0) + Math.ceil(k) * CYCLE } : null;
}

// الكتل المشغولة: النوم، القيلولة، والشغل (الصلاة أصلاً برّا الفترات)
export function busyBlocks(day, { kind } = {}) {
  const c = sleepCfg();
  const p = periodsFor(day);
  const st = sleepTimes(day);
  const out = [{ k: 'sleep', from: st.bed, to: st.wake }];
  if (c.nap.on && p[c.nap.period]) {
    const f = p[c.nap.period].from;
    out.push({ k: 'nap', from: f, to: Math.min(p[c.nap.period].to, f + (Number(c.nap.minutes) || 30)) });
  }
  const work = kind ? kind === 'work' : isWorkDay(day);
  if (work && c.work.on !== false && c.work.from && c.work.to) {
    let f = toMin(c.work.from), t = toMin(c.work.to);
    if (t <= f) t += 1440;
    if (f < p.fajr.from - 60) { f += 1440; t += 1440; }
    out.push({ k: 'work', from: f, to: t });
  }
  return out;
}

// قدّيش من نافذة معيّنة مشغول (اتحاد الكتل)
function busyIn(blocks, a, b) {
  const xs = blocks.map((x) => [Math.max(a, x.from), Math.min(b, x.to)]).filter(([f, t]) => t > f).sort((x, y) => x[0] - y[0]);
  let sum = 0, cf = null, ct = null;
  for (const [f, t] of xs) {
    if (cf === null) { cf = f; ct = t; } else if (f <= ct) ct = Math.max(ct, t); else { sum += ct - cf; cf = f; ct = t; }
  }
  if (cf !== null) sum += ct - cf;
  return sum;
}

// الفراغ بكل فترة بالدقائق (from: من وين نبلّش نحسب، مثلاً من هلّق)
export function freeIn(day, k, { from = null, kind } = {}) {
  const p = periodsFor(day)[k];
  if (!p) return 0;
  const a = from == null ? p.from : Math.max(p.from, from);
  if (a >= p.to) return 0;
  return Math.max(0, p.to - a - busyIn(busyBlocks(day, { kind }), a, p.to));
}
export function freeByStation(day, opts = {}) {
  return Object.fromEntries(PERIODS.map((k) => [k, freeIn(day, k, opts)]));
}
export const freeTotal = (day, opts) => Object.values(freeByStation(day, opts)).reduce((a, b) => a + b, 0);

// أوقات الصلوات كمقاطع للساعة
export function prayerBlocks(day) {
  const a = adhanFor(day);
  const dur = store.state.settings.prayer.duration || 30;
  return PRAYERS.map((k) => ({ k, from: toMin(a[k]), to: toMin(a[k]) + dur }));
}

/* ---------- سجل الصحيان ---------- */
export const wakeLog = (day) => store.state.sleepLog?.[day] || null;
export function setWake(day, ok) {
  store.update((s) => { if (!s.sleepLog) s.sleepLog = {}; s.sleepLog[day] = { fajr: Boolean(ok), at: Date.now() }; });
}
// إذا ضغطت غلط: بيرجع اليوم بلا جواب
export function clearWake(day) {
  store.update((s) => { if (s.sleepLog) delete s.sleepLog[day]; });
}
// الضغط على يوم بالسجل: بلا جواب ← صحيت ← ما صحيت ← بلا جواب
export function cycleWake(day) {
  const l = wakeLog(day);
  if (!l) setWake(day, true);
  else if (l.fajr) setWake(day, false);
  else clearWake(day);
}
export function wakeStreak(today) {
  let d = wakeLog(today) ? today : addDays(today, -1);
  let n = 0;
  while (wakeLog(d)?.fajr) { n += 1; d = addDays(d, -1); }
  return n;
}
