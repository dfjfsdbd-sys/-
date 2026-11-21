// الرياضة والصحة: الوزن، السعرات والوجبات، الماء، التمارين والبرامج
import { store, uid } from './store.js';
import { award, revoke, POINTS } from './rewards.js';
import { addDays, weekday } from './dates.js';

export const ACTIVITY = { 1.2: 'قليل الحركة', 1.375: 'حركة خفيفة (1-3 تمارين/أسبوع)', 1.55: 'حركة متوسطة (3-5)', 1.725: 'نشيط جداً (6-7)' };
export const GOALS = { lose: 'خسارة وزن', keep: 'تثبيت', gain: 'زيادة وزن وعضل' };
export const MEALS = { breakfast: 'فطور', lunch: 'غدا', dinner: 'عشا', snack: 'سناك' };
export const WORKOUT_TYPES = {
  gym: { name: 'جيم / أوزان', met: 5, icon: 'dumbbell' },
  home: { name: 'تمارين بالبيت', met: 4, icon: 'house' },
  walk: { name: 'مشي', met: 3.5, icon: 'run' },
  run: { name: 'ركض', met: 9, icon: 'run' },
  swim: { name: 'سباحة', met: 7, icon: 'droplet' },
  football: { name: 'كرة قدم', met: 7, icon: 'run' },
  bike: { name: 'دراجة', met: 6, icon: 'run' },
  stretch: { name: 'إطالة / يوغا', met: 2.5, icon: 'leaf' },
};

const sp = () => store.state.sport;

export function latestWeight(upTo = '9999') {
  const w = [...(sp().weights || [])].filter((x) => x.d <= upTo).sort((a, b) => a.d.localeCompare(b.d));
  return w.length ? w[w.length - 1].kg : (sp().profile.weight || sp().profile.startWeight || null);
}
export function addWeight(day, kg) {
  store.update((s) => {
    s.sport.weights = (s.sport.weights || []).filter((x) => x.d !== day);
    s.sport.weights.push({ d: day, kg });
    s.sport.weights.sort((a, b) => a.d.localeCompare(b.d));
    if (!s.sport.profile.startWeight) s.sport.profile.startWeight = kg;
  });
  award(`weight:${day}`, POINTS.weight, 'وزن', day);
}

export function bmr(p, kg) {
  if (!p.height || !p.age || !kg) return null;
  return 10 * kg + 6.25 * p.height - 5 * p.age + (p.sex === 'female' ? -161 : 5);
}
export function calorieTarget(day) {
  const p = sp().profile || {};
  if (p.kcalTarget && !p.autoTarget) return Math.round(p.kcalTarget);
  const b = bmr(p, latestWeight(day));
  if (!b) return p.kcalTarget || null;
  const tdee = b * (Number(p.activity) || 1.375);
  const adj = p.goal === 'lose' ? -500 : p.goal === 'gain' ? 350 : 0;
  return Math.round(tdee + adj);
}
export function proteinTarget(day) {
  const kg = latestWeight(day);
  const p = sp().profile || {};
  return kg ? Math.round(kg * (p.goal === 'gain' ? 1.8 : p.goal === 'lose' ? 1.6 : 1.3)) : null;
}

