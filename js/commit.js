// التعهّد: فترة تركيز (60 يوم مثلاً) بشروط يومية وحصص أسبوعية.
// كل شرط إله درجة 0..1، والأساسي لازم يتحقق، والثانوي بيرفع نسبة اليوم.
// اليوم بيكمل إذا تحققت الأساسيات ووصلت نسبته لحدّ النجاح. الأيام المكسورة بتزيد على المدة.
import { store, uid } from './store.js';
import { addDays, daysBetween, weekStartOf } from './dates.js';
import { prayersDone } from './worship.js';
import { adhkarDone, adhkarSettings, pagesReadOn, allAdhkarLists, wirdToday } from './worship.js';
import { activeHabits, habitScore, habitOk, passThreshold } from './habits.js';
import { award, revoke, POINTS } from './rewards.js';
import { logicalToday } from './prayer.js';

export const QUOTA_POLICIES = {
  carry: { label: 'النقص بيترحّل للأسبوع الجاي', hint: 'ما بينكسر يوم؛ اللي نقص بينضاف لحصة الأسبوع الجاي.' },
  breakOne: { label: 'يوم زيادة عن الأسبوع الناقص', hint: 'أي نقص بالأسبوع بيزيد يوم واحد على مدّتك.' },
  breakPerUnit: { label: 'يوم زيادة عن كل وحدة ناقصة', hint: 'كل وحدة ما انعملت بتزيد يوم.' },
};
const WEIGHT = { essential: 2, secondary: 1 };
export const PRAYERS_REQ = '__prayers';

export const commitActive = () => Boolean(store.state.commitment?.active);
export const inCommitment = (d) => commitActive() && d >= store.state.commitment.startDate && d <= logicalToday();

function importanceOf(id) {
  const m = store.state.commitment?.reqImportance || {};
  if (m[id]) return m[id] === 'secondary' ? 'secondary' : 'essential';
  const h = store.state.habits.find((x) => x.id === id);
  if (h) return h.level === 'secondary' ? 'secondary' : 'essential';
  if (id.startsWith('adhkar:')) return adhkarSettings(id.slice(7)).level === 'secondary' ? 'secondary' : 'essential';
  return 'essential';
}
export function setImportance(id, level) {
  const h = store.state.habits.find((x) => x.id === id);
  store.update((s) => {
    if (h) { const x = s.habits.find((y) => y.id === id); x.level = level; return; }
    if (id.startsWith('adhkar:')) { const k = id.slice(7); s.adhkar.lists = s.adhkar.lists || {}; s.adhkar.lists[k] = { ...(s.adhkar.lists[k] || {}), level }; return; }
    if (s.commitment) { s.commitment.reqImportance = s.commitment.reqImportance || {}; s.commitment.reqImportance[id] = level; }
  });
}

// شروط اليوم الحالية: الصلوات، العادات الأساسية اليومية، الأذكار المعلّمة، ورد القرآن
export function dailyRequirements() {
  const out = [];
  const c = store.state.commitment;
  if (!c || c.includePrayers !== false) out.push({ id: PRAYERS_REQ, name: 'الصلوات الخمس', icon: 'mosque', kind: 'prayers' });
  for (const l of allAdhkarLists()) if (adhkarSettings(l.id).core) out.push({ id: `adhkar:${l.id}`, name: l.name, icon: l.icon || 'beads', kind: 'adhkar' });
  if (store.state.quran.core) out.push({ id: 'quran', name: store.state.quran.plan ? 'ورد الختمة' : `ورد القرآن (${store.state.settings.quranDaily || 10} صفحات)`, icon: 'quran', kind: 'quran' });
  for (const h of activeHabits()) if (h.core && (h.rhythm?.type || 'daily') === 'daily') out.push({ id: h.id, name: h.name, icon: h.icon || 'leaf', kind: 'habit' });
  return out.map((r) => ({ ...r, imp: importanceOf(r.id) }));
}

