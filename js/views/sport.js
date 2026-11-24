// صفحة الرياضة والصحة: السعرات بالوجبات، الماء، الوزن، والتمارين والبرامج
import { h, icon, badge, ring, bar, fill, openSheet, toast, haptic, chips, segmented, confirmSheet, debounce } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, dayLabel, shortDate, parseISO, WEEK_SHORT, WEEKDAYS, durText, weekStartOf, minutesText } from '../dates.js';
import { FOODS, FOOD_CATS } from '../data/foods.js';
import { ACTIVITY, GOALS, MEALS, WORKOUT_TYPES, latestWeight, addWeight, calorieTarget, proteinTarget, foodsOn, dayTotals, addFood, removeFood, portion, frequentFoods, waterOn, addWater, workoutsOn, addWorkout, removeWorkout, plannedWorkout, searchOFF, workoutStreakWeeks, bmr, nextPlanned, PROGRAM_TEMPLATES, programFromTemplate, suggestTemplate, exText, waterTarget, sessionOn, toggleExercise } from '../sport.js';
import { secTitle } from './components.js';

/* ---------- لوحة واحدة: ملخّص اليوم، أزرار سريعة، تمرين اليوم، الوزن والأسبوع، الوجبات، والبرامج ---------- */
const MEAL_IC = { breakfast: ['sun', '#F0C96A'], lunch: ['cloud', '#F0A35E'], dinner: ['moon', '#6F86D9'], snack: ['cookie', '#a682e8'] };
const mealNow = () => { const hh = new Date().getHours(); return hh < 11 ? 'breakfast' : hh < 17 ? 'lunch' : hh < 22 ? 'dinner' : 'snack'; };

export function renderSport(ctx) {
  const today = ctx.today;
  const p = store.state.sport.profile || {};
  const ready = p.age && p.height && latestWeight(today);
  return h('div', { class: 'spd' },
    !ready ? h('button', { type: 'button', class: 'sp-setup', onclick: () => openSetup() },
      h('span', { class: 'sp-sic' }, icon('user-gear', 20)),
      h('span', null, h('b', null, 'كمّل ملفك بأربع خطوات'), h('small', null, 'الطول والوزن والعمر والهدف — منه بنحسب احتياجك وبنقترحلك برنامج تمارين')),
      icon('chevL', 16)) : null,
    todayCard(today),
    quickRow(ctx, today),
    workoutCard(ctx, today),
    h('div', { class: 'sp-two' }, weightCard(today), weekCard(today)),
    mealsCard(today),
    programsSection(ctx, today),
    recentSection(today));
}
export function sportActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ملفي الصحي', onclick: () => openSetup() }, icon('user-gear', 19)); }

function todayCard(today) {
  const target = calorieTarget(today);
  const t = dayTotals(today);
  const left = target ? target - Math.round(t.kcal) : null;
  const pt = proteinTarget(today);
  const water = waterOn(today);
  const wt = waterTarget(today);
  const burned = workoutsOn(today).reduce((a, w) => a + (w.kcal || 0), 0);
  return h('div', { class: 'group sp-today' },
    h('div', { class: 'sp-hero' },
      h('div', { class: 'sp-ring' }, ring(target ? Math.min(1, t.kcal / target) : 0, 104, { stroke: 8, color: left != null && left < 0 ? 'var(--warn)' : '#e0705f' }),
        h('div', { class: 'sp-rc' }, h('b', { class: 'num' }, target ? String(Math.abs(left)) : String(Math.round(t.kcal))), h('small', null, target ? (left >= 0 ? 'سعرة باقية' : 'سعرة زيادة') : 'سعرة'))),
      h('div', { class: 'sp-mac' },
        h('div', { class: 'sp-ate' }, `أكلت ${Math.round(t.kcal)}${target ? ` من ${target}` : ''}${burned ? ` · حرقت ${burned}` : ''}`),
        macro('بروتين', t.p, pt, '#e0705f'),
        macro('كربوهيدرات', t.c, target ? Math.round((target * 0.45) / 4) : null, '#e0a04a'),
        macro('دهون', t.f, target ? Math.round((target * 0.28) / 9) : null, '#c08a4e'))),
    h('div', { class: 'sp-water' },
      h('span', null, icon('droplet', 13), `مي: ${water} من ${wt} كاسات`),
      h('div', { class: 'water-cups' }, Array.from({ length: wt }, (_, i) => h('button', { type: 'button', class: `cup${i < water ? ' on' : ''}`, 'aria-label': `${i + 1} كاسات`, onclick: () => { addWater(today, i < water ? -(water - i) : (i + 1 - water)); haptic('tap'); } })))));
}

function quickRow(ctx, today) {
  const planned = plannedWorkout(today);
  const q = (c, ic, label, fn) => h('button', { type: 'button', class: 'sp-q', style: { '--c': c }, onclick: fn }, h('i', null, icon(ic, 15)), label);
  return h('div', { class: 'sp-qa' },
    q('#e0705f', 'utensils', 'أكلة', () => openAddFood(today, mealNow())),
    q('#e8c46a', 'scale', 'وزن', () => openWeightLog(today)),
    q('#a682e8', 'dumbbell', 'تمرين', () => (planned && !workoutsOn(today).length ? openPlayer(today, planned) : openWorkoutLog(today))),
    q('#62c2d6', 'glass-water', 'مي', () => { addWater(today, 1); haptic('tap'); toast('كاسة مي — صحتين'); }));
}

