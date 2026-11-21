// النوبات: أيام بالبيت وأيام بالشغل بالتناوب (مثلاً 7 و7)، تبدأ من تاريخ معروف
import { store } from './store.js';
import { daysBetween, addDays } from './dates.js';

export const SHIFT_NAMES = { home: 'بالبيت', work: 'بالشغل' };
export const SHIFT_ICON = { home: 'house', work: 'briefcase' };

export function shiftOn(dayIso) {
  const sh = store.state.settings.shift;
  if (!sh?.enabled || !sh.start || !Array.isArray(sh.pattern) || !sh.pattern.length) return null;
  const cycle = sh.pattern.reduce((a, p) => a + (Number(p.days) || 0), 0);
  if (!cycle) return null;
  let n = daysBetween(sh.start, dayIso) % cycle;
  if (n < 0) n += cycle;
  let acc = 0;
  for (let i = 0; i < sh.pattern.length; i++) {
    const p = sh.pattern[i];
    if (n < acc + p.days) return { kind: p.kind, index: n - acc, length: p.days, dayNo: n - acc + 1, first: n === acc, last: n === acc + p.days - 1 };
    acc += p.days;
  }
  return null;
}

// المرحلة التالية من نوع معيّن (أول يوم بالشغل الجاي مثلاً)
export function nextShiftStart(fromIso, kind, maxDays = 60) {
  for (let i = 0; i <= maxDays; i++) {
    const d = addDays(fromIso, i);
    const s = shiftOn(d);
    if (s && s.kind === kind && s.first) return d;
  }
  return null;
}

// «بقي 3 أيام وتروح عالشغل»
export function shiftSummary(todayIso) {
  const s = shiftOn(todayIso);
  if (!s) return null;
  const other = s.kind === 'home' ? 'work' : 'home';
  const next = nextShiftStart(addDays(todayIso, 1), other);
  return { ...s, nextKind: other, nextDate: next, daysLeft: next ? daysBetween(todayIso, next) : null };
}

// هل اليوم يطابق موعد نوبة لمهمة متكرّرة بالنوبات؟
export function matchesShiftRule(dayIso, when) {
  const s = shiftOn(dayIso);
  if (!s) return false;
  switch (when) {
    case 'lastHome': return s.kind === 'home' && s.last;
    case 'firstWork': return s.kind === 'work' && s.first;
    case 'lastWork': return s.kind === 'work' && s.last;
    case 'firstHome': return s.kind === 'home' && s.first;
    case 'homeDays': return s.kind === 'home';
    case 'workDays': return s.kind === 'work';
    default: return false;
  }
}
export const SHIFT_RULES = {
  lastHome: 'آخر يوم بالبيت (قبل الشغل)',
  firstWork: 'أول يوم بالشغل',
  lastWork: 'آخر يوم بالشغل',
  firstHome: 'أول يوم بالبيت',
  homeDays: 'كل أيام البيت',
  workDays: 'كل أيام الشغل',
};