function explicit(day, id) {
  const e = store.state.commitLog?.[day];
  if (!e?.checks || !Object.prototype.hasOwnProperty.call(e.checks, id)) return undefined;
  return Boolean(e.checks[id]);
}
function scoreOf(req, day) {
  const sc = store.state.commitLog?.[day]?.scores?.[req.id];
  if (typeof sc === 'number') return sc;
  const ex = explicit(day, req.id);
  if (ex !== undefined) return ex ? 1 : 0;
  switch (req.kind) {
    case 'prayers': return prayersDone(day) / 5;
    case 'adhkar': return adhkarDone(day, req.id.slice(7)) ? 1 : 0;
    case 'quran': { const w = wirdToday(day); return Math.min(1, w.read / Math.max(1, w.target)); }
    case 'habit': return habitScore(day, req.id) ?? 0;
    default: return 0;
  }
}
function okOf(req, day, score) {
  const ex = explicit(day, req.id);
  if (ex !== undefined) return ex;
  if (req.kind === 'prayers') return prayersDone(day) >= 5;
  if (req.kind === 'habit') return habitOk(day, req.id);
  if (req.kind === 'quran') return score >= 1;
  return score >= 1;
}

export function liveVerdict(day) {
  let sw = 0, ss = 0;
  const items = dailyRequirements().map((r) => {
    const score = scoreOf(r, day);
    const ok = okOf(r, day, score);
    sw += WEIGHT[r.imp]; ss += WEIGHT[r.imp] * score;
    return { id: r.id, name: r.name, icon: r.icon, kind: r.kind, imp: r.imp, score, ok, detail: r.kind === 'prayers' ? `${prayersDone(day)} من 5` : null };
  });
  const pct = sw ? ss / sw : 1;
  const essentialOk = items.every((x) => x.imp !== 'essential' || x.ok);
  return { v: essentialOk && pct >= passThreshold() - 1e-9 ? 'done' : 'broken', items, pct };
}

function frozen(day) {
  const c = store.state.commitment;
  const e = store.state.commitLog?.[day];
  if (e?.verdict?.v && (!e.verdict.cid || e.verdict.cid === c.id)) return e.verdict;
  const lv = liveVerdict(day);
  const verdict = { v: lv.v, items: lv.items, pct: lv.pct, at: Date.now(), cid: c.id };
  store.update((s) => { s.commitLog[day] = s.commitLog[day] || { checks: {}, values: {}, scores: {} }; s.commitLog[day].verdict = verdict; }, { silent: true });
  return verdict;
}
// 'done' | 'broken' | 'pending' | 'future'
export function dayVerdict(day) {
  if (!inCommitment(day)) return 'future';
  if (day === logicalToday()) return liveVerdict(day).v === 'done' ? 'done' : 'pending';
  return frozen(day).v;
}
export function dayDetail(day) {
  if (!inCommitment(day)) return null;
  if (day === logicalToday()) { const lv = liveVerdict(day); return { ...lv, v: lv.v === 'done' ? 'done' : 'pending' }; }
  return frozen(day);
}
export function verdictPct(d) {
  if (!d) return null;
  if (typeof d.pct === 'number') return d.pct;
  const it = d.items || [];
  return it.length ? it.filter((x) => x.ok).length / it.length : 1;
}
// تصحيح يوم ماضٍ: نشيل حكمه المحفوظ فيتحسب من جديد
export function invalidateDay(day) {
  store.update((s) => {
    if (s.commitLog[day]?.verdict) delete s.commitLog[day].verdict;
    if (s.commitment?.weeks) for (const k of Object.keys(s.commitment.weeks)) if (s.commitment.weeks[k].end >= day) delete s.commitment.weeks[k];
  }, { silent: true });
}
export function setExplicit(day, id, ok) {
  store.update((s) => {
    s.commitLog[day] = s.commitLog[day] || { checks: {}, values: {}, scores: {} };
    s.commitLog[day].checks = s.commitLog[day].checks || {};
    if (ok === null) delete s.commitLog[day].checks[id]; else s.commitLog[day].checks[id] = ok;
    if (s.commitLog[day].scores) delete s.commitLog[day].scores[id];
  });
  if (day < logicalToday()) invalidateDay(day);
}