function workoutCard(ctx, today) {
  const planned = plannedWorkout(today);
  const done = workoutsOn(today);
  const prog = (store.state.sport.programs || []).find((x) => x.active);
  if (!planned) {
    const nx = prog ? nextPlanned(today) : null;
    return h('div', { class: 'sp-wk rest' },
      h('span', { class: 'sp-wic' }, icon(prog ? 'mug' : 'list-check', 16)),
      h('span', { class: 'sp-win' }, h('b', null, prog ? (done.length ? 'تمرين اليوم خلص — عافاك' : 'اليوم راحة') : 'ما اخترت برنامج تمارين'),
        h('small', null, prog ? (nx ? `الجاي: ${WEEKDAYS[parseISO(nx.d).getDay()]} — ${nx.day.name}` : prog.name) : 'اختار واحد من البرامج تحت، أو سجّل تمرينك لحاله')),
      !prog ? h('button', { type: 'button', class: 'btn small', onclick: () => document.querySelector('.sp-progs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 'البرامج') : null);
  }
  const ses = sessionOn(today);
  const n = planned.day.exercises.length;
  const finished = done.length > 0;
  return h('div', { class: 'sp-wk' },
    h('div', { class: 'sp-wh' },
      h('span', { class: 'sp-wic' }, icon(planned.light ? 'briefcase' : 'person-running', 16)),
      h('span', { class: 'sp-win' }, h('b', null, `تمرين اليوم — ${planned.day.name}`), h('small', null, planned.light ? 'يوم شغل — نسخة خفيفة' : planned.program.name)),
      h('span', { class: `pill ${finished ? 'good' : 'acc'}` }, finished ? 'خلص' : `${ses.done.length} من ${n}`)),
    planned.day.exercises.map((e, i) => {
      const on = finished || ses.done.includes(i);
      return h('button', { type: 'button', class: `sp-ex${on ? ' on' : ''}`, onclick: () => { if (!finished) { toggleExercise(today, i); haptic('select'); } } },
        h('span', { class: 'sp-ck' }, on ? icon('check', 10) : null), h('span', { class: 'sp-en' }, e.name), h('span', { class: 'sp-es num' }, exText(e)));
    }),
    !finished ? h('div', { class: 'sp-wbtn' }, h('button', { type: 'button', class: 'btn block', onclick: () => openPlayer(today, planned) }, icon('play', 14), ses.done.length ? 'كمّل التمرين' : 'بلّش التمرين — مؤقت الجولات والراحة')) : null);
}

function weightCard(today) {
  const p = store.state.sport.profile || {};
  const ws = store.state.sport.weights || [];
  const cur = latestWeight(today);
  const wk = ws.filter((w) => w.d <= addDays(today, -6)).slice(-1)[0];
  const diff = cur && wk ? +(cur - wk.kg).toFixed(1) : null;
  const last = ws.slice(-10);
  let spark = null;
  if (last.length > 1) {
    const vals = last.map((w) => w.kg).concat(p.targetWeight ? [p.targetWeight] : []);
    const mn = Math.min(...vals) - 0.3, mx = Math.max(...vals) + 0.3;
    const pts = last.map((w, i) => `${((i / (last.length - 1)) * 100).toFixed(1)},${(36 - ((w.kg - mn) / (mx - mn)) * 32).toFixed(1)}`).join(' ');
    const ty = p.targetWeight ? (36 - ((p.targetWeight - mn) / (mx - mn)) * 32).toFixed(1) : null;
    spark = h('div', { class: 'sp-spark', html: `<svg viewBox="0 0 100 40" preserveAspectRatio="none">${ty ? `<line x1="0" y1="${ty}" x2="100" y2="${ty}" stroke="rgba(232,196,106,.45)" stroke-dasharray="3 3"/>` : ''}<polyline points="${pts}" fill="none" stroke="#e8c46a" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>` });
  }
  const good = diff != null && p.targetWeight && ((p.targetWeight > (p.startWeight || cur) && diff > 0) || (p.targetWeight < (p.startWeight || cur) && diff < 0));
  return h('button', { type: 'button', class: 'group sp-card', onclick: () => openWeightSheet(today) },
    h('small', null, 'الوزن'),
    h('b', { class: 'num' }, cur ? String(cur) : '—', h('em', null, ' كغ')),
    diff ? h('span', { class: `pill ${good ? 'good' : 'warn'}` }, `${diff > 0 ? '+' : ''}${diff} هالأسبوع`) : h('span', { class: 'pill' }, 'سجّل كل أسبوع'),
    spark,
    p.targetWeight ? h('small', null, `الهدف ${p.targetWeight}`) : null);
}

function weekCard(today) {
  const p = store.state.sport.profile || {};
  const ws = store.state.sport.workouts || [];
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(today), i));
  const n = ws.filter((w) => w.d >= days[0] && w.d <= days[6]).length;
  const nx = nextPlanned(today);
  return h('div', { class: 'group sp-card' },
    h('small', null, 'هالأسبوع'),
    h('b', { class: 'num' }, String(n), h('em', null, p.daysPerWeek ? ` من ${p.daysPerWeek}` : ' تمارين')),
    h('div', { class: 'sp-dots' }, days.map((d) => { const on = ws.some((w) => w.d === d); return h('span', null, h('i', { class: `${on ? 'on' : ''}${d === today ? ' td' : ''}` }, on ? icon('check', 9) : null), WEEK_SHORT[parseISO(d).getDay()]); })),
    nx ? h('small', null, `الجاي: ${WEEKDAYS[parseISO(nx.d).getDay()]} — ${nx.day.name}`) : null);
}

function mealsCard(today) {
  const items = foodsOn(today);
  const total = Math.round(items.reduce((a, x) => a + (x.kcal || 0), 0));
  return [
    secTitle('وجبات اليوم', { ic: 'utensils', count: total ? `${total} سعرة` : null }),
    h('div', { class: 'group sp-meals' }, Object.entries(MEALS).map(([k, name]) => {
      const list = items.filter((x) => (x.meal || 'snack') === k);
      const kc = list.reduce((a, x) => a + x.kcal, 0);
      const [ic, c] = MEAL_IC[k];
      return h('div', { class: 'sp-meal' },
        h('span', { class: 'sp-mic', style: { color: c } }, icon(ic, 14)),
        h('button', { type: 'button', class: 'sp-mn', onclick: () => (list.length ? openMealSheet(today, k) : openAddFood(today, k)) },
          h('b', null, name), h('small', null, list.length ? list.map((x) => x.name).join('، ') : '—')),
        kc ? h('span', { class: 'sp-mk num' }, String(Math.round(kc))) : null,
        h('button', { type: 'button', class: 'sp-madd', 'aria-label': `أضف لل${name}`, onclick: () => openAddFood(today, k) }, icon('plus', 13)));
    })),
  ];
}
function openMealSheet(d, meal) {
  openSheet(MEALS[meal], (body, close) => {
    function render() {
      const list = foodsOn(d).filter((x) => (x.meal || 'snack') === meal);
      if (!list.length) { close(); return; }
      fill(body, [
        h('div', { class: 'rows sheet-rows' }, list.map((x) => h('div', { class: 'row' },
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x.name), h('span', { class: 'row-sub' }, `${x.grams ? `${x.grams} غ — ` : ''}ب ${x.p} / ك ${x.c} / د ${x.f}`)),
          h('span', { class: 'num', style: { fontSize: '14px', fontWeight: 600 } }, String(x.kcal)),
          h('button', { type: 'button', class: 'icon-btn ghost small', 'aria-label': 'شيل', onclick: () => { removeFood(d, x.id); render(); } }, icon('close', 16))))),
        h('button', { type: 'button', class: 'btn block', onclick: () => { close(); setTimeout(() => openAddFood(d, meal), 250); } }, icon('plus', 16), 'أضف'),
      ]);
    }
    render();
  });
}

