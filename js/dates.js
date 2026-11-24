// التواريخ بأسماء الأشهر الشامية، والأسبوع يبدأ بالسبت
export const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
export const SHORT_MONTHS = ['ك2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'ت1', 'ت2', 'ك1'];
export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const WEEK_SHORT = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
export const WEEK_START = 6; // السبت

const pad = (n) => String(n).padStart(2, '0');

export function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1, 12);
}
export function calendarToday() { return iso(new Date()); }
export function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
export function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
export function weekday(s) { return parseISO(s).getDay(); }
export function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
export function monthKey(s) { return s.slice(0, 7); }
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function monthLabel(key, { year = true } = {}) {
  const [y, m] = key.split('-').map(Number);
  return year ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}
// أول يوم (السبت) من أسبوع التاريخ
export function weekStartOf(s) {
  const d = parseISO(s);
  const back = (d.getDay() - WEEK_START + 7) % 7;
  d.setDate(d.getDate() - back);
  return iso(d);
}
export function weekDates(start) { return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }
export function weekLabel(start) {
  const end = addDays(start, 6);
  const a = parseISO(start), b = parseISO(end);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}`;
  return `${a.getDate()} ${SHORT_MONTHS[a.getMonth()]} – ${b.getDate()} ${SHORT_MONTHS[b.getMonth()]}`;
}
// التاريخ الهجري (أم القرى)
export function hijriDate(s, opts = { day: 'numeric', month: 'long' }) {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', opts).format(parseISO(s));
  } catch { return ''; }
}
export function hijriParts(s) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(parseISO(s));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    return { day: get('day'), month: get('month'), year: get('year') };
  } catch { return null; }
}
export function longDate(s) {
  const d = parseISO(s);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function shortDate(s) {
  const d = parseISO(s);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
// «اليوم» «بكرة» «أمس» أو اسم اليوم والتاريخ — بالنسبة لليوم المنطقي
export function dayLabel(s, today) {
  const diff = daysBetween(today, s);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'بكرة';
  if (diff === 2) return 'بعد بكرة';
  if (diff === -1) return 'أمس';
  const d = parseISO(s);
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === parseISO(today).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
export function relDays(s, today) {
  const n = daysBetween(today, s);
  if (n === 0) return 'اليوم';
  if (n === 1) return 'بكرة';
  if (n === -1) return 'أمس';
  if (n > 0) return `بعد ${daysText(n)}`;
  return `قبل ${daysText(-n)}`;
}

// العدد مع المعدود: [مفرد، مثنى، جمع 3-10، مفرد 11+]
export function countText(n, [one, two, few, many]) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}
export const daysText = (n) => countText(n, ['يوم', 'يومين', 'أيام', 'يوم']);
// «اليوم / بكرة / بعد يومين / بعد 3 أيام / بعد 11 يوم»
export const inDaysText = (n) => (n === 0 ? 'اليوم' : n === 1 ? 'بكرة' : `بعد ${daysText(n)}`);
export const tasksText = (n) => countText(n, ['مهمة وحدة', 'مهمتين', 'مهام', 'مهمة']);
export const pagesText = (n) => countText(n, ['صفحة', 'صفحتين', 'صفحات', 'صفحة']);
export const minutesText = (n) => countText(n, ['دقيقة', 'دقيقتين', 'دقائق', 'دقيقة']);
export const timesText = (n) => countText(n, ['مرة', 'مرتين', 'مرات', 'مرة']);

// «9:30 ص»
export function time12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'ص' : 'م';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${suffix}`;
}
export const toMin = (hhmm) => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const fromMin = (mins) => { const t = ((Math.round(mins) % 1440) + 1440) % 1440; return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };
export function durText(min) {
  min = Math.round(min);
  if (min < 60) return minutesText(Math.max(0, min));
  const h = Math.floor(min / 60), m = min % 60;
  const hs = countText(h, ['ساعة', 'ساعتين', 'ساعات', 'ساعة']);
  return m ? `${hs} و${m} د` : hs;
}
export function clockText(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
