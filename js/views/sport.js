// صفحة الرياضة والصحة: السعرات بالوجبات، الماء، الوزن، والتمارين والبرامج
import { h, icon, badge, ring, bar, fill, openSheet, toast, haptic, chips, segmented, confirmSheet, debounce } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, dayLabel, shortDate, parseISO, WEEK_SHORT, WEEKDAYS, durText } from '../dates.js';
import { FOODS, FOOD_CATS } from '../data/foods.js';
import { ACTIVITY, GOALS, MEALS, WORKOUT_TYPES, latestWeight, addWeight, calorieTarget, proteinTarget, foodsOn, dayTotals, addFood, removeFood, portion, frequentFoods, waterOn, addWater, workoutsOn, addWorkout, removeWorkout, plannedWorkout, searchOFF, workoutStreakWeeks, bmr } from '../sport.js';
import { secTitle } from './components.js';

let tab = 'food';
let day = null;

export function renderSport(ctx) {
  const today = ctx.today;
  if (!day || day > today) day = today;
  const root = h('div');
  root.append(h('div', { style: { padding: '6px 16px 0' } }, segmented([{ value: 'food', label: 'الأكل' }, { value: 'weight', label: 'الوزن' }, { value: 'train', label: 'التمارين' }], tab, (v) => { tab = v; ctx.refresh(); })));
  if (tab === 'food') root.append(foodTab(ctx, today));
  else if (tab === 'weight') root.append(weightTab(ctx, today));
  else root.append(trainTab(ctx, today));
  return root;
}
export function sportActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ملفي الصحي', onclick: () => openProfile() }, icon('user', 20)); }

function dayNav(ctx, today) {
  return h('div', { class: 'wk-nav' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'اليوم السابق', onclick: () => { day = addDays(day, -1); ctx.refresh(); } }, icon('chevR', 20)),
    h('button', { type: 'button', class: 'wk-label', onclick: () => { day = today; ctx.refresh(); } }, h('b', null, dayLabel(day, today)), h('small', null, shortDate(day))),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'اليوم التالي', disabled: day >= today ? true : null, onclick: () => { if (day < today) { day = addDays(day, 1); ctx.refresh(); } } }, icon('chevL', 20)));
}