export function foodsOn(day) { return sp().foodLog?.[day] || []; }
export function dayTotals(day) {
  return foodsOn(day).reduce((a, x) => ({ kcal: a.kcal + (x.kcal || 0), p: a.p + (x.p || 0), c: a.c + (x.c || 0), f: a.f + (x.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
}
export function addFood(day, entry) {
  store.update((s) => { s.sport.foodLog[day] = s.sport.foodLog[day] || []; s.sport.foodLog[day].push({ id: uid('fd'), ...entry }); });
  award(`food:${day}`, POINTS.food, 'تسجيل الأكل', day);
}
export function removeFood(day, id) {
  store.update((s) => { s.sport.foodLog[day] = (s.sport.foodLog[day] || []).filter((x) => x.id !== id); });
}
export function portion(food, grams) {
  const k = grams / 100;
  return { name: food.name, grams, kcal: Math.round(food.kcal * k), p: +(food.p * k).toFixed(1), c: +(food.c * k).toFixed(1), f: +(food.f * k).toFixed(1) };
}
// الأكلات اللي بتكررها (للإضافة بلمسة)
export function frequentFoods(n = 8) {
  const count = new Map();
  for (const list of Object.values(sp().foodLog || {})) for (const x of list) { const k = `${x.name}|${x.grams}`; count.set(k, { ...(count.get(k) || x), n: ((count.get(k)?.n) || 0) + 1 }); }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, n);
}

export const waterOn = (day) => sp().water?.[day] || 0;
export function addWater(day, n = 1) { store.update((s) => { s.sport.water = s.sport.water || {}; s.sport.water[day] = Math.max(0, (s.sport.water[day] || 0) + n); }); }

export function workoutsOn(day) { return (sp().workouts || []).filter((w) => w.d === day); }
export function addWorkout(day, w) {
  const kg = latestWeight(day) || 70;
  const met = WORKOUT_TYPES[w.type]?.met || 4;
  const kcal = Math.round(met * kg * (w.minutes / 60));
  const id = uid('wo');
  store.update((s) => { s.sport.workouts.push({ id, d: day, kcal, ...w }); });
  award(`workout:${id}`, POINTS.workout, WORKOUT_TYPES[w.type]?.name || 'تمرين', day);
  return kcal;
}
export function removeWorkout(id) { store.update((s) => { s.sport.workouts = s.sport.workouts.filter((x) => x.id !== id); }); revoke(`workout:${id}`); }
export function workoutStreakWeeks(today) {
  let n = 0;
  for (let w = 0; w < 52; w++) {
    const from = addDays(today, -7 * (w + 1) + 1), to = addDays(today, -7 * w);
    if ((sp().workouts || []).some((x) => x.d >= from && x.d <= to)) n += 1; else break;
  }
  return n;
}
// تمرين اليوم من البرنامج (إن وجد)
export function plannedWorkout(day) {
  const prog = (sp().programs || []).find((p) => p.active);
  if (!prog) return null;
  const dayId = prog.schedule?.[weekday(day)];
  const pd = prog.days.find((x) => x.id === dayId);
  return pd ? { program: prog, day: pd } : null;
}

export function sportToday(day) {
  return { weight: latestWeight(day), kcal: Math.round(dayTotals(day).kcal), target: calorieTarget(day), water: waterOn(day), workouts: workoutsOn(day).length };
}

// بحث بأكلات معلّبة من قاعدة Open Food Facts (يحتاج نت)
export async function searchOFF(q) {
  // الموقع بيحدّ عدد البحثات بالدقيقة، وساعتها بيفشل الطلب: منعيد المحاولة ومنجرّب النسخة الاحتياطية
  const path = `/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,product_name_ar,brands,nutriments,serving_quantity`;
  const hosts = ['https://world.openfoodfacts.org', 'https://world.openfoodfacts.org', 'https://world.openfoodfacts.net'];
  let j = null;
  for (let i = 0; i < hosts.length && !j; i++) {
    if (i) await new Promise((res) => setTimeout(res, 900 * i));
    try { const r = await fetch(hosts[i] + path); if (r.ok) j = await r.json(); } catch { /* منجرّب اللي بعده */ }
  }
  if (!j) throw new Error('net');
  return (j.products || []).map((p) => {
    const n = p.nutriments || {};
    const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
    if (kcal == null) return null;
    return { id: `off-${Math.random().toString(36).slice(2, 8)}`, name: [p.product_name_ar || p.product_name, p.brands].filter(Boolean).join(' — ').slice(0, 80), kcal: Math.round(kcal), p: +(n.proteins_100g || 0).toFixed(1), c: +(n.carbohydrates_100g || 0).toFixed(1), f: +(n.fat_100g || 0).toFixed(1), unit: 'حصة', grams: Number(p.serving_quantity) || 100, cat: 'منتج' };
  }).filter(Boolean);
}