/* ---------- الحصص الأسبوعية ---------- */
// عناصر المكتبة الأساسية بحصة أسبوعية (محاضرات، حلقات، دروس) + العادات الأسبوعية
export function weeklyRequirements() {
  const s = store.state;
  const out = [];
  const lib = [['subject', s.subjects], ['book', s.books], ['series', s.series]];
  for (const [kind, list] of lib) for (const it of list || []) if (it.core && it.rhythm?.type === 'quota') out.push({ id: it.id, name: it.name, kind, perWeek: it.rhythm.perWeek || 3, imp: it.level === 'secondary' ? 'secondary' : 'essential' });
  for (const h of activeHabits()) if (h.core && h.rhythm?.type === 'weekly') out.push({ id: h.id, name: h.name, kind: 'habit', perWeek: h.rhythm.times || 3, imp: h.level === 'secondary' ? 'secondary' : 'essential' });
  return out;
}
function unitsBetween(itemId, from, to) {
  let n = 0;
  for (const e of store.state.unitLog || []) if (e.item === itemId && e.d >= from && e.d <= to) n += e.w ?? 1;
  return n;
}
function evaluateWeek(ws, carry, upTo) {
  const c = store.state.commitment;
  const we = addDays(ws, 6);
  const from = ws < c.startDate ? c.startDate : ws;
  const last = upTo < we ? upTo : we;
  const eff = daysBetween(from, we) + 1;
  const items = {};
  for (const r of weeklyRequirements()) {
    let got = 0;
    if (r.kind === 'habit') { for (let d = from; d <= last; d = addDays(d, 1)) if (habitOk(d, r.id)) got += 1; }
    else got = unitsBetween(r.id, from, last);
    const base = eff >= 7 ? r.perWeek : Math.ceil(r.perWeek * eff / 7);
    let required = base + (carry[r.id] || 0);
    if (r.kind === 'habit') required = Math.min(required, eff);
    items[r.id] = { name: r.name, kind: r.kind, required, got: Math.round(got * 10) / 10, carried: carry[r.id] || 0, imp: r.imp, short: Math.max(0, required - got) };
  }
  return { start: ws, end: we, items };
}
export function weekChain(today = logicalToday()) {
  const c = store.state.commitment;
  const out = { closed: [], current: null };
  if (!c?.active) return out;
  let ws = weekStartOf(c.startDate);
  let carry = {};
  let dirty = false;
  const store_ = c.weeks || {};
  for (let guard = 0; addDays(ws, 6) < today && guard < 200; guard++) {
    let rec = store_[ws];
    if (!rec) {
      const ev = evaluateWeek(ws, carry, addDays(ws, 6));
      const policy = c.quotaPolicy || 'carry';
      const short = Object.values(ev.items).reduce((a, x) => a + (x.imp === 'secondary' ? 0 : Math.ceil(x.short)), 0);
      rec = { ...ev, policy, penalty: policy === 'breakOne' ? (short > 0 ? 1 : 0) : policy === 'breakPerUnit' ? short : 0 };
      store_[ws] = rec; dirty = true;
    }
    out.closed.push(rec);
    carry = {};
    if (rec.policy === 'carry') for (const [id, x] of Object.entries(rec.items)) if (x.short > 0) carry[id] = Math.ceil(x.short);
    ws = addDays(ws, 7);
  }
  if (dirty) store.update((s) => { s.commitment.weeks = store_; }, { silent: true });
  const cur = evaluateWeek(ws, carry, today);
  out.current = { ...cur, daysLeft: daysBetween(today, cur.end) + 1 };
  return out;
}