function programsSection(ctx, today) {
  const mine = store.state.sport.programs || [];
  const p = store.state.sport.profile || {};
  const used = new Set(mine.map((x) => x.template).filter(Boolean));
  const sug = suggestTemplate(p);
  const tpls = Object.entries(PROGRAM_TEMPLATES).filter(([k]) => k !== 'light20' && !used.has(k));
  return h('div', { class: 'sp-progs' },
    secTitle('برامج التمارين', { ic: 'layers', action: h('button', { type: 'button', class: 'link-btn', onclick: () => openProgram(null) }, icon('plus', 14), 'برنامجي') }),
    h('div', { class: 'sp-plist' },
      mine.map((x) => h('button', { type: 'button', class: `sp-pl${x.active ? ' on' : ''}`, onclick: () => openProgram(x.id) },
        h('span', { class: 'sp-pic', style: { '--c': PROGRAM_TEMPLATES[x.template]?.tint || '#a682e8' } }, icon(PROGRAM_TEMPLATES[x.template]?.icon || 'layers', 15)),
        h('span', { class: 'sp-pin' }, h('b', null, x.name), h('small', null, `${x.days.length === 1 ? 'يوم واحد' : `${x.days.length} أيام`} · ${Object.values(x.schedule || {}).filter(Boolean).length} بالأسبوع`)),
        h('span', { class: `pill ${x.active ? 'acc' : ''}` }, x.active ? 'برنامجي' : 'فعّله'))),
      tpls.map(([k, t]) => h('button', {
        type: 'button', class: 'sp-pl',
        onclick: async () => {
          if (await confirmSheet(t.name, `${t.sub}\n\n${t.days.map((d) => `${d.name}: ${d.exercises.map((e) => e.name).join('، ')}`).join('\n')}`, 'بلّش فيه', { danger: false })) {
            const prog = programFromTemplate(k, Number(p.daysPerWeek) || null);
            store.update((s) => { s.sport.programs.forEach((x) => { x.active = false; }); s.sport.programs.push(prog); });
            toast(`صار برنامجك: ${t.name}`);
          }
        },
      },
      h('span', { class: 'sp-pic', style: { '--c': t.tint } }, icon(t.icon, 15)),
      h('span', { class: 'sp-pin' }, h('b', null, t.name), h('small', null, t.sub)),
      h('span', { class: `pill ${k === sug ? 'good' : ''}` }, k === sug ? 'مقترح إلك' : 'جرّبه'))),
      store.state.settings.shift?.enabled ? h('label', { class: 'sp-pl sw' },
        h('span', { class: 'sp-pic', style: { '--c': '#e0a04a' } }, icon('briefcase', 15)),
        h('span', { class: 'sp-pin' }, h('b', null, 'أيام الشغل: 20 دقيقة خفيف'), h('small', null, 'بينحط لحاله بأيام الشغل بدل البرنامج')),
        h('input', { type: 'checkbox', checked: p.workLight !== false ? true : null, onchange: (e) => store.update((s) => { s.sport.profile = { ...s.sport.profile, workLight: e.target.checked }; }) })) : null));
}

function recentSection(today) {
  const ws = store.state.sport.workouts || [];
  if (!ws.length) return null;
  return h('details', { class: 'past-exams' }, h('summary', null, `آخر التمارين (${ws.length})`),
    h('div', { class: 'group rows' }, [...ws].reverse().slice(0, 20).map((w) => h('div', { class: 'row' },
      badge(WORKOUT_TYPES[w.type]?.icon || 'dumbbell', 'coral', 36),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, w.title || WORKOUT_TYPES[w.type]?.name || 'تمرين'), h('span', { class: 'row-sub' }, `${dayLabel(w.d, today)} — ${w.minutes} د — ${w.kcal} سعرة${w.exercises?.length ? ` — ${w.exercises.length} تمارين` : ''}`)),
      h('button', { type: 'button', class: 'icon-btn ghost small', 'aria-label': 'حذف', onclick: async () => { if (await confirmSheet('حذف', 'حذف هالتمرين؟', 'احذف')) removeWorkout(w.id); } }, icon('trash', 16))))));
}

