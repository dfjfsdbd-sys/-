// الأحداث: شي بيصير بيوم (موعد، مناسبة، سفر…) — مش مهمة بتنعمل. بتبين بالشهر والسنة وبالمهام.
// الامتحانات (من الدراسة) بتنضم كأحداث كمان.
import { store, uid } from './store.js';
import { addDays, daysBetween } from './dates.js';
import { commitActive, commitStats } from './commit.js';

export const EVENT_KINDS = {
  exam: { name: 'امتحان', icon: 'grad', color: '#4a9ee0' },
  appt: { name: 'موعد', icon: 'stethoscope', color: '#e06a9e' },
  occasion: { name: 'مناسبة', icon: 'gift', color: '#e8c46a' },
  trip: { name: 'سفر', icon: 'plane', color: '#35b791' },
  other: { name: 'تاني', icon: 'calendar', color: '#8a8a99' },
};

export function addEvent(fields) {
  const e = { id: uid('ev'), title: '', kind: 'appt', date: null, endDate: null, time: null, remind: null, notes: '', createdAt: Date.now(), ...fields };
  store.update((s) => { s.events = s.events || []; s.events.push(e); });
  return e;
}
export function updateEvent(id, patch) { store.update((s) => { const e = (s.events || []).find((x) => x.id === id); if (e) Object.assign(e, patch); }); }
export function deleteEvent(id) {
  const e = (store.state.events || []).find((x) => x.id === id);
  store.update((s) => { s.events = (s.events || []).filter((x) => x.id !== id); });
  return e ? { ...e } : null;
}
export function restoreEvent(e) { store.update((s) => { s.events.push(e); }); }
export const eventById = (id) => (store.state.events || []).find((x) => x.id === id);

const EXAM_LABEL = { quiz: 'مذاكرة', final: 'امتحان نهائي', practical: 'عملي', oral: 'شفهي', other: 'امتحان' };
// كل أحداث يوم: الأحداث المضافة (والسفر الممتد) + الامتحانات
export function eventsOn(day) {
  const out = [];
  for (const e of store.state.events || []) {
    const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
    if (e.date && day >= e.date && day <= end) out.push({ ...e, span: end !== e.date, first: day === e.date, last: day === end, source: 'event' });
  }
  for (const x of store.state.exams || []) {
    if (x.date !== day) continue;
    const sub = store.state.subjects.find((s) => s.id === x.subjectId);
    out.push({ id: x.id, kind: 'exam', title: `${EXAM_LABEL[x.kind] || 'امتحان'}: ${sub?.name || ''}`.trim(), date: x.date, time: x.time || null, source: 'exam', final: x.kind === 'final' });
  }
  return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}
export function eventsBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) for (const e of eventsOn(d)) if (e.source === 'exam' || e.first || !e.span) out.push(e);
  return out;
}

// بداية رمضان الجاي (تقريبي من التقويم الهجري أم القرى)
let ramadanCache = null;
export function nextRamadan(today) {
  if (ramadanCache && ramadanCache.from === today) return ramadanCache.v;
  let v = null;
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { month: 'numeric', day: 'numeric' });
    for (let i = 0; i < 400; i++) {
      const d = addDays(today, i);
      const [y, m, dd] = d.split('-').map(Number);
      const parts = fmt.formatToParts(new Date(y, m - 1, dd, 12));
      const mo = Number(parts.find((p) => p.type === 'month')?.value);
      const da = Number(parts.find((p) => p.type === 'day')?.value);
      if (mo === 9 && da === 1) { v = d; break; }
    }
  } catch { /* */ }
  ramadanCache = { from: today, v };
  return v;
}

// الأحداث الكبيرة الجاية: الامتحانات النهائية، نهاية التعهّد، المناسبات والسفر، ورمضان
export function bigEvents(today, horizonDays = 365) {
  const until = addDays(today, horizonDays);
  const out = [];
  for (const e of store.state.events || []) if (e.date >= today && e.date <= until && ['occasion', 'trip', 'appt', 'other', 'exam'].includes(e.kind)) out.push({ ...e, source: 'event' });
  for (const x of store.state.exams || []) {
    if (x.date < today || x.date > until) continue;
    const sub = store.state.subjects.find((s) => s.id === x.subjectId);
    out.push({ id: x.id, kind: 'exam', title: `${EXAM_LABEL[x.kind] || 'امتحان'} ${sub?.name || ''}`.trim(), date: x.date, source: 'exam', lectures: (x.lectures || []).length });
  }
  if (commitActive()) {
    const end = commitStats(today).endIso;
    if (end && end >= today && end <= until) out.push({ id: 'commit-end', kind: 'commit', title: `نهاية التعهّد — ${store.state.commitment.reward || 'التعهّد'}`, date: end, source: 'commit' });
  }
  const r = nextRamadan(today);
  if (r && r <= until) out.push({ id: 'ramadan', kind: 'ramadan', title: 'بداية رمضان (تقريباً)', date: r, source: 'hijri' });
  return out.sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ ...e, inDays: daysBetween(today, e.date) }));
}
