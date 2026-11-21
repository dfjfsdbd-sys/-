// النقاط والمستويات والمكافآت: كل إنجاز إله نقاط، والنقاط بتشتري مكافآت إنت بتحددها
import { store, uid } from './store.js';

export const POINTS = {
  task: 5, taskImportant: 8, habit: 10, prayer: 2, prayerJamaah: 4, adhkar: 4,
  quranPage: 1, unit: 10, unitHalf: 5, workout: 8, focus: 3, fullDay: 20, food: 2, weight: 2,
};

const LEVEL_TITLES = ['بداية الطريق', 'مثابر', 'منتظم', 'منضبط', 'صاحب همّة', 'مجتهد', 'متقن', 'ثابت', 'قدوة', 'ربّاني'];

// يُمنح مرة واحدة لكل مفتاح (لا يتكرّر لو ضغطت مرتين)، ويُسحب لو تراجعت
export function award(key, pts, reason, date) {
  if (!pts) return 0;
  let added = 0;
  store.update((s) => {
    if (s.rewards.ledger.some((e) => e.k === key)) return;
    s.rewards.ledger.push({ k: key, p: pts, r: reason, d: date, at: Date.now() });
    added = pts;
  }, { silent: true });
  return added;
}
export function revoke(key) {
  let removed = 0;
  store.update((s) => {
    const before = s.rewards.ledger.length;
    s.rewards.ledger = s.rewards.ledger.filter((e) => { if (e.k === key) { removed += e.p; return false; } return true; });
    return before;
  }, { silent: true });
  return removed;
}
export function hasAward(key) { return store.state.rewards.ledger.some((e) => e.k === key); }

export function totalPoints() {
  return store.state.rewards.ledger.reduce((a, e) => a + e.p, 0);
}
export function spentPoints() {
  return (store.state.rewards.redeemed || []).reduce((a, r) => a + (r.cost || 0), 0);
}
export function balance() { return totalPoints() - spentPoints(); }
export function pointsOn(date) {
  return store.state.rewards.ledger.reduce((a, e) => (e.d === date ? a + e.p : a), 0);
}
export function pointsBetween(from, to) {
  return store.state.rewards.ledger.reduce((a, e) => (e.d >= from && e.d <= to ? a + e.p : a), 0);
}

// المستوى: كل مستوى بيحتاج 150 نقطة أكتر من اللي قبله
export function levelOf(total = totalPoints()) {
  let lvl = 1, need = 150, base = 0;
  while (total >= base + need) { base += need; lvl += 1; need += 150; }
  const into = total - base;
  return { level: lvl, into, need, pct: into / need, title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((lvl - 1) / 2))] };
}

export function addReward(title, cost) {
  store.update((s) => { s.rewards.items.push({ id: uid('rw'), title, cost: Math.max(1, Math.round(cost)) }); });
}
export function redeem(id) {
  const it = store.state.rewards.items.find((x) => x.id === id);
  if (!it || balance() < it.cost) return false;
  store.update((s) => { s.rewards.redeemed.push({ id: uid('rd'), rewardId: id, title: it.title, cost: it.cost, at: Date.now() }); });
  return true;
}