/* ---------- الوزن (نافذة) ---------- */
function openWeightSheet(today) {
  let un = null;
  openSheet('الوزن', (body) => {
    function render() {
      const p = store.state.sport.profile || {};
      const ws = store.state.sport.weights || [];
      const cur = latestWeight(today);
      const start = p.startWeight || ws[0]?.kg || cur;
      const bmi = cur && p.height ? cur / ((p.height / 100) ** 2) : null;
      fill(body, [
        h('div', { class: 'sp-wnums' },
          h('div', null, h('small', null, 'هلّق'), h('b', { class: 'num' }, cur ? String(cur) : '—')),
          h('div', null, h('small', null, 'البداية'), h('b', { class: 'num' }, start ? String(start) : '—')),
          h('div', null, h('small', null, 'الهدف'), h('b', { class: 'num' }, p.targetWeight ? String(p.targetWeight) : '—')),
          bmi ? h('div', null, h('small', null, 'مؤشر الكتلة'), h('b', { class: 'num' }, bmi.toFixed(1))) : null),
        ws.length > 1 ? h('div', { class: 'group chart-card', style: { margin: '10px 0 0' } }, weightChart(ws.slice(-60), p.targetWeight)) : null,
        h('button', { type: 'button', class: 'btn block', onclick: () => openWeightLog(today) }, icon('scale', 16), 'سجّل وزن اليوم'),
        ws.length ? h('div', { class: 'rows sheet-rows', style: { marginTop: '10px' } }, [...ws].reverse().slice(0, 30).map((w, i, arr) => {
          const prev = arr[i + 1];
          const diff = prev ? +(w.kg - prev.kg).toFixed(1) : null;
          return h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title num' }, `${w.kg} كغ`), h('span', { class: 'row-sub' }, dayLabel(w.d, today))), diff ? h('span', { class: 'pill' }, `${diff > 0 ? '+' : ''}${diff}`) : null);
        })) : null,
      ]);
    }
    render();
    un = store.subscribe(render);
  }, { tall: true, onClose: () => un?.() });
}

/* ---------- إعداد الملف (4 خطوات) ---------- */
function openSetup() {
  const today = logicalToday();
  const old = store.state.sport.profile || {};
  const p = { sex: 'male', activity: 1.375, goal: 'gain', place: 'home', daysPerWeek: 3, ...old, weight: latestWeight(today) || old.startWeight || '' };
  let step = 0;
  openSheet(null, (body, close) => {
    function num(label, key, ph) { return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), h('input', { type: 'number', value: p[key] || '', placeholder: ph, oninput: (e) => { p[key] = Number(e.target.value) || ''; } })); }
    function opt(key, v, ic, c, t, s) { return h('button', { type: 'button', class: `sp-op${p[key] === v ? ' on' : ''}`, style: { '--c': c }, onclick: () => { p[key] = v; haptic('select'); render(); } }, h('i', null, icon(ic, 14)), h('span', null, t, s ? h('small', null, s) : null)); }
    function render() {
      const kg = Number(p.weight) || null;
      const b = bmr(p, kg);
      const kcal = b ? Math.round(b * Number(p.activity) + (p.goal === 'lose' ? -500 : p.goal === 'gain' ? 350 : 0)) : null;
      const prot = kg ? Math.round(kg * (p.goal === 'gain' ? 1.8 : p.goal === 'lose' ? 1.6 : 1.3)) : null;
      const water = kg ? +(kg * 0.035).toFixed(1) : null;
      const tpl = PROGRAM_TEMPLATES[suggestTemplate(p)];
      const steps = [
        () => [h('h3', { class: 'sp-st' }, 'عرّفنا عليك'),
          h('div', { class: 'seg' }, [['male', 'ذكر'], ['female', 'أنثى']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(p.sex === v), onclick: () => { p.sex = v; render(); } }, l))),
          h('div', { class: 'three' }, num('العمر', 'age', '23'), num('الطول سم', 'height', '178'), num('الوزن كغ', 'weight', '65'))],
        () => [h('h3', { class: 'sp-st' }, 'شو هدفك؟'),
          h('div', { class: 'sp-ops' },
            opt('goal', 'lose', 'fire', '#e0705f', 'تنزيل وزن', 'عجز 500 سعرة'),
            opt('goal', 'gain', 'dumbbell', '#e8c46a', 'زيادة عضل', 'زيادة 350 سعرة'),
            opt('goal', 'keep', 'heart-pulse', '#35b791', 'لياقة وصحة', 'محافظة')),
          num('الوزن اللي بدك توصله (اختياري)', 'targetWeight', '70')],
        () => [h('h3', { class: 'sp-st' }, 'وين وكم مرة بتتمرّن؟'),
          h('div', { class: 'sp-ops two' }, opt('place', 'home', 'house', '#a682e8', 'بالبيت'), opt('place', 'gym', 'dumbbell', '#e0705f', 'نادي')),
          h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'كم يوم بالأسبوع؟'),
            h('div', { class: 'chips' }, [2, 3, 4, 5, 6].map((n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(p.daysPerWeek === n), onclick: () => { p.daysPerWeek = n; render(); } }, String(n))))),
          h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'حركتك باليوم (غير التمرين)'),
            h('div', { class: 'chips' }, [[1.2, 'قليلة'], [1.375, 'خفيفة'], [1.55, 'متوسطة'], [1.725, 'كتيرة']].map(([v, l]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(Number(p.activity) === v), onclick: () => { p.activity = v; render(); } }, l))))],
        () => [h('h3', { class: 'sp-st' }, 'هاد احتياجك'),
          kcal ? h('div', { class: 'sp-res' },
            h('div', { class: 'sp-big' }, h('b', { class: 'num' }, String(kcal)), h('small', null, 'سعرة باليوم')),
            h('div', { class: 'sp-rn' }, h('span', null, icon('drumstick-bite', 12), `بروتين ${prot} غ`), h('span', null, icon('droplet', 12), `مي ${water} ل`)),
            p.targetWeight && kg ? h('p', { class: 'sp-rt' }, (() => { const dlt = p.targetWeight - kg; const rate = dlt > 0 ? 0.25 : 0.5; const wks = Math.ceil(Math.abs(dlt) / rate); return `بتوصل لـ ${p.targetWeight} كغ بشي ${wks >= 8 ? `${Math.round(wks / 4.3)} أشهر` : `${wks} أسابيع`} بمعدّل صحي (${rate} كغ بالأسبوع).`; })()) : null)
            : h('p', { class: 'hint' }, 'ارجع للخطوة الأولى وكمّل العمر والطول والوزن.'),
          h('div', { class: 'sp-sug' }, h('small', null, 'البرنامج المقترح'), h('b', null, tpl.name), h('span', null, tpl.sub))],
      ];
      fill(body, [
        h('div', { class: 'am-title' }, h('h3', null, icon('user-gear', 14), 'ملفي الصحي', h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 16))), h('small', null, `الخطوة ${step + 1} من 4`)),
        h('div', { class: 'sp-steps' }, [0, 1, 2, 3].map((i) => h('i', { class: i <= step ? 'on' : '' }))),
        ...steps[step](),
        h('div', { class: 'am-sticky' },
          step > 0 ? h('button', { type: 'button', class: 'btn secondary', style: { flex: 1 }, onclick: () => { step -= 1; render(); } }, 'رجوع') : null,
          step < 3 ? h('button', { type: 'button', class: 'btn', style: { flex: 2 }, onclick: () => {
            if (step === 0 && (!p.age || !p.height || !p.weight)) { toast('كمّل العمر والطول والوزن.', { kind: 'warn' }); return; }
            step += 1; render();
          } }, 'التالي') : [
            h('button', { type: 'button', class: 'btn secondary', style: { flex: 1 }, onclick: () => save(false) }, 'بس احفظ'),
            h('button', { type: 'button', class: 'btn', style: { flex: 2 }, onclick: () => save(true) }, icon('play', 13), 'احفظ وبلّش البرنامج')]),
      ]);
    }
    function save(withProgram) {
      const kg = Number(p.weight) || null;
      const { weight, ...prof } = p;
      store.update((s) => {
        s.sport.profile = { ...s.sport.profile, ...prof, startWeight: s.sport.profile?.startWeight || kg, autoTarget: true };
        if (withProgram) { s.sport.programs.forEach((x) => { x.active = false; }); s.sport.programs.push(programFromTemplate(suggestTemplate(p), Number(p.daysPerWeek) || null)); }
      });
      if (kg && kg !== latestWeight(today)) addWeight(today, kg);
      close(); toast(withProgram ? 'انحفظ ملفك وبلّش برنامجك — الله يقوّيك' : 'انحفظ ملفك');
    }
    render();
  }, { cls: 'task-form' });
}

