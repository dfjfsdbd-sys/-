// المكتبة المشتركة: تقدّم الوحدات (محاضرة، درس، حلقة) وتسجيله بتاريخه
import { store, uid } from './store.js';
import { award, POINTS } from './rewards.js';

// الإتقان بالمراحل: أول دراسة 50%، مراجعة 75%، تثبيت 100%
export const MASTERY_STEPS = [
  { v: 0, label: 'ما بلّشت' },
  { v: 50, label: 'درستها مرة' },
  { v: 75, label: 'راجعتها' },
  { v: 100, label: 'ثابتة' },
];
export const masteryLabel = (m) => (m >= 100 ? 'ثابتة' : m >= 75 ? 'مراجَعة' : m >= 50 ? 'مدروسة مرة' : m > 0 ? `${m}%` : 'جديدة');
export const nextMastery = (m) => (m < 50 ? 50 : m < 75 ? 75 : 100);

export function unitsProgress(units) {
  const u = units || [];
  return u.length ? u.reduce((a, x) => a + Math.min(100, x.mastery || 0), 0) / u.length / 100 : 0;
}

function listFor(s, kind) { return kind === 'subject' ? s.subjects : kind === 'book' ? s.books : s.series; }
function unitsOf(item, kind) { return kind === 'subject' ? item.lectures : kind === 'book' ? item.units : item.episodes; }

// تسجيل جلسة على وحدة: يرفع الإتقان (أو يحدّده)، ويضيف الوقت، ويكتب بسجلّ الوحدات
export function studyUnit(kind, itemId, unitId, { mastery = null, seconds = 0, day }) {
  let gain = 0, title = '';
  store.update((s) => {
    const item = listFor(s, kind).find((x) => x.id === itemId);
    const u = item && unitsOf(item, kind)?.find((x) => x.id === unitId);
    if (!u) return;
    const before = u.mastery || 0;
    const after = mastery == null ? nextMastery(before) : mastery;
    u.mastery = after;
    u.done = after >= 100;
    if (kind === 'series') { u.progress = Math.max(u.progress || 0, after / 100); }
    u.times = (u.times || 0) + (after > before || seconds ? 1 : 0);
    u.spent = (u.spent || 0) + (seconds || 0);
    u.last = day;
    gain = after - before;
    title = u.title;
    s.unitLog.push({ d: day, item: itemId, unit: unitId, kind, w: 1, m: after });
  });
  if (gain > 0) award(`unit:${unitId}:${mastery ?? 'n'}:${day}`, gain >= 50 ? POINTS.unit : POINTS.unitHalf, title, day);
  return gain;
}

export function addUnits(kind, itemId, count, prefix, startAt = null) {
  store.update((s) => {
    const item = listFor(s, kind).find((x) => x.id === itemId);
    if (!item) return;
    const arr = unitsOf(item, kind);
    const base = startAt || arr.length + 1;
    for (let i = 0; i < count; i++) arr.push({ id: uid('u'), title: `${prefix} ${base + i}`, image: null, mastery: 0, times: 0, spent: 0, estimate: 0, done: false });
  });
}
