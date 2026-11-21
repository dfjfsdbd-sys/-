// فهم جملة مهمة باللهجة: «بكرة الساعة 10 الصبح تحليل دم»، «قبل 7 الشهر»، «كل جمعة»، «قبل الشغل جيب الأوراق»
import { addDays, parseISO, iso, daysInMonth, MONTHS, time12, dayLabel, shortDate } from './dates.js';
import { nextShiftStart } from './shifts.js';
import { store } from './store.js';
import { PERIOD_NAMES } from './prayer.js';

const B = '(?:^|\\s)';           // بداية كلمة
const E = '(?=\\s|$|[،,.!؟?])';  // نهاية كلمة

const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const WORD_NUM = { 'واحد': 1, 'وحدة': 1, 'اتنين': 2, 'اثنين': 2, 'تنين': 2, 'تلاتة': 3, 'ثلاثة': 3, 'تلات': 3, 'ثلاث': 3, 'اربعة': 4, 'أربعة': 4, 'اربع': 4, 'أربع': 4, 'خمسة': 5, 'خمس': 5, 'ستة': 6, 'ست': 6, 'سبعة': 7, 'سبع': 7, 'تمانية': 8, 'ثمانية': 8, 'تمن': 8, 'تسعة': 9, 'تسع': 9, 'عشرة': 10, 'عشر': 10, 'حداش': 11, 'احدعش': 11, 'اطناش': 12, 'اثنعش': 12 };

const WEEKDAY_WORDS = [
  [0, ['الأحد', 'الاحد', 'أحد', 'احد']],
  [1, ['الاثنين', 'الإثنين', 'اثنين', 'إثنين', 'التنين', 'تنين']],
  [2, ['الثلاثاء', 'الثلاثا', 'التلات', 'التلاتا', 'ثلاثاء', 'تلات']],
  [3, ['الأربعاء', 'الاربعاء', 'الأربعا', 'الاربعا', 'أربعاء', 'اربعا']],
  [4, ['الخميس', 'خميس']],
  [5, ['الجمعة', 'الجمعه', 'جمعة', 'جمعه']],
  [6, ['السبت', 'سبت']],
];
const MONTH_WORDS = [
  ['كانون الثاني', 1], ['يناير', 1], ['شباط', 2], ['فبراير', 2], ['آذار', 3], ['اذار', 3], ['مارس', 3], ['نيسان', 4], ['أبريل', 4], ['ابريل', 4],
  ['أيار', 5], ['ايار', 5], ['مايو', 5], ['حزيران', 6], ['يونيو', 6], ['تموز', 7], ['يوليو', 7], ['آب', 8], ['اب', 8], ['أغسطس', 8], ['اغسطس', 8],
  ['أيلول', 9], ['ايلول', 9], ['سبتمبر', 9], ['تشرين الأول', 10], ['تشرين الاول', 10], ['أكتوبر', 10], ['اكتوبر', 10], ['تشرين الثاني', 11], ['نوفمبر', 11],
  ['كانون الأول', 12], ['كانون الاول', 12], ['ديسمبر', 12],
];
const PERIOD_WORDS = [
  ['fajr', ['بعد الفجر', 'بعد صلاة الفجر', 'عالفجر']],
  ['morning', ['الصبح', 'الصباح', 'الضحى', 'عالصبح', 'الصبحية', 'بالصبح']],
  ['dhuhr', ['بعد الظهر', 'بعد الضهر', 'الضهر', 'بعد صلاة الظهر', 'عالضهر']],
  ['asr', ['بعد العصر', 'العصرية', 'بعد صلاة العصر']],
  ['maghrib', ['بعد المغرب', 'بعد صلاة المغرب', 'المغربية']],
  ['isha', ['بعد العشاء', 'بعد العشا', 'العشية', 'بالليل', 'الليل', 'المسا', 'المساء', 'بعد صلاة العشاء']],
];
const TAG_WORDS = [
  ['study', ['محاضرة', 'محاضرات', 'امتحان', 'مذاكرة', 'ادرس', 'دراسة', 'جامعة', 'الجامعة', 'تقرير', 'بحث', 'وظيفة', 'سكشن', 'عملي']],
  ['health', ['تحليل', 'تحاليل', 'دكتور', 'طبيب', 'دوا', 'دواء', 'عيادة', 'صورة أشعة', 'أسنان', 'مشفى', 'مستشفى']],
  ['errand', ['اشتري', 'جيب', 'سوق', 'السوق', 'غراض', 'أغراض', 'مشوار', 'ادفع', 'فاتورة', 'بنك', 'صرّاف', 'أوراق', 'الأوراق', 'معاملة']],
  ['work', ['الشغل', 'شغل', 'دوام', 'النوبة', 'مناوبة', 'تقرير الشغل']],
  ['marriage', ['زواج', 'العرس', 'عرس', 'خطبة', 'الخطبة', 'العروس', 'جهاز', 'شبكة', 'فرش']],
  ['sport', ['رياضة', 'جيم', 'تمرين', 'مشي', 'ركض', 'سباحة']],
  ['worship', ['قرآن', 'القرآن', 'ختمة', 'صيام', 'صدقة', 'قيام', 'تراويح', 'عمرة', 'درس شرعي']],
  ['family', ['أهلي', 'اهلي', 'أمي', 'امي', 'أبي', 'ابي', 'البيت', 'زيارة', 'أخوي', 'اختي']],
];