/* ---------- مشغّل التمرين: الجولات والراحة ---------- */
function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const o = a.createOscillator(); const g = a.createGain();
    o.frequency.value = 880; g.gain.value = 0.25; o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.25); setTimeout(() => a.close(), 500);
  } catch { /* */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* */ }
}
function openPlayer(today, planned) {
  const exs = planned.day.exercises;
  const ses = sessionOn(today);
  let i = Math.max(0, exs.findIndex((_, k) => !ses.done.includes(k)));
  if (i < 0) i = 0;
  let set = 1, phase = 'work', left = 0, running = false, tm = 0;
  const started = Date.now();
  openSheet(null, (body, close) => {
    const secsOf = (e) => (e.unit === 'min' ? e.reps * 60 : e.unit === 'sec' ? e.reps : 0);
    function startTimer(sec) { left = sec; running = true; clearInterval(tm); tm = setInterval(() => { if (!running) return; left -= 1; if (left <= 0) { clearInterval(tm); running = false; beep(); next(); } else draw(); }, 1000); draw(); }
    function next() {
      const e = exs[i];
      if (phase === 'rest') { phase = 'work'; if (secsOf(exs[i])) startTimer(secsOf(exs[i])); else draw(); return; }
      // خلصت جولة
      if (set < e.sets) { set += 1; if (e.rest) { phase = 'rest'; startTimer(e.rest); } else { phase = 'work'; if (secsOf(e)) startTimer(secsOf(e)); else draw(); } return; }
      // خلص التمرين
      if (!sessionOn(today).done.includes(i)) toggleExercise(today, i);
      const nx = exs.findIndex((_, k) => k > i && !sessionOn(today).done.includes(k));
      if (nx < 0) { phase = 'done'; clearInterval(tm); draw(); return; }
      i = nx; set = 1;
      if (e.rest) { phase = 'rest'; startTimer(Math.min(90, e.rest)); } else { phase = 'work'; if (secsOf(exs[i])) startTimer(secsOf(exs[i])); else draw(); }
    }
    function finish() {
      clearInterval(tm);
      const mins = Math.max(5, Math.round((Date.now() - started) / 60000));
      const type = planned.program.place === 'gym' ? 'gym' : planned.program.place === 'out' ? 'run' : 'home';
      const kcal = addWorkout(today, { type, minutes: mins, title: planned.day.name, exercises: exs.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, unit: e.unit })) });
      haptic('success'); close(); toast(`عافاك! ${minutesText(mins)} — حرقت تقريباً ${kcal} سعرة`, { kind: 'gold' });
    }
    const mm = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    function draw() {
      const e = exs[i];
      const done = sessionOn(today).done;
      const timed = secsOf(e) > 0;
      fill(body, [
        h('div', { class: 'pl-top' },
          h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: () => { clearInterval(tm); close(); } }, icon('close', 16)),
          h('b', null, planned.day.name), h('small', { class: 'num' }, `${done.length} من ${exs.length}`)),
        h('div', { class: 'pl-bar' }, h('i', { style: { width: `${Math.round((done.length / exs.length) * 100)}%` } })),
        phase === 'done' ? h('div', { class: 'pl-main done' },
          h('span', { class: 'pl-ic' }, icon('trophy', 30)),
          h('b', null, 'خلّصت التمرين'),
          h('small', null, `${minutesText(Math.max(1, Math.round((Date.now() - started) / 60000)))} — الله يعطيك العافية`),
          h('button', { type: 'button', class: 'btn block', onclick: finish }, icon('check', 15), 'سجّله'))
          : phase === 'rest' ? h('div', { class: 'pl-main rest' },
            h('small', null, 'راحة'),
            h('div', { class: 'pl-big num' }, mm(Math.max(0, left))),
            h('small', null, `الجاي: ${e.name} — ${set > 1 ? `جولة ${set} من ${e.sets}` : exText(e)}`),
            h('div', { class: 'pl-acts' }, h('button', { type: 'button', class: 'btn secondary', onclick: () => { left += 15; draw(); } }, '+15 ث'), h('button', { type: 'button', class: 'btn', onclick: () => { clearInterval(tm); running = false; next(); } }, 'تخطّى')))
            : h('div', { class: 'pl-main' },
              h('small', null, e.sets > 1 ? `جولة ${set} من ${e.sets}` : 'جولة وحدة'),
              h('b', { class: 'pl-name' }, e.name),
              timed ? h('div', { class: 'pl-big num' }, mm(running || left ? Math.max(0, left) : secsOf(e))) : h('div', { class: 'pl-big num' }, String(e.reps), h('small', null, ' عدّة')),
              h('div', { class: 'pl-acts' },
                timed ? h('button', { type: 'button', class: 'btn', onclick: () => { if (running) { running = false; draw(); } else if (left > 0) { running = true; draw(); } else startTimer(secsOf(e)); } }, icon(running ? 'pause' : 'play', 14), running ? 'وقّف' : left > 0 ? 'كمّل' : 'بلّش')
                  : h('button', { type: 'button', class: 'btn', onclick: () => { haptic('success'); next(); } }, icon('check', 14), 'خلصت الجولة'),
                h('button', { type: 'button', class: 'btn secondary', onclick: () => { clearInterval(tm); running = false; set = e.sets; next(); } }, 'تخطّى التمرين'))),
        h('div', { class: 'pl-list' }, exs.map((x, k) => h('div', { class: `pl-it${done.includes(k) ? ' ok' : ''}${k === i && phase !== 'done' ? ' cur' : ''}` },
          h('span', { class: 'sp-ck' }, done.includes(k) ? icon('check', 10) : null), h('span', null, x.name), h('em', { class: 'num' }, exText(x))))),
        phase !== 'done' && done.length ? h('button', { type: 'button', class: 'link-btn', style: { margin: '12px auto 0', display: 'flex' }, onclick: finish }, 'خلّصت — سجّل اللي عملته') : null,
      ]);
    }
    if (secsOf(exs[i])) left = 0;
    draw();
  }, { full: true, cls: 'pl-sheet', onClose: () => clearInterval(tm) });
}

