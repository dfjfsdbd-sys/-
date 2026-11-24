// الرياضة والصحة: الوزن، السعرات والوجبات، الماء، التمارين والبرامج
import { store, uid } from './store.js';
import { award, revoke, POINTS } from './rewards.js';
import { addDays, weekday } from './dates.js';
import { shiftOn } from './shifts.js';

export const ACTIVITY = { 1.2: 'قليل الحركة', 1.375: 'حركة خفيفة (1-3 تمارين/أسبوع)', 1.55: 'حركة متوسطة (3-5)', 1.725: 'نشيط جداً (6-7)' };
export const GOALS = { lose: 'تنزيل وزن', gain: 'زيادة عضل', keep: 'لياقة وصحة' };
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
// تمرين اليوم من البرنامج (إن وجد). بأيام الشغل: تمرين خفيف 20 دقيقة بداله (إذا مفعّل)
export function plannedWorkout(day) {
  const prog = (sp().programs || []).find((p) => p.active);
  const work = Boolean(store.state.settings.shift?.enabled) && shiftOn(day)?.kind === 'work';
  if (work && sp().profile?.workLight !== false && prog) {
    const t = PROGRAM_TEMPLATES.light20;
    return { program: { ...prog, name: t.name }, day: t.days[0], light: true };
  }
  if (!prog) return null;
  const dayId = prog.schedule?.[weekday(day)];
  const pd = prog.days.find((x) => x.id === dayId);
  return pd ? { program: prog, day: pd } : null;
}
// الجاي من البرنامج (لبطاقة الأسبوع)
export function nextPlanned(today) {
  for (let i = 1; i <= 7; i++) { const d = addDays(today, i); const p = plannedWorkout(d); if (p) return { d, ...p }; }
  return null;
}

