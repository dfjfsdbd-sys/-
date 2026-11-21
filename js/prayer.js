// أوقات الصلاة (حساب فلكي على الجهاز)، فترات اليوم، واليوم المنطقي الذي يبدأ بعد الفجر
import { store } from './store.js';
import { iso, toMin, fromMin, addDays } from './dates.js';

export const PRAYER_METHODS = {
  mwl: { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
  isna: { name: 'الهيئة الأمريكية (ISNA)', fajr: 15, isha: 15 },
  egypt: { name: 'الهيئة المصرية', fajr: 19.5, isha: 17.5 },
  makkah: { name: 'أم القرى', fajr: 18.5, ishaMinutes: 90 },
  karachi: { name: 'كراتشي', fajr: 18, isha: 18 },
  turkey: { name: 'رئاسة الشؤون الدينية (تركيا)', fajr: 18, isha: 17 },
};
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_NAMES = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };

// فترات اليوم: كل فترة تبدأ بعد صلاتها وتنتهي بالأذان التالي. لونها لون السماء في وقتها
export const PERIODS = ['fajr', 'morning', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PERIOD_NAMES = { fajr: 'بعد الفجر', morning: 'الصباح', dhuhr: 'بعد الظهر', asr: 'بعد العصر', maghrib: 'بعد المغرب', isha: 'بعد العشاء' };
export const PERIOD_SHORT = { fajr: 'الفجر', morning: 'الصباح', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
export const PERIOD_SKY = { fajr: '#8E8CF0', morning: '#F0C96A', dhuhr: '#62C2D6', asr: '#F0A35E', maghrib: '#E9839F', isha: '#6F86D9' };
export const PERIOD_ICON = { fajr: 'sunrise', morning: 'sun', dhuhr: 'sun', asr: 'cloud', maghrib: 'sunset', isha: 'moon' };

const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
const fixAngle = (a) => { a -= 360 * Math.floor(a / 360); return a < 0 ? a + 360 : a; };
const fixHour = (h) => { h -= 24 * Math.floor(h / 24); return h < 0 ? h + 24 : h; };
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)));
  const e = 23.439 - 0.00000036 * D;
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  const RA = fixHour(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15);
  return { decl, eqt: q / 15 - RA };
}
function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function hourAngle(angle, lat, decl) {
  const c = (-Math.sin(rad(angle)) - Math.sin(rad(lat)) * Math.sin(rad(decl))) / (Math.cos(rad(lat)) * Math.cos(rad(decl)));
  if (c > 1 || c < -1) return null;
  return deg(Math.acos(c)) / 15;
}

// الأوقات بالساعات العشرية لتاريخ معيّن
export function computeTimes(date, p) {
  const m = PRAYER_METHODS[p.method] || PRAYER_METHODS.mwl;
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - p.lng / (15 * 24);
  const sp = sunPosition(jd);
  const tz = -date.getTimezoneOffset() / 60;
  const noon = fixHour(12 - sp.eqt) + tz - p.lng / 15;
  const hFajr = hourAngle(m.fajr, p.lat, sp.decl);
  const hSun = hourAngle(0.833, p.lat, sp.decl);
  const shadow = p.asrMadhab === 'hanafi' ? 2 : 1;
  const asrAngle = -deg(Math.atan(1 / (shadow + Math.tan(rad(Math.abs(p.lat - sp.decl))))));
  const hAsr = hourAngle(asrAngle, p.lat, sp.decl);
  const out = {
    fajr: hFajr !== null ? noon - hFajr : null,
    sunrise: hSun !== null ? noon - hSun : null,
    dhuhr: noon + 1 / 60,
    asr: hAsr !== null ? noon + hAsr : null,
    maghrib: hSun !== null ? noon + hSun : null,
  };
  if (m.ishaMinutes !== undefined) out.isha = out.maghrib !== null ? out.maghrib + m.ishaMinutes / 60 : null;
  else { const hIsha = hourAngle(m.isha, p.lat, sp.decl); out.isha = hIsha !== null ? noon + hIsha : null; }
  const tune = (p.tuning || 0) / 60, per = p.tune || {};
  for (const k of Object.keys(out)) if (out[k] !== null) out[k] = fixHour(out[k] + tune + ((k !== 'sunrise' && per[k]) ? per[k] / 60 : 0));
  return out;
}
const toHHMM = (h) => (h === null || h === undefined ? null : fromMin(h * 60));

export const hasLocation = () => {
  const p = store.state.settings.prayer;
  return p.lat !== null && p.lat !== undefined && p.lng !== null && p.lng !== undefined;
};