/* ---------- الأكل ---------- */
function foodTab(ctx, today) {
  const target = calorieTarget(day);
  const t = dayTotals(day);
  const pt = proteinTarget(day);
  const left = target ? target - Math.round(t.kcal) : null;
  const items = foodsOn(day);
  const water = waterOn(day);
  const burned = workoutsOn(day).reduce((a, w) => a + (w.kcal || 0), 0);
  return h('div', null,
    dayNav(ctx, today),
    h('div', { class: 'kcal-card' },
      ring(target ? t.kcal / target : 0, 108, { stroke: 8, color: left != null && left < 0 ? 'var(--warn)' : 'var(--good)' }),
      h('div', { class: 'kc-center' }, h('b', { class: 'num' }, target ? String(Math.abs(left)) : String(Math.round(t.kcal))), h('small', null, target ? (left >= 0 ? 'سعرة باقية' : 'سعرة زيادة') : 'سعرة')),
      h('div', { class: 'kc-side' },
        h('div', null, h('small', null, 'أكلت'), h('b', { class: 'num' }, String(Math.round(t.kcal)))),
        h('div', null, h('small', null, 'الهدف'), h('b', { class: 'num' }, target ? String(target) : '—')),
        burned ? h('div', null, h('small', null, 'حرقت'), h('b', { class: 'num good' }, String(burned))) : null)),
    h('div', { class: 'macros' },
      macro('بروتين', t.p, pt, 'var(--sky-dhuhr)'),
      macro('كربوهيدرات', t.c, target ? Math.round((target * 0.45) / 4) : null, 'var(--gold)'),
      macro('دهون', t.f, target ? Math.round((target * 0.28) / 9) : null, 'var(--rose, #E9839F)')),
    !target ? h('button', { type: 'button', class: 'banner tap', onclick: () => openProfile() }, h('span', { class: 'banner-ic' }, icon('target', 20)), h('p', null, 'كمّل ملفك الصحي (طول، عمر، هدف) لنحسبلك كم سعرة بتحتاج'), icon('chevL', 18)) : null,
    h('div', { class: 'water-row' }, icon('droplet', 20), h('span', null, `مي: ${water} كاسات`),
      h('div', { class: 'water-cups' }, Array.from({ length: 8 }, (_, i) => h('button', { type: 'button', class: `cup${i < water ? ' on' : ''}`, 'aria-label': `${i + 1} كاسات`, onclick: () => { addWater(day, i < water ? -(water - i) : (i + 1 - water)); haptic('tap'); } })))),
    Object.entries(MEALS).map(([k, name]) => {
      const list = items.filter((x) => (x.meal || 'snack') === k);
      const kc = list.reduce((a, x) => a + x.kcal, 0);
      return h('div', null,
        secTitle(name, { count: kc ? `${kc} سعرة` : null, action: h('button', { type: 'button', class: 'link-btn', onclick: () => openAddFood(day, k) }, icon('plus', 16), 'أضف') }),
        list.length ? h('div', { class: 'group rows' }, list.map((x) => h('div', { class: 'row' },
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x.name), h('span', { class: 'row-sub' }, `${x.grams} غ — ب ${x.p} / ك ${x.c} / د ${x.f}`)),
          h('span', { class: 'num', style: { fontSize: '14px', fontWeight: 600 } }, String(x.kcal)),
          h('button', { type: 'button', class: 'icon-btn ghost small', 'aria-label': 'شيل', onclick: () => removeFood(day, x.id) }, icon('close', 16))))) : null);
    }));
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

/* ---------- الوزن ---------- */
function weightTab(ctx, today) {
  const p = store.state.sport.profile || {};
  const ws = store.state.sport.weights || [];
  const cur = latestWeight(today);
  const start = p.startWeight || ws[0]?.kg || cur;
  const tgt = p.targetWeight;
  const pct = tgt && start && start !== tgt ? Math.max(0, Math.min(1, (cur - start) / (tgt - start))) : 0;
  const bmi = cur && p.height ? cur / ((p.height / 100) ** 2) : null;
  const last = ws.slice(-60);
  return h('div', null,
    h('div', { class: 'kcal-card' },
      ring(pct, 108, { stroke: 8, color: 'var(--gold)' }),
      h('div', { class: 'kc-center' }, h('b', { class: 'num' }, cur ? String(cur) : '—'), h('small', null, 'كغ')),
      h('div', { class: 'kc-side' },
        h('div', null, h('small', null, 'البداية'), h('b', { class: 'num' }, start ? String(start) : '—')),
        h('div', null, h('small', null, 'الهدف'), h('b', { class: 'num' }, tgt ? String(tgt) : '—')),
        bmi ? h('div', null, h('small', null, 'مؤشر الكتلة'), h('b', { class: 'num' }, bmi.toFixed(1))) : null)),
    h('div', { class: 'section-actions' }, h('button', { type: 'button', class: 'btn block', style: { marginTop: 0 }, onclick: () => openWeightLog(today) }, icon('scale', 18), 'سجّل وزن اليوم')),
    last.length > 1 ? h('div', { class: 'group chart-card', style: { marginTop: '12px' } }, weightChart(last, tgt)) : null,
    secTitle('السجلّ', { ic: 'list' }),
    ws.length ? h('div', { class: 'group rows' }, [...ws].reverse().slice(0, 30).map((w, i, arr) => {
      const prev = arr[i + 1];
      const diff = prev ? +(w.kg - prev.kg).toFixed(1) : null;
      return h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title num' }, `${w.kg} كغ`), h('span', { class: 'row-sub' }, dayLabel(w.d, today))),
        diff ? h('span', { class: `pill ${(tgt && ((tgt > start && diff > 0) || (tgt < start && diff < 0))) ? 'good' : 'warn'}` }, `${diff > 0 ? '+' : ''}${diff}`) : null);
    })) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'سجّل وزنك مرة بالأسبوع على الأقل، وبنرسملك المنحنى.'))));
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