/* ---------- البرامج الجاهزة ---------- */
// تمرين: { name, sets, reps, unit: 'reps' | 'sec' | 'min', rest (ثواني) }
const X = (name, sets, reps, unit = 'reps', rest = 60) => ({ name, sets, reps, unit, rest });
export const PROGRAM_TEMPLATES = {
  home3: {
    name: 'جسم كامل 3 أيام — بالبيت', sub: 'بدون أدوات · مبتدئ · 35 د', place: 'home', icon: 'house', tint: '#a682e8', week: [6, 1, 3],
    days: [
      { id: 'A', name: 'يوم A', exercises: [X('إحماء', 1, 5, 'min', 0), X('ضغط', 3, 12), X('سكوات', 3, 15), X('بلانك', 3, 40, 'sec', 45), X('عقلة أسترالية (طاولة)', 3, 8)] },
      { id: 'B', name: 'يوم B', exercises: [X('إحماء', 1, 5, 'min', 0), X('ضغط ضيق', 3, 10), X('لانجز (لكل رجل)', 3, 10), X('جسر الحوض', 3, 15), X('سوبرمان', 3, 12), X('بلانك جانبي', 3, 30, 'sec', 45)] },
      { id: 'C', name: 'يوم C', exercises: [X('إحماء', 1, 5, 'min', 0), X('ضغط مائل', 3, 12), X('سكوات قفز', 3, 10), X('ديبس (كرسي)', 3, 10), X('متسلّق الجبل', 3, 30, 'sec', 45), X('إطالة', 1, 5, 'min', 0)] },
    ],
  },
  gym3: {
    name: 'جسم كامل 3 أيام — نادي', sub: 'أوزان · مبتدئ · 50 د', place: 'gym', icon: 'dumbbell', tint: '#e0705f', week: [6, 1, 3],
    days: [
      { id: 'A', name: 'يوم A', exercises: [X('سكوات', 3, 10, 'reps', 90), X('بنش برس', 3, 10, 'reps', 90), X('تجديف بار', 3, 10, 'reps', 90), X('ضغط كتف', 3, 12), X('بلانك', 3, 40, 'sec', 45)] },
      { id: 'B', name: 'يوم B', exercises: [X('رفعة رومانية', 3, 10, 'reps', 90), X('سحب أمامي', 3, 12), X('ضغط دمبل مائل', 3, 10), X('لانجز دمبل', 3, 10), X('كرنش', 3, 15)] },
      { id: 'C', name: 'يوم C', exercises: [X('ليغ بريس', 3, 12), X('عقلة بمساعدة', 3, 8, 'reps', 90), X('تفتيح صدر', 3, 12), X('باي سبس', 3, 12), X('ترايسبس', 3, 12)] },
    ],
  },
  ppl: {
    name: 'دفع، سحب، رجلين', sub: 'نادي · 6 أيام · متوسط', place: 'gym', icon: 'dumbbell', tint: '#e0a04a', week: [6, 0, 1, 2, 3, 4],
    days: [
      { id: 'P', name: 'دفع (صدر، كتف، ترايسبس)', exercises: [X('بنش برس', 4, 8, 'reps', 120), X('ضغط كتف', 3, 10, 'reps', 90), X('تفتيح صدر', 3, 12), X('رفرفة جانبي', 3, 15), X('ترايسبس حبل', 3, 12)] },
      { id: 'L', name: 'سحب (ظهر، باي)', exercises: [X('سحب أمامي', 4, 10, 'reps', 90), X('تجديف بار', 3, 10, 'reps', 90), X('فيس بول', 3, 15), X('باي سبس', 3, 12), X('هامر', 3, 12)] },
      { id: 'G', name: 'رجلين', exercises: [X('سكوات', 4, 8, 'reps', 120), X('رفعة رومانية', 3, 10, 'reps', 90), X('ليغ بريس', 3, 12), X('ليغ كيرل', 3, 12), X('سمانة', 4, 15)] },
    ],
  },
  run5k: {
    name: 'مشي وجري — أول 5 كم', sub: '8 أسابيع · 3 أيام · 30 د', place: 'out', icon: 'person-running', tint: '#62c2d6', week: [6, 1, 3],
    days: [{ id: 'R', name: 'جري متقطّع', exercises: [X('مشي سريع (إحماء)', 1, 5, 'min', 0), X('جري دقيقة + مشي دقيقة ونص', 8, 150, 'sec', 0), X('مشي (تبريد)', 1, 5, 'min', 0)] }],
  },
  light20: {
    name: 'أيام الشغل: 20 دقيقة خفيف', sub: 'بينحط لحاله بأيام الشغل', place: 'home', icon: 'briefcase', tint: '#e0a04a', week: [],
    days: [{ id: 'W', name: 'تمرين خفيف', exercises: [X('ضغط', 2, 10), X('سكوات', 2, 15), X('بلانك', 2, 30, 'sec', 30), X('إطالة', 1, 5, 'min', 0)] }],
  },
};
// برنامج من قالب جاهز: الأيام بتتوزّع على أيام الأسبوع
export function programFromTemplate(key, daysPerWeek = null) {
  const t = PROGRAM_TEMPLATES[key];
  const days = t.days.map((d) => ({ ...JSON.parse(JSON.stringify(d)), id: uid('pd') }));
  const week = daysPerWeek && t.week.length > daysPerWeek ? t.week.slice(0, daysPerWeek) : t.week;
  const schedule = {};
  week.forEach((wd, i) => { schedule[wd] = days[i % days.length].id; });
  return { id: uid('pg'), name: t.name, template: key, place: t.place, days, schedule, active: true };
}
export function suggestTemplate(p) {
  if (p.goal === 'keep' && p.place !== 'gym') return 'run5k';
  if (p.place === 'gym') return (Number(p.daysPerWeek) || 3) >= 5 ? 'ppl' : 'gym3';
  return 'home3';
}
export const exText = (e) => (e.unit === 'min' ? `${e.reps} د` : `${e.sets > 1 ? `${e.sets} × ` : ''}${e.unit === 'sec' ? `${e.reps} ث` : e.reps}`);
export function waterTarget(day) {
  const kg = latestWeight(day);
  return kg ? Math.max(6, Math.min(14, Math.round((kg * 35) / 250))) : 8;
}
// جلسة تمرين اليوم: أي تمارين خلصت
export const sessionOn = (day) => (sp().session?.d === day ? sp().session : { d: day, done: [] });
export function toggleExercise(day, i) {
  store.update((s) => {
    const cur = s.sport.session?.d === day ? s.sport.session : { d: day, done: [] };
    cur.done = cur.done.includes(i) ? cur.done.filter((x) => x !== i) : [...cur.done, i];
    s.sport.session = cur;
  });
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
