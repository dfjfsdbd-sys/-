// صفحة العناية: روتين الصبح والليل، الحمام بالأسبوع، الجلسات، المواعيد الدورية، ورفّ المنتجات
import { h, icon, fill, openSheet, toast, haptic, openDatePicker, confirmSheet, pickImage, openActions, stepper } from '../ui.js';
import { logicalToday } from '../prayer.js';
import { shortDate, daysBetween, inDaysText, daysText, WEEK_SHORT, WEEK_START } from '../dates.js';
import {
  care, ensureCare, stepsFor, doneSteps, toggleStep, routineState, saveStep, deleteStep, bathsThisWeek, lastBath, toggleBath, setBathTarget,
  saveSession, deleteSession, sessionDone, undoSession, saveRecurring, deleteRecurring, recurringDone, recurringNext, saveProduct, deleteProduct,
} from '../care.js';

const PINK = '#E9839F';
const STEP_ICONS = ['pump-soap', 'droplet', 'jar', 'umbrella', 'spray-can', 'flask', 'leaf', 'eye', 'hand-sparkles', 'face-smile'];
const SLOT = { am: { name: 'روتين الصبح', ic: 'sun', c: '#F0C96A' }, pm: { name: 'روتين الليل', ic: 'moon', c: '#6F86D9' } };

export function renderCare(ctx) {
  ensureCare();
  const c = care();
  const today = ctx.today;
  const bw = bathsThisWeek(today);
  const lb = lastBath();
  return h('div', { class: 'cr-page' },
    ['am', 'pm'].map((slot) => routineCard(slot, today)),
    h('div', { class: 'cr-list' },
      h('div', { class: 'cr-it', style: { '--c': '#62c2d6' } },
        h('span', { class: 'cr-ic' }, icon('shower', 15)),
        h('div', { class: 'cr-in' }, h('b', null, 'الحمام هالأسبوع'), h('small', null, `${bw} من ${c.baths.perWeek}${lb ? ` · آخر مرة ${lb === today ? 'اليوم' : shortDate(lb)}` : ''}`),
          h('span', { class: 'cr-bar' }, h('i', { style: { width: `${Math.min(100, Math.round((bw / c.baths.perWeek) * 100))}%` } }))),
        h('button', { type: 'button', class: `btn small ${c.baths.log?.[today] ? 'secondary' : ''}`, onclick: () => { toggleBath(today); haptic('select'); } }, c.baths.log?.[today] ? 'تراجع' : 'اليوم')),
      (c.sessions || []).map((x) => {
        const n = (x.done || []).length;
        return h('button', { type: 'button', class: 'cr-it', style: { '--c': PINK }, onclick: () => openSession(x.id) },
          h('span', { class: 'cr-ic' }, icon('wand-magic-sparkles', 15)),
          h('div', { class: 'cr-in' }, h('b', null, x.name), h('small', null, n >= x.total ? `خلصت الجلسات ${x.total}` : `الجلسة ${n + 1} من ${x.total}${x.next ? ` · ${x.next <= today ? (x.next === today ? 'اليوم' : 'متأخرة') : shortDate(x.next)}` : ''} · كل ${daysText(x.every)}`),
            h('span', { class: 'cr-sess' }, Array.from({ length: x.total }, (_, i) => h('i', { class: i < n ? 'on' : i === n ? 'nx' : '' })))));
      }),
      (c.recurring || []).map((x) => {
        const nx = recurringNext(x);
        const left = nx ? daysBetween(today, nx) : null;
        return h('button', { type: 'button', class: 'cr-it', style: { '--c': '#a682e8' }, onclick: () => openRecurring(x.id) },
          h('span', { class: 'cr-ic' }, icon('calendar-check', 15)),
          h('div', { class: 'cr-in' }, h('b', null, x.name), h('small', null, `كل ${daysText(x.every)}${x.last ? ` · آخر مرة ${shortDate(x.last)}` : ''}${left != null ? ` · ${left <= 0 ? 'مستحقة' : `الجاية ${inDaysText(left)}`}` : ''}`)),
          left != null && left <= 0 ? h('span', { class: 'pill warn' }, 'مستحقة') : null);
      })),
    h('div', { class: 'cr-sec' }, h('span', null, icon('jar', 13), 'رفّ منتجاتي'), h('button', { type: 'button', class: 'link-btn', onclick: () => openProduct(null) }, icon('plus', 12), 'منتج')),
    (c.products || []).length ? h('div', { class: 'cr-shelf' }, c.products.map((p) => {
      const left = p.expires ? daysBetween(today, p.expires) : null;
      return h('button', { type: 'button', class: 'cr-prod', onclick: () => openProduct(p.id) },
        h('span', { class: `cr-pi${p.image ? ' img' : ''}` }, p.image ? h('img', { src: p.image, alt: '' }) : icon(p.icon || 'jar', 20)),
        h('b', null, p.name), h('small', { class: left != null && left <= 30 ? 'w' : '' }, left != null && left <= 30 ? (left < 0 ? 'انتهى' : `بينتهي ${inDaysText(left)}`) : { am: 'صبح', pm: 'ليل', both: 'صبح وليل' }[p.when || 'both']));
    })) : h('p', { class: 'section-note' }, 'ضيفي منتجاتك بصورها وإيمت بتنتهي — بيذكّرك قبل بشهر.'));
}
export function careActions() {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'إضافة', onclick: () => openActions('إضافة', [
    { icon: 'sun', label: 'خطوة بروتين الصبح', run: () => openStep('am', null) },
    { icon: 'moon', label: 'خطوة بروتين الليل', run: () => openStep('pm', null) },
    { icon: 'jar', label: 'منتج', run: () => openProduct(null) },
    { icon: 'wand-magic-sparkles', label: 'جلسات (ليزر…)', run: () => openSession(null) },
    { icon: 'calendar-check', label: 'موعد دوري (تنظيف، إزالة شعر…)', run: () => openRecurring(null) },
    { icon: 'shower', label: 'كم حمام بالأسبوع؟', run: () => openBathTarget() },
  ]) }, icon('plus', 20));
}