// أذان يوم معيّن «HH:MM»، وإن لم يُحدَّد الموقع نستعمل أوقاتاً تقريبية حتى لا تتعطّل الفترات
const FALLBACK = { fajr: '05:00', sunrise: '06:30', dhuhr: '12:00', asr: '15:15', maghrib: '17:45', isha: '19:15' };
const cache = new Map();
export function adhanFor(dayIso) {
  const p = store.state.settings.prayer;
  const key = `${dayIso}|${p.lat}|${p.lng}|${p.method}|${p.asrMadhab}|${p.tuning}|${JSON.stringify(p.tune || {})}`;
  if (cache.has(key)) return cache.get(key);
  let out;
  if (!hasLocation()) out = { ...FALLBACK, approx: true };
  else {
    const [y, mo, d] = dayIso.split('-').map(Number);
    const t = computeTimes(new Date(y, mo - 1, d, 12), p);
    out = {};
    for (const k of Object.keys(t)) out[k] = toHHMM(t[k]);
  }
  cache.set(key, out);
  return out;
}

// حدود الفترات ليوم: {fajr:{from,to}, ...} بالدقائق من منتصف ليل ذلك اليوم (العشاء يمتد لما بعد منتصف الليل)
export function periodsFor(dayIso) {
  const a = adhanFor(dayIso), next = adhanFor(addDays(dayIso, 1));
  const dur = store.state.settings.prayer.duration || 30;
  const off = store.state.settings.periodOffsets || {};
  const m = (k) => toMin(a[k]);
  const res = {
    fajr: { from: m('fajr') + dur, to: m('sunrise') },
    morning: { from: m('sunrise') + (off.morning || 0), to: m('dhuhr') },
    dhuhr: { from: m('dhuhr') + dur, to: m('asr') },
    asr: { from: m('asr') + dur, to: m('maghrib') },
    maghrib: { from: m('maghrib') + dur, to: m('isha') },
    isha: { from: m('isha') + dur, to: toMin(next.fajr) + 1440 },
  };
  for (const k of PERIODS) { if (off[k] && k !== 'morning') res[k].from += off[k]; if (res[k].from > res[k].to) res[k].from = res[k].to; }
  return res;
}

// اليوم المنطقي: قبل انتهاء صلاة الفجر نحسب الوقت لليوم السابق
export function dayBoundaryMin(calDayIso) {
  const a = adhanFor(calDayIso);
  return (toMin(a.fajr) + (store.state.settings.prayer.duration || 30)) % 1440;
}
export function logicalToday(now = new Date()) {
  const cal = iso(now);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur < dayBoundaryMin(cal) ? addDays(cal, -1) : cal;
}
// الدقيقة الحالية بالنسبة لبداية اليوم المنطقي (قد تتجاوز 1440 بعد منتصف الليل)
export function nowMinOfLogical(now = new Date()) {
  const cur = now.getHours() * 60 + now.getMinutes();
  return logicalToday(now) === iso(now) ? cur : cur + 1440;
}
export function currentPeriod(now = new Date()) {
  const day = logicalToday(now);
  const p = periodsFor(day), t = nowMinOfLogical(now);
  const a = adhanFor(day);
  let found = null;
  for (const k of PERIODS) if (t >= p[k].from && t < p[k].to) found = k;
  if (!found) {
    // بين الأذان ونهاية الصلاة: نعدّها فترة الصلاة التالية
    for (const k of PERIODS) if (t < p[k].from) { found = k; break; }
  }
  const inPrayer = PRAYERS.find((k) => { const s = toMin(a[k]); return t >= s && t < s + (store.state.settings.prayer.duration || 30); }) || null;
  return { key: found || 'isha', inPrayer };
}
// الصلاة التالية والوقت المتبقي
export function nextPrayer(now = new Date()) {
  const day = logicalToday(now);
  const a = adhanFor(day), t = nowMinOfLogical(now);
  // اليوم المنطقي يبدأ بعد صلاة الفجر، فالفجر التالي هو فجر الغد
  for (const k of PRAYERS.slice(1)) {
    const s = toMin(a[k]);
    if (s > t) return { key: k, time: a[k], inMin: s - t };
  }
  const nf = adhanFor(addDays(day, 1)).fajr;
  return { key: 'fajr', time: nf, inMin: toMin(nf) + 1440 - t };
}
export function periodOfTime(hhmm, dayIso) {
  const p = periodsFor(dayIso);
  let t = toMin(hhmm);
  if (t < p.fajr.from - 60) t += 1440;
  for (const k of PERIODS) if (t >= p[k].from - 30 && t < p[k].to) return k;
  return 'isha';
}

export function locate({ silent = false } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = +pos.coords.latitude.toFixed(4), lng = +pos.coords.longitude.toFixed(4);
      store.update((s) => {
        const p = s.settings.prayer;
        const moved = p.lat == null || Math.abs(lat - p.lat) > 0.15 || Math.abs(lng - p.lng) > 0.15;
        if (moved || !silent) { p.lat = lat; p.lng = lng; }
        p.lastLocCheck = iso(new Date());
      });
      cache.clear();
      resolve({ lat, lng });
    }, () => resolve(null), { enableHighAccuracy: false, timeout: 12000, maximumAge: 3600000 });
  });
}
export const clearPrayerCache = () => cache.clear();