function macro(label, v, target, color) {
  return h('div', { class: 'macro' }, h('small', null, label), h('b', { class: 'num' }, `${Math.round(v)}${target ? `/${target}` : ''} غ`), bar(target ? v / target : 0, { cls: 'thin', color }));
}

function openAddFood(d, meal) {
  let q = '';
  let online = [];
  let searching = false;
  openSheet(`أضف لل${MEALS[meal]}`, (body) => {
    const input = h('input', { type: 'search', placeholder: 'ابحث: شاورما، رز، تمر…', 'data-autofocus': true });
    const list = h('div');
    const custom = () => store.state.sport.customFoods || [];
    const draw = () => {
      const norm = (s) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
      const nq = norm(q.trim());
      const pool = [...custom(), ...FOODS];
      const res = nq ? pool.filter((f) => norm(f.name).includes(nq)) : [];
      const freq = !nq ? frequentFoods(8) : [];
      fill(list, [
        freq.length ? [h('div', { class: 'sheet-section' }, 'اللي بتكرّره'), h('div', { class: 'rows sheet-rows' }, freq.map((x) => h('button', { type: 'button', class: 'row', onclick: () => { addFood(d, { ...x, meal, n: undefined, id: undefined }); haptic('success'); toast(`انضاف ${x.name}`); } },
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x.name), h('span', { class: 'row-sub' }, `${x.grams} غ`)), h('span', { class: 'num' }, `${x.kcal}`), icon('plus', 18))))] : null,
        nq ? h('div', { class: 'rows sheet-rows' }, res.slice(0, 30).map((f) => foodRow(d, meal, f)),
          res.length ? null : h('div', { class: 'row-note' }, 'ما لقينا بالقائمة. جرّب البحث أونلاين أو أضف أكلتك بقيمها.')) : null,
        nq ? h('button', { type: 'button', class: 'btn secondary block', disabled: searching ? true : null, onclick: async () => { searching = true; draw(); try { online = await searchOFF(q); } catch { toast('البحث أونلاين بدو نت.', { kind: 'warn' }); online = []; } searching = false; draw(); } }, icon('search', 16), searching ? 'عم نبحث…' : 'ابحث بالمنتجات المعلّبة أونلاين') : null,
        online.length ? h('div', { class: 'rows sheet-rows' }, online.map((f) => foodRow(d, meal, f))) : null,
        !nq ? [h('div', { class: 'sheet-section' }, 'تصفّح'), ...FOOD_CATS.map((c) => h('details', { class: 'food-cat' }, h('summary', null, c), h('div', { class: 'rows sheet-rows' }, FOODS.filter((f) => f.cat === c).map((f) => foodRow(d, meal, f)))))] : null,
        h('div', { class: 'two', style: { marginTop: '10px' } },
          h('button', { type: 'button', class: 'btn secondary', onclick: () => openQuickKcal(d, meal) }, 'سعرات بس'),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => openCustomFood(q) }, 'أكلة جديدة')),
      ]);
    };
    input.addEventListener('input', debounce((e) => { q = e.target.value; online = []; draw(); }, 150));
    fill(body, [input, list]);
    draw();
  }, { tall: true });
}
function foodRow(d, meal, f) {
  return h('button', { type: 'button', class: 'row', onclick: () => openPortion(d, meal, f) },
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, f.name), h('span', { class: 'row-sub' }, `${f.unit} (${f.grams} غ) = ${Math.round((f.kcal * f.grams) / 100)} سعرة`)),
    icon('chevL', 16));
}
function openPortion(d, meal, f) {
  let n = 1;
  let grams = f.grams;
  openSheet(f.name, (body, close) => {
    function render() {
      const pr = portion(f, grams);
      fill(body, [
        h('p', { class: 'hint' }, `${f.kcal} سعرة لكل 100 غ`),
        h('div', { class: 'chips', style: { marginBottom: '12px' } }, [0.5, 1, 1.5, 2, 3].map((k) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(n === k), onclick: () => { n = k; grams = Math.round(f.grams * k); render(); } }, `${k === 0.5 ? 'نص' : k} ${f.unit}`))),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'أو بالغرام'), h('input', { type: 'number', value: grams, oninput: (e) => { grams = Number(e.target.value) || 0; n = null; const pr2 = portion(f, grams); out.textContent = `${pr2.kcal} سعرة — بروتين ${pr2.p} غ`; } })),
        out,
        h('button', { type: 'button', class: 'btn block', onclick: () => { addFood(d, { ...portion(f, grams), meal }); haptic('success'); toast(`انضاف ${f.name}`); close(); } }, icon('plus', 18), 'أضف'),
      ]);
      out.textContent = `${pr.kcal} سعرة — بروتين ${pr.p} غ، كربوهيدرات ${pr.c} غ، دهون ${pr.f} غ`;
    }
    const out = h('p', { class: 'kc-out' });
    render();
  });
}
function openQuickKcal(d, meal) {
  openSheet('سعرات بس', (body, close) => {
    let name = '', kcal = 0;
    fill(body, [
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'شو أكلت'), h('input', { type: 'text', placeholder: 'متل: عزيمة عند أهلي', oninput: (e) => { name = e.target.value; } })),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'كم سعرة تقريباً'), h('input', { type: 'number', 'data-autofocus': true, oninput: (e) => { kcal = Number(e.target.value) || 0; } })),
      h('button', { type: 'button', class: 'btn block', onclick: () => { if (!kcal) return; addFood(d, { name: name || 'أكلة', grams: 0, kcal, p: 0, c: 0, f: 0, meal }); close(); } }, 'أضف'),
    ]);
  });
}
function openCustomFood(prefill = '') {
  openSheet('أكلة جديدة (لكل 100 غ)', (body, close) => {
    const f = { name: prefill, kcal: 0, p: 0, c: 0, f: 0, unit: 'حصة', grams: 100 };
    const num = (k, l) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, l), h('input', { type: 'number', oninput: (e) => { f[k] = Number(e.target.value) || 0; } }));
    fill(body, [
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: prefill, oninput: (e) => { f.name = e.target.value; } })),
      h('div', { class: 'two' }, num('kcal', 'سعرات'), num('p', 'بروتين غ')), h('div', { class: 'two' }, num('c', 'كربوهيدرات غ'), num('f', 'دهون غ')),
      h('div', { class: 'two' }, h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'اسم الحصة'), h('input', { type: 'text', value: 'حصة', oninput: (e) => { f.unit = e.target.value; } })), num('grams', 'غرامات الحصة')),
      h('button', { type: 'button', class: 'btn block', onclick: () => { if (!f.name || !f.kcal) { toast('الاسم والسعرات ضروريين.', { kind: 'warn' }); return; } store.update((s) => { s.sport.customFoods.push({ id: uid('cf'), cat: 'أكلاتي', ...f, grams: f.grams || 100 }); }); close(); toast('انحفظت الأكلة'); } }, 'احفظ'),
    ]);
  });
}