function routineCard(slot, today) {
  const sl = SLOT[slot];
  const st = routineState(slot, today);
  const done = doneSteps(slot, today);
  const steps = stepsFor(slot, today);
  const prods = care()?.products || [];
  return h('div', { class: 'cr-rt' },
    h('div', { class: 'cr-rh' }, h('span', { class: 'cr-ic', style: { '--c': sl.c } }, icon(sl.ic, 15)), h('b', null, sl.name), h('em', null, `${st.done} من ${st.total}`),
      h('button', { type: 'button', class: 'link-btn', onclick: () => openStep(slot, null) }, icon('plus', 11))),
    steps.map((x) => {
      const on = done.includes(x.id);
      const prod = prods.find((p) => p.id === x.productId);
      return h('div', { class: `cr-st${on ? ' ok' : ''}` },
        h('button', { type: 'button', class: 'cr-stb', onclick: () => openStep(slot, x.id) },
          h('span', { class: `cr-pi sm${prod?.image ? ' img' : ''}` }, prod?.image ? h('img', { src: prod.image, alt: '' }) : icon(x.icon || 'droplet', 14)),
          h('span', { class: 'cr-in' }, h('b', null, x.name), h('small', null, [prod?.name, x.note, x.days?.length ? x.days.map((d) => WEEK_SHORT[d]).join(' ') : null].filter(Boolean).join(' · ')))),
        h('button', { type: 'button', class: 'cr-ck', 'aria-label': on ? 'تراجع' : 'تمّ', onclick: () => { toggleStep(slot, today, x.id); haptic(on ? 'select' : 'success'); } }, on ? icon('check', 11) : null));
    }),
    !steps.length ? h('p', { class: 'cr-empty' }, 'ما في خطوات لهاليوم.') : null);
}