function norm(s) {
  return s.replace(/[٠-٩۰-۹]/g, (c) => DIGITS[c]).replace(/[ـ]/g, '').replace(/\s+/g, ' ').trim();
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (words) => words.map(esc).sort((a, b) => b.length - a.length).join('|');

function nextWeekday(fromIso, wd, { strict = false, skipWeek = false } = {}) {
  const d = parseISO(fromIso);
  let diff = (wd - d.getDay() + 7) % 7;
  if (diff === 0 && strict) diff = 7;
  if (skipWeek && diff < 7) diff += 7 * (diff === 0 ? 1 : 0);
  return addDays(fromIso, diff);
}
function dayOfMonth(today, day, nextMonth = false) {
  const t = parseISO(today);
  let y = t.getFullYear(), m = t.getMonth();
  if (nextMonth || day < t.getDate()) { m += 1; if (m > 11) { m = 0; y += 1; } }
  const dd = Math.min(day, daysInMonth(y, m));
  return iso(new Date(y, m, dd));
}

export function parseTask(input, today) {
  let text = ` ${norm(input)} `;
  const out = { title: '', date: null, time: null, period: null, due: null, recur: null, priority: 0, tag: null, remind: null, hints: [] };
  const take = (re, fn) => {
    const m = text.match(re);
    if (!m) return false;
    if (fn(m) === false) return false;
    text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
    return true;
  };
  const sh = store.state.settings.shift;

  // أولوية وتذكير
  take(new RegExp(`${B}(مهم جدا|مهم جداً|مهم|ضروري|ضرورية|عاجل)${E}`), () => { out.priority = 1; });
  take(new RegExp(`${B}(ذكرني|ذكّرني|نبهني|نبّهني|ذكرني فيها)${E}`), () => { out.remind = 0; });

  // التكرار
  const wdAll = WEEKDAY_WORDS.flatMap(([, w]) => w);
  take(new RegExp(`${B}(كل يوم|يوميا|يومياً|كل الأيام)${E}`), () => { out.recur = { type: 'daily' }; });
  take(new RegExp(`${B}كل (${alt(wdAll)})(?:\\s+و\\s*(${alt(wdAll)}))?(?:\\s+و\\s*(${alt(wdAll)}))?${E}`), (m) => {
    const days = [m[1], m[2], m[3]].filter(Boolean).map((w) => WEEKDAY_WORDS.find(([, ws]) => ws.includes(w))?.[0]).filter((x) => x != null);
    out.recur = { type: 'weekly', days };
  });
  take(new RegExp(`${B}كل (\\d{1,2}) (?:يوم|أيام|ايام)${E}`), (m) => { out.recur = { type: 'every', n: Number(m[1]) }; });
  take(new RegExp(`${B}(كل أسبوع|كل اسبوع|أسبوعيا|اسبوعياً|أسبوعياً)${E}`), () => { out.recur = { type: 'weekly', days: [parseISO(today).getDay()] }; });
  take(new RegExp(`${B}(?:كل شهر|شهريا|شهرياً)(?: (?:يوم|بـ?)? ?(\\d{1,2}))?${E}`), (m) => { out.recur = { type: 'monthly', day: Number(m[1]) || parseISO(today).getDate() }; });
  take(new RegExp(`${B}(كل سنة|سنويا|سنوياً)${E}`), () => { out.recur = { type: 'yearly' }; });
  take(new RegExp(`${B}(?:كل مرة |دايماً |دائماً )?قبل (?:كل )?(?:ما )?(?:روح |أروح |اروح |نزول |انزل )?(?:عالشغل|على الشغل|الشغل|النوبة|المناوبة)${E}`), (m) => {
    const every = /كل|دايماً|دائماً/.test(m[0]) || Boolean(out.recur);
    if (every) { out.recur = { type: 'shift', when: 'lastHome' }; return; }
    if (sh?.enabled) {
      const start = nextShiftStart(today, 'work');
      if (start) { out.date = addDays(start, -1); out.hints.push('قبل نوبة الشغل'); return; }
    }
    out.recur = { type: 'shift', when: 'lastHome' };
  });
  take(new RegExp(`${B}(?:كل )?أول يوم (?:ب|في )?(?:الشغل|النوبة)${E}`), (m) => {
    if (/كل/.test(m[0]) || !sh?.enabled) { out.recur = { type: 'shift', when: 'firstWork' }; return; }
    const d = nextShiftStart(today, 'work');
    if (d) out.date = d; else out.recur = { type: 'shift', when: 'firstWork' };
  });

  // الموعد النهائي: «قبل 7 الشهر» «قبل الخميس»
  let dueMode = false;
  if (new RegExp(`${B}(قبل|لحد|لغاية|حتى) (?=\\d|${alt(wdAll)}|آخر|اخر|أول|اول|بكرة|نهاية)`).test(text)) {
    take(new RegExp(`${B}(قبل|لحد|لغاية|حتى)${E}`), () => { dueMode = true; });
  }
  const setDate = (d, hint) => { if (dueMode) out.due = d; else out.date = d; if (hint) out.hints.push(hint); };

  // التاريخ
  take(new RegExp(`${B}(بعد بكرة|بعد بكره|بعد بكرا|بعد غد|بعد الغد)${E}`), () => setDate(addDays(today, 2)));
  take(new RegExp(`${B}(بكرة|بكره|بكرا|غدا|غداً|بكرة الصبح)${E}`), () => setDate(addDays(today, 1)));
  take(new RegExp(`${B}(اليوم|هلق|هلأ|النهار هاد)${E}`), () => setDate(today));
  take(new RegExp(`${B}بعد (\\d{1,3}|${alt(Object.keys(WORD_NUM))}) (يوم|أيام|ايام|اسبوع|أسبوع|اسابيع|أسابيع|شهر|أشهر|اشهر)${E}`), (m) => {
    const n = Number(m[1]) || WORD_NUM[m[1]] || 1;
    const unit = m[2];
    if (/شهر|أشهر|اشهر/.test(unit)) { const d = parseISO(today); d.setMonth(d.getMonth() + n); setDate(iso(d)); } else setDate(addDays(today, /سبوع|سابيع/.test(unit) ? n * 7 : n));
  });
  take(new RegExp(`${B}بعد (يومين|أسبوع|اسبوع|أسبوعين|اسبوعين|شهر|شهرين)${E}`), (m) => {
    const map = { 'يومين': 2, 'أسبوع': 7, 'اسبوع': 7, 'أسبوعين': 14, 'اسبوعين': 14 };
    if (m[1] === 'شهر' || m[1] === 'شهرين') { const d = parseISO(today); d.setMonth(d.getMonth() + (m[1] === 'شهر' ? 1 : 2)); setDate(iso(d)); } else setDate(addDays(today, map[m[1]]));
  });
  take(new RegExp(`${B}(الأسبوع الجاي|الاسبوع الجاي|الأسبوع القادم|الاسبوع القادم)${E}`), () => setDate(nextWeekday(today, 6, { strict: true })));
  take(new RegExp(`${B}(آخر|اخر|نهاية) الشهر(?: الجاي)?${E}`), (m) => {
    const t = parseISO(today); let y = t.getFullYear(), mo = t.getMonth();
    if (/الجاي/.test(m[0])) { mo += 1; if (mo > 11) { mo = 0; y += 1; } }
    setDate(iso(new Date(y, mo, daysInMonth(y, mo))));
  });
  take(new RegExp(`${B}(أول|اول|بداية) الشهر(?: الجاي)?${E}`), () => setDate(dayOfMonth(today, 1, true)));
  take(new RegExp(`${B}(?:بتاريخ |تاريخ |يوم )?(\\d{1,2}) (?:الشهر|بالشهر|من الشهر|هالشهر)( الجاي)?${E}`), (m) => setDate(dayOfMonth(today, Number(m[1]), Boolean(m[2]))));
  take(new RegExp(`${B}(?:بتاريخ |تاريخ |يوم )?(\\d{1,2}) (?:من |ب)?(${alt(MONTH_WORDS.map((x) => x[0]))})${E}`), (m) => {
    const mo = MONTH_WORDS.find((x) => x[0] === m[2])[1] - 1;
    const t = parseISO(today); let y = t.getFullYear();
    let d = iso(new Date(y, mo, Math.min(Number(m[1]), daysInMonth(y, mo))));
    if (d < today) { y += 1; d = iso(new Date(y, mo, Math.min(Number(m[1]), daysInMonth(y, mo)))); }
    setDate(d);
  });
  take(new RegExp(`${B}(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?${E}`), (m) => {
    const t = parseISO(today);
    let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : t.getFullYear();
    const mo = Number(m[2]) - 1, dd = Number(m[1]);
    if (mo < 0 || mo > 11 || dd < 1 || dd > 31) return false;
    let d = iso(new Date(y, mo, Math.min(dd, daysInMonth(y, mo))));
    if (!m[3] && d < today) { y += 1; d = iso(new Date(y, mo, Math.min(dd, daysInMonth(y, mo)))); }
    setDate(d);
  });
  if (!out.recur) {
    take(new RegExp(`${B}(?:يوم |ال)?(${alt(wdAll)})( الجاي| القادم| الجاية)?${E}`), (m) => {
      const wd = WEEKDAY_WORDS.find(([, ws]) => ws.includes(m[1]))?.[0];
      if (wd == null) return false;
      let d = nextWeekday(today, wd);
      if (m[2] && d === today) d = addDays(d, 7);
      setDate(d);
    });
  }

  // الوقت
  const Q = '(الصبح|صباحا|صباحاً|الصباح|ص|الضهر|الظهر|ظهرا|ظهراً|العصر|المغرب|المسا|مساء|مساءً|بالليل|الليل|م|عشية|بعد الظهر)';
  const F = '(و\\s?نص|ونص|و\\s?ربع|وربع|الا ربع|إلا ربع|الا\\s?ربع|و\\s?عشرة|الا عشرة|إلا عشرة|و\\s?تلت|وثلث)';
  const applyTime = (hRaw, mRaw, frac, qual) => {
    let hh = Number(hRaw) || WORD_NUM[hRaw];
    let mm = Number(mRaw) || 0;
    if (!(hh >= 0 && hh <= 24) || mm > 59) return false;
    if (frac) {
      if (/نص/.test(frac)) mm = 30;
      else if (/الا\s?ربع|إلا ربع/.test(frac)) { mm = 45; hh -= 1; }
      else if (/ربع/.test(frac)) mm = 15;
      else if (/الا عشرة|إلا عشرة/.test(frac)) { mm = 50; hh -= 1; }
      else if (/عشرة/.test(frac)) mm = 10;
      else if (/تلت|ثلث/.test(frac)) mm = 20;
    }
    if (qual) {
      if (/صبح|صباح|^ص$/.test(qual)) { if (hh === 12) hh = 0; }
      else if (/ضهر|ظهر/.test(qual)) { if (hh < 6) hh += 12; }
      else if (/ليل/.test(qual)) { if (hh >= 6 && hh < 12) hh += 12; else if (hh === 12) hh = 0; }
      else if (hh < 12) hh += 12;
    } else if (hh >= 1 && hh <= 6) hh += 12;
    if (hh === 24) hh = 0;
    out.time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    return true;
  };
  const timeDone = take(new RegExp(`${B}(?:الساعة|ع الساعة|عالساعة|بالساعة|الساعه) ?(\\d{1,2}|${alt(Object.keys(WORD_NUM))})(?:[:.](\\d{2}))?(?: ?${F})?(?: ?${Q})?${E}`), (m) => applyTime(m[1], m[2], m[3], m[4]))
    || take(new RegExp(`${B}(\\d{1,2})[:.](\\d{2})(?: ?${Q})?${E}`), (m) => applyTime(m[1], m[2], null, m[3]))
    || take(new RegExp(`${B}(\\d{1,2})(?: ?${F})? ?${Q}${E}`), (m) => applyTime(m[1], null, m[2], m[3]));
  if (timeDone) out.hints.push(time12(out.time));

  // الفترة (بعد الفجر، الصبح، بعد العصر...)
  if (!out.time) {
    for (const [key, words] of PERIOD_WORDS) {
      if (take(new RegExp(`${B}(${alt(words)})${E}`), (m) => { if (/صلاة/.test(text.slice(Math.max(0, m.index - 6), m.index))) return false; out.period = key; return true; })) {
        out.hints.push(PERIOD_NAMES[key]);
        break;
      }
    }
  }

  // التصنيف من الكلمات (من غير ما نشيلها من العنوان)
  const plain = ` ${norm(input)} `;
  for (const [tag, words] of TAG_WORDS) {
    if (new RegExp(`${B}(?:و)?(?:بال|لل|ال|ب|ل)?(${alt(words)})${E}`).test(plain)) { out.tag = tag; break; }
  }

  // تنظيف العنوان
  let title = text.replace(/\s+/g, ' ').trim();
  title = title.replace(new RegExp(`^(?:و|لازم|بدي|بدّي|ضروري|مطلوب|عندي|في عندي|منشان|مشان)\\s+`), '');
  title = title.replace(new RegExp(`^(?:و|لازم|بدي|بدّي|عندي|إني|اني|أن|ان)\\s+`), '');
  title = title.replace(/(^|\s)(?:يوم|على|عالساعة|الساعة|ب|في|و|،|,)$/g, '').replace(/^(?:يوم|على|في|،|,|-)\s+/, '').trim();
  title = title.replace(/\s+[،,.-]+$/, '').replace(/^[،,.-]+\s*/, '').trim();
  out.title = title;
  return out;
}

// وصف مختصر لما فهمناه (يطلع تحت خانة الكتابة)
export function describeParse(p, today) {
  const bits = [];
  if (p.date) bits.push({ ic: 'calendar', t: dayLabel(p.date, today) });
  if (p.due) bits.push({ ic: 'flag', t: `قبل ${shortDate(p.due)}` });
  if (p.time) bits.push({ ic: 'clock', t: time12(p.time) });
  else if (p.period) bits.push({ ic: 'sun', t: PERIOD_NAMES[p.period] });
  if (p.recur) bits.push({ ic: 'repeat', t: recurShort(p.recur) });
  if (p.priority) bits.push({ ic: 'star', t: 'مهمة' });
  if (p.remind !== null) bits.push({ ic: 'bell', t: 'تذكير' });
  return bits;
}
function recurShort(r) {
  const D = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  switch (r.type) {
    case 'daily': return 'كل يوم';
    case 'weekly': return r.days?.length ? `كل ${r.days.map((d) => D[d]).join(' و')}` : 'كل أسبوع';
    case 'monthly': return `كل شهر يوم ${r.day}`;
    case 'every': return `كل ${r.n} أيام`;
    case 'yearly': return 'كل سنة';
    case 'shift': return r.when === 'lastHome' ? 'قبل كل نوبة شغل' : 'مع النوبات';
    default: return 'متكرّرة';
  }
}
export { MONTHS };