/* ---------- التمارين ---------- */
function trainTab(ctx, today) {
  const ws = store.state.sport.workouts || [];
  const week = ws.filter((w) => w.d > addDays(today, -7));
  const planned = plannedWorkout(today);
  const doneToday = workoutsOn(today);
  const streak = workoutStreakWeeks(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return h('div', null,
    h('div', { class: 'duo', style: { margin: '12px 16px 0' } },
      h('div', null, h('small', null, 'هالأسبوع'), h('b', { class: 'num' }, `${week.length} تمارين`), h('span', null, `${week.reduce((a, w) => a + (w.minutes || 0), 0)} دقيقة — ${week.reduce((a, w) => a + (w.kcal || 0), 0)} سعرة`)),
      h('div', null, h('small', null, 'الاستمرار'), h('b', { class: 'num' }, `${streak} أسابيع`), h('span', null, 'ورا بعض فيهم تمرين'))),
    h('div', { class: 'week-dots' }, days.map((d) => h('span', { class: ws.some((w) => w.d === d) ? 'on' : '' }, h('i'), WEEK_SHORT[parseISO(d).getDay()]))),
    planned ? h('div', { class: 'banner', style: { marginTop: '12px' } }, h('span', { class: 'banner-ic' }, icon('dumbbell', 22)),
      h('p', null, h('b', null, `اليوم: ${planned.day.name}`), h('br'), planned.day.exercises.map((e) => e.name).join('، ')),
      doneToday.length ? h('span', { class: 'pill good' }, 'تمّ') : h('button', { type: 'button', class: 'btn small', onclick: () => openWorkoutLog(today, planned) }, 'سجّل')) : null,
    h('div', { class: 'section-actions' }, h('button', { type: 'button', class: 'btn block', style: { marginTop: 0 }, onclick: () => openWorkoutLog(today) }, icon('plus', 18), 'سجّل تمرين')),
    secTitle('البرامج', { ic: 'layers', action: h('button', { type: 'button', class: 'link-btn', onclick: () => openProgram(null) }, icon('plus', 16), 'برنامج') }),
    (store.state.sport.programs || []).length ? h('div', { class: 'group rows' }, store.state.sport.programs.map((p) => h('button', { type: 'button', class: 'row', onclick: () => openProgram(p.id) },
      badge('layers', 'gold', 38), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, p.name), h('span', { class: 'row-sub' }, `${p.days.length} أيام تمرين${p.active ? ' — البرنامج الحالي' : ''}`)), p.active ? h('span', { class: 'pill good' }, 'فعّال') : null))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'اعمل برنامج (مثلاً: صدر وكتف السبت، ظهر الاثنين، أرجل الأربعاء) وبيطلعلك تمرين كل يوم.'))),
    secTitle('آخر التمارين', { ic: 'list' }),
    ws.length ? h('div', { class: 'group rows' }, [...ws].reverse().slice(0, 20).map((w) => h('div', { class: 'row' },
      badge(WORKOUT_TYPES[w.type]?.icon || 'dumbbell', 'gold', 36),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, w.title || WORKOUT_TYPES[w.type]?.name || 'تمرين'), h('span', { class: 'row-sub' }, `${dayLabel(w.d, today)} — ${w.minutes} د — ${w.kcal} سعرة${w.exercises?.length ? ` — ${w.exercises.length} تمارين` : ''}`)),
      h('button', { type: 'button', class: 'icon-btn ghost small', 'aria-label': 'حذف', onclick: async () => { if (await confirmSheet('حذف', 'حذف هالتمرين؟', 'احذف')) removeWorkout(w.id); } }, icon('trash', 16))))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'ما سجّلت تمارين بعد.'))));
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