function openStep(slot, id) {
  const ex = id ? care()[slot].find((x) => x.id === id) : null;
  const f = { name: ex?.name || '', note: ex?.note || '', icon: ex?.icon || 'droplet', days: [...(ex?.days || [])], productId: ex?.productId || null };
  openSheet(ex ? 'الخطوة' : `خطوة بـ${SLOT[slot].name}`, (body, close) => {
    function render() {
      const prods = (care()?.products || []).filter((p) => p.when === 'both' || p.when === slot || !p.when);
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الخطوة'), h('input', { type: 'text', value: f.name, 'data-autofocus': !ex ? true : null, placeholder: 'متل: سيروم فيتامين C', oninput: (e) => { f.name = e.target.value; } })),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'ملاحظة'), h('input', { type: 'text', value: f.note, placeholder: 'متل: قطرتين', oninput: (e) => { f.note = e.target.value; } })),
        h('div', { class: 'icon-grid' }, STEP_ICONS.map((ic) => h('button', { type: 'button', class: 'icon-choice', 'aria-pressed': String(f.icon === ic), style: { '--tint': PINK }, onclick: () => { f.icon = ic; render(); } }, icon(ic, 18)))),
        prods.length ? h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'المنتج (اختياري)'),
          h('div', { class: 'chips' }, prods.map((p) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(f.productId === p.id), onclick: () => { f.productId = f.productId === p.id ? null : p.id; render(); } }, p.name)))) : null,
        h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'بأي أيام؟'),
          h('div', { class: 'chips' }, h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(!f.days.length), onclick: () => { f.days = []; render(); } }, 'كل يوم'),
            Array.from({ length: 7 }, (_, i) => (WEEK_START + i) % 7).map((wd) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(f.days.includes(wd)), onclick: () => { f.days = f.days.includes(wd) ? f.days.filter((x) => x !== wd) : [...f.days, wd]; render(); } }, WEEK_SHORT[wd])))),
        h('button', { type: 'button', class: 'btn block', onclick: () => { if (!f.name.trim()) { toast('اكتبي اسم الخطوة.', { kind: 'warn' }); return; } saveStep(slot, ex ? { id: ex.id, ...f, name: f.name.trim() } : { ...f, name: f.name.trim() }); close(); } }, ex ? 'احفظ' : 'أضف'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: () => { deleteStep(slot, ex.id); close(); } }, 'حذف الخطوة') : null,
      ]);
    }
    render();
  });
}

function openProduct(id) {
  const ex = id ? care().products.find((x) => x.id === id) : null;
  const f = { name: ex?.name || '', image: ex?.image || null, when: ex?.when || 'both', opened: ex?.opened || null, expires: ex?.expires || null };
  const today = logicalToday();
  openSheet(ex ? 'المنتج' : 'منتج جديد', (body, close) => {
    function render() {
      fill(body, [
        h('div', { class: 'lect-head' },
          h('button', { type: 'button', class: 'lect-img', onclick: async () => { const img = await pickImage({ square: false }); if (img) { f.image = img; render(); } } }, f.image ? h('img', { src: f.image, alt: '' }) : [icon('camera', 24), h('small', null, 'صورة')]),
          h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: f.name, placeholder: 'متل: واقي شمس', oninput: (e) => { f.name = e.target.value; } }))),
        h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'إيمت بتستعمليه؟'),
          h('div', { class: 'chips' }, [['am', 'صبح'], ['pm', 'ليل'], ['both', 'صبح وليل']].map(([v, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(f.when === v), onclick: () => { f.when = v; render(); } }, l)))),
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'select-btn', onclick: () => openDatePicker({ value: f.opened || today, today, title: 'فتحتيه بـ', allowEmpty: true, onPick: (d) => { f.opened = d || null; render(); } }) }, icon('box-open', 15), h('span', { class: f.opened ? 'sb-val' : 'sb-val ph' }, f.opened ? `فتحتيه ${shortDate(f.opened)}` : 'إيمت فتحتيه')),
          h('button', { type: 'button', class: 'select-btn', onclick: () => openDatePicker({ value: f.expires, today, title: 'بينتهي بـ', allowEmpty: true, onPick: (d) => { f.expires = d || null; render(); } }) }, icon('hourglass-end', 15), h('span', { class: f.expires ? 'sb-val' : 'sb-val ph' }, f.expires ? `بينتهي ${shortDate(f.expires)}` : 'إيمت بينتهي'))),
        h('button', { type: 'button', class: 'btn block', onclick: () => { if (!f.name.trim()) { toast('اكتبي اسم المنتج.', { kind: 'warn' }); return; } saveProduct(ex ? { id: ex.id, ...f, name: f.name.trim() } : { ...f, name: f.name.trim() }); close(); } }, ex ? 'احفظ' : 'أضف'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف', `حذف «${ex.name}»؟`, 'احذف')) { deleteProduct(ex.id); close(); } } }, 'حذف المنتج') : null,
      ]);
    }
    render();
  });
}