function weightChart(ws, tgt) {
  const W = 320, H = 130, pad = 12;
  const vals = ws.map((w) => w.kg).concat(tgt ? [tgt] : []);
  const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, ws.length - 1);
  const y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  const path = ws.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ');
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="curve" preserveAspectRatio="none">
    ${tgt ? `<line x1="${pad}" x2="${W - pad}" y1="${y(tgt)}" y2="${y(tgt)}" stroke="rgba(242,196,107,.5)" stroke-dasharray="4 4"/>` : ''}
    <path d="${path}" fill="none" stroke="#F2C46B" stroke-width="2.2" stroke-linejoin="round"/>
    ${ws.map((w, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(w.kg).toFixed(1)}" r="2.6" fill="#F2C46B"/>`).join('')}
  </svg>`;
  return h('div', null, h('div', { class: 'curve-wrap', html: svg }), h('div', { class: 'chart-ends' }, h('span', null, shortDate(ws[ws.length - 1].d)), h('span', null, shortDate(ws[0].d))),
    tgt ? h('p', { class: 'chart-note' }, `الخط المنقّط هدفك: ${tgt} كغ`) : null);
}
function openWeightLog(today) {
  openSheet('وزن اليوم', (body, close) => {
    const input = h('input', { type: 'number', step: '0.1', inputmode: 'decimal', value: latestWeight(today) || '', 'data-autofocus': true });
    fill(body, [h('p', { class: 'hint' }, 'أفضل وقت: الصبح بعد الحمام وقبل الأكل.'), input,
      h('button', { type: 'button', class: 'btn block', onclick: () => { const v = Number(input.value); if (!v) return; addWeight(today, v); haptic('success'); close(); toast(`سجّلنا ${v} كغ`); } }, 'سجّل')]);
  });
}

function openWorkoutLog(d, planned = null) {
  const w = { type: 'gym', minutes: 45, title: planned?.day.name || '', exercises: planned ? planned.day.exercises.map((e) => ({ name: e.name, sets: e.sets || 3, reps: e.reps || 10, kg: '' })) : [] };
  openSheet('تمرين', (body, close) => {
    function render() {
      fill(body, [
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'النوع'), chips(Object.entries(WORKOUT_TYPES).map(([v, t]) => ({ value: v, label: t.name })), w.type, (v) => { w.type = v; render(); })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'المدة'), chips([15, 30, 45, 60, 90].map((m) => ({ value: m, label: `${m} د` })), w.minutes, (v) => { w.minutes = v; render(); })),
        h('div', { class: 'sheet-section' }, 'التمارين (اختياري)'),
        h('div', { class: 'rows sheet-rows' }, w.exercises.map((e, i) => h('div', { class: 'ex-line' },
          h('input', { type: 'text', value: e.name, placeholder: 'اسم التمرين', oninput: (ev) => { e.name = ev.target.value; } }),
          h('input', { type: 'number', value: e.sets, 'aria-label': 'جولات', oninput: (ev) => { e.sets = Number(ev.target.value); } }),
          h('input', { type: 'number', value: e.reps, 'aria-label': 'تكرار', oninput: (ev) => { e.reps = Number(ev.target.value); } }),
          h('input', { type: 'number', value: e.kg, placeholder: 'كغ', 'aria-label': 'وزن', oninput: (ev) => { e.kg = ev.target.value; } }),
          h('button', { type: 'button', class: 'icon-btn ghost small', onclick: () => { w.exercises.splice(i, 1); render(); } }, icon('close', 14)))),
          h('button', { type: 'button', class: 'row', onclick: () => { w.exercises.push({ name: '', sets: 3, reps: 10, kg: '' }); render(); } }, icon('plus', 18), h('span', { class: 'row-main' }, 'أضف تمرين (جولات × تكرار × وزن)'))),
        h('button', { type: 'button', class: 'btn block', onclick: () => { const kcal = addWorkout(d, { ...w, exercises: w.exercises.filter((e) => e.name) }); haptic('success'); close(); toast(`عافاك! حرقت تقريباً ${kcal} سعرة`, { kind: 'gold' }); } }, 'سجّل التمرين'),
      ]);
    }
    render();
  });
}

function openProgram(id) {
  const ex = id ? store.state.sport.programs.find((p) => p.id === id) : null;
  const p = ex ? JSON.parse(JSON.stringify(ex)) : { name: '', days: [{ id: uid('pd'), name: 'اليوم 1', exercises: [] }], schedule: {}, active: !(store.state.sport.programs || []).length };
  openSheet(ex ? 'البرنامج' : 'برنامج جديد', (body, close) => {
    function render() {
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'اسم البرنامج'), h('input', { type: 'text', value: p.name, placeholder: 'متل: تقسيم 3 أيام', oninput: (e) => { p.name = e.target.value; } })),
        p.days.map((dd, di) => h('div', { class: 'prog-day' },
          h('div', { class: 'pd-head' }, h('input', { type: 'text', value: dd.name, oninput: (e) => { dd.name = e.target.value; } }), h('button', { type: 'button', class: 'icon-btn ghost small', onclick: () => { p.days.splice(di, 1); render(); } }, icon('trash', 15))),
          h('div', { class: 'chips', style: { margin: '6px 0' } }, [6, 0, 1, 2, 3, 4, 5].map((wd) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(p.schedule[wd] === dd.id), onclick: () => { p.schedule[wd] = p.schedule[wd] === dd.id ? null : dd.id; render(); } }, WEEKDAYS[wd]))),
          dd.exercises.map((e, ei) => h('div', { class: 'ex-line' },
            h('input', { type: 'text', value: e.name, placeholder: 'التمرين', oninput: (ev) => { e.name = ev.target.value; } }),
            h('input', { type: 'number', value: e.sets, oninput: (ev) => { e.sets = Number(ev.target.value); } }),
            h('input', { type: 'number', value: e.reps, oninput: (ev) => { e.reps = Number(ev.target.value); } }),
            h('button', { type: 'button', class: 'icon-btn ghost small', onclick: () => { dd.exercises.splice(ei, 1); render(); } }, icon('close', 14)))),
          h('button', { type: 'button', class: 'link-btn', onclick: () => { dd.exercises.push({ name: '', sets: 3, reps: 10 }); render(); } }, icon('plus', 14), 'تمرين'))),
        h('button', { type: 'button', class: 'btn secondary block', onclick: () => { p.days.push({ id: uid('pd'), name: `اليوم ${p.days.length + 1}`, exercises: [] }); render(); } }, icon('plus', 16), 'يوم تمرين'),
        h('button', { type: 'button', class: 'btn block', onclick: () => {
          if (!p.name.trim()) { toast('سمّ البرنامج.', { kind: 'warn' }); return; }
          store.update((s) => { if (p.active) s.sport.programs.forEach((x) => { x.active = false; }); if (ex) { const i = s.sport.programs.findIndex((x) => x.id === id); s.sport.programs[i] = p; } else s.sport.programs.push({ id: uid('pg'), ...p }); });
          close();
        } }, 'احفظ'),
        ex && !ex.active ? h('button', { type: 'button', class: 'btn ghost block', onclick: () => { store.update((s) => { s.sport.programs.forEach((x) => { x.active = x.id === id; }); }); close(); } }, 'خلّيه البرنامج الحالي') : null,
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: () => { store.update((s) => { s.sport.programs = s.sport.programs.filter((x) => x.id !== id); }); close(); } }, 'حذف البرنامج') : null,
      ]);
    }
    render();
  }, { tall: true });
}

function openProfile() {
  const p = { sex: 'male', activity: 1.375, goal: 'keep', ...(store.state.sport.profile || {}) };
  openSheet('ملفي الصحي', (body, close) => {
    function render() {
      const kg = latestWeight(logicalToday());
      const b = bmr(p, kg);
      fill(body, [
        h('div', { class: 'seg' }, [['male', 'ذكر'], ['female', 'أنثى']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(p.sex === v), onclick: () => { p.sex = v; render(); } }, l))),
        h('div', { class: 'three' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العمر'), h('input', { type: 'number', value: p.age || '', oninput: (e) => { p.age = Number(e.target.value); } })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الطول سم'), h('input', { type: 'number', value: p.height || '', oninput: (e) => { p.height = Number(e.target.value); } })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الوزن الهدف'), h('input', { type: 'number', value: p.targetWeight || '', oninput: (e) => { p.targetWeight = Number(e.target.value); } }))),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'هدفك'), chips(Object.entries(GOALS).map(([v, l]) => ({ value: v, label: l })), p.goal, (v) => { p.goal = v; render(); })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'نشاطك'), chips(Object.entries(ACTIVITY).map(([v, l]) => ({ value: Number(v), label: l })), Number(p.activity), (v) => { p.activity = v; render(); })),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'هدف السعرات اليومي (اتركه فاضي ليتحسب لحاله)'), h('input', { type: 'number', value: p.autoTarget ? '' : (p.kcalTarget || ''), placeholder: b ? `محسوب: ${Math.round(b * p.activity + (p.goal === 'lose' ? -500 : p.goal === 'gain' ? 350 : 0))}` : '', oninput: (e) => { p.kcalTarget = Number(e.target.value) || null; p.autoTarget = !p.kcalTarget; } })),
        h('button', { type: 'button', class: 'btn block', onclick: () => { store.update((s) => { s.sport.profile = { ...s.sport.profile, ...p }; }); close(); toast('انحفظ ملفك'); } }, 'احفظ'),
      ]);
    }
    render();
  });
}