/* ---------- الأرقام ---------- */
export function commitStats(today = logicalToday()) {
  const c = store.state.commitment;
  if (!c?.active) return null;
  const start = c.startDate;
  const elapsed = Math.max(0, daysBetween(start, today));
  let done = 0, broken = 0, best = 0, run = 0;
  for (let i = 0; i < elapsed; i++) {
    const v = dayVerdict(addDays(start, i));
    if (v === 'done') { done += 1; run += 1; best = Math.max(best, run); } else { broken += 1; run = 0; }
  }
  const todayDone = dayVerdict(today) === 'done';
  const current = run + (todayDone ? 1 : 0);
  const chain = weekChain(today);
  const weekPenalty = chain.closed.reduce((a, w) => a + (w.penalty || 0), 0);
  const adjust = (c.adjustments || []).reduce((a, x) => a + (Number(x.days) || 0), 0);
  const goodNeeded = Math.max(1, (Number(c.durationDays) || 60) + weekPenalty + adjust);
  const doneWithToday = done + (todayDone ? 1 : 0);
  const remaining = Math.max(0, goodNeeded - doneWithToday);
  return {
    start, elapsed, done, broken, weekPenalty, adjust, goodNeeded, remaining, todayDone,
    dayNumber: elapsed + 1, totalDays: Math.max(elapsed + 1, goodNeeded + broken),
    pct: Math.min(1, doneWithToday / goodNeeded), completed: doneWithToday >= goodNeeded,
    endIso: addDays(today, Math.max(0, remaining - (todayDone ? 0 : 1))), best: Math.max(best, current), streak: current, chain,
  };
}

export function startCommitment({ reward, days, includePrayers = true }) {
  store.update((s) => {
    const prev = s.commitment;
    const archive = prev?.archive ? [...prev.archive] : [];
    if (prev?.active) archive.push({ reward: prev.reward, startDate: prev.startDate, endedAt: logicalToday(), durationDays: prev.durationDays });
    s.commitment = {
      id: uid('c'), active: true, reward, durationDays: days, startDate: logicalToday(), includePrayers,
      quotaPolicy: prev?.quotaPolicy || 'carry', passThreshold: prev?.passThreshold || 0.6, reqImportance: prev?.reqImportance || {},
      adjustments: [], weeks: {}, archive, closed: {},
    };
  });
}

// إغلاق الأيام الماضية: حكمها، ونقاط اليوم الكامل، وعقوبة اليوم المكسور
export function closeDays(today = logicalToday()) {
  const c = store.state.commitment;
  if (!c?.active) return;
  const floor = addDays(today, -40);
  // النقاط والعقوبات من يوم ما بلّشت تستعمل هالنسخة بس — مش بأثر رجعي
  const since = store.state.settings.appStartDay || today;
  let d = c.startDate < floor ? floor : c.startDate;
  for (; d < today; d = addDays(d, 1)) {
    const v = frozen(d);
    if (c.closed?.[d]) continue;
    if (d < since) { store.update((s) => { s.commitment.closed = s.commitment.closed || {}; s.commitment.closed[d] = v.v; }, { silent: true }); continue; }
    if (v.v === 'done') award(`fullday:${d}`, POINTS.fullDay, 'يوم تعهّد كامل', d);
    else {
      award(`penalty:${d}`, -15, 'يوم تعهّد ناقص', d);
      const pens = store.state.rewards.penalties || [];
      if (pens.length) {
        const pick = pens[(Object.keys(c.closed || {}).length) % pens.length];
        store.update((s) => { s.tasks.push({ id: uid('t'), title: `عقوبة: ${pick.title}`, notes: `لأنّ يوم ${d} ما كمل`, date: today, time: null, period: null, due: null, recur: null, recurEnd: null, done: false, doneAt: null, log: {}, skip: {}, checklist: [], remind: null, priority: 1, tag: 'general', link: { kind: 'penalty', day: d }, estimate: 0, spent: 0, goalId: null, createdAt: Date.now() }); }, { silent: true });
      }
    }
    store.update((s) => { s.commitment.closed = s.commitment.closed || {}; s.commitment.closed[d] = v.v; }, { silent: true });
  }
}
export { revoke };