function openSession(id) {
  const ex = id ? care().sessions.find((x) => x.id === id) : null;
  const f = { name: ex?.name || 'جلسات الليزر', total: ex?.total || 8, every: ex?.every || 28, next: ex?.next || null };
  const today = logicalToday();
  openSheet(ex ? ex.name : 'جلسات جديدة', (body, close) => {
    function render() {
      const n = ex ? (ex.done || []).length : 0;
      fill(body, [
        ex && n < ex.total ? h('button', { type: 'button', class: 'btn block', onclick: () => { sessionDone(ex.id, today); haptic('success'); close(); toast(`انسجلت الجلسة ${n + 1} — الجاية ${shortDate(care().sessions.find((x) => x.id === ex.id)?.next || today)}`); } }, icon('check', 15), `عملت الجلسة ${n + 1} اليوم`) : null,
        ex && n ? h('button', { type: 'button', class: 'btn secondary block', onclick: () => { undoSession(ex.id); close(); } }, 'تراجع عن آخر جلسة') : null,
        h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: f.name, oninput: (e) => { f.name = e.target.value; } })),
        h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'كم جلسة؟')), stepper(f.total, (v) => { f.total = v; }, { min: 1, max: 30 })),
        h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'كل كم يوم؟')), stepper(f.every, (v) => { f.every = v; }, { min: 7, max: 90, step: 7, suffix: ' يوم' })),
        h('button', { type: 'button', class: 'select-btn', style: { marginTop: '10px' }, onclick: () => openDatePicker({ value: f.next || today, today, title: 'الجلسة الجاية', onPick: (d) => { f.next = d || null; render(); } }) }, icon('calendar', 15), h('span', { class: f.next ? 'sb-val' : 'sb-val ph' }, f.next ? `الجاية ${shortDate(f.next)}` : 'موعد الجلسة الجاية')),
        h('button', { type: 'button', class: 'btn block', onclick: () => { saveSession(ex ? { id: ex.id, ...f } : f); close(); } }, ex ? 'احفظ' : 'أضف'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: () => { deleteSession(ex.id); close(); } }, 'حذف') : null,
      ]);
    }
    render();
  });
}

function openRecurring(id) {
  const ex = id ? care().recurring.find((x) => x.id === id) : null;
  const f = { name: ex?.name || '', every: ex?.every || 30, last: ex?.last || null };
  const today = logicalToday();
  openSheet(ex ? ex.name : 'موعد دوري', (body, close) => {
    function render() {
      fill(body, [
        ex ? h('button', { type: 'button', class: 'btn block', onclick: () => { recurringDone(ex.id, today); haptic('success'); close(); toast('انسجلت — الجاية بموعدها'); } }, icon('check', 15), 'عملتها اليوم') : null,
        h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'شو هي؟'), h('input', { type: 'text', value: f.name, 'data-autofocus': !ex ? true : null, placeholder: 'متل: تنظيف البشرة عند المختصة', oninput: (e) => { f.name = e.target.value; } })),
        h('div', { class: 'chips', style: { marginBottom: '8px' } }, ['تنظيف البشرة', 'إزالة الشعر', 'قص الشعر', 'ماسك الشعر'].map((t) => h('button', { type: 'button', class: 'chip small', onclick: () => { f.name = t; render(); } }, t))),
        h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'كل كم يوم؟')), stepper(f.every, (v) => { f.every = v; }, { min: 3, max: 120, step: 1, suffix: ' يوم' })),
        h('button', { type: 'button', class: 'select-btn', style: { marginTop: '10px' }, onclick: () => openDatePicker({ value: f.last || today, today, title: 'آخر مرة', onPick: (d) => { f.last = d || null; render(); } }) }, icon('calendar', 15), h('span', { class: f.last ? 'sb-val' : 'sb-val ph' }, f.last ? `آخر مرة ${shortDate(f.last)}` : 'آخر مرة عملتيها')),
        h('button', { type: 'button', class: 'btn block', onclick: () => { if (!f.name.trim()) { toast('اكتبي الاسم.', { kind: 'warn' }); return; } saveRecurring(ex ? { id: ex.id, ...f, name: f.name.trim() } : { ...f, name: f.name.trim() }); close(); } }, ex ? 'احفظ' : 'أضف'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: () => { deleteRecurring(ex.id); close(); } }, 'حذف') : null,
      ]);
    }
    render();
  });
}

function openBathTarget() {
  openSheet('كم حمام بالأسبوع؟', (body, close) => {
    fill(body, [
      h('div', { class: 'chips' }, [2, 3, 4, 5, 7].map((n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(care().baths.perWeek === n), onclick: () => { setBathTarget(n); close(); } }, String(n)))),
    ]);
  });
}

// لصفحة اليوم: نافذة صغيرة لروتين وحدة
export function openCareRoutine(slot, day) {
  openSheet(SLOT[slot].name, (body) => {
    function render() {
      fill(body, [routineCard(slot, day)]);
    }
    render();
    body.addEventListener('click', () => setTimeout(render, 30));
  });
}
