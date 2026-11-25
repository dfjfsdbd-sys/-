// أدوات الواجهة: إنشاء العناصر، الورقة المنزلقة، الإشعارات، الاهتزاز، النوافذ
import { icon, badge } from './icons.js';
import { MONTHS, WEEK_SHORT, WEEK_START, iso, parseISO, calendarToday, addMonths, monthLabel } from './dates.js';

export { icon, badge };

function appendAll(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let value;
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') value = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sv == null) continue;
          if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
        }
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  appendAll(el, children);
  // خانات الأرقام: كروم بيعرضها بأرقام هندية حسب لغة الصفحة، منوحّدها مع باقي التطبيق
  if (tag === 'input' && el.type === 'number') {
    // كروم بيعرض خانة الرقم بأرقام هندية حسب لغة الجهاز: منخليها نص بلوحة أرقام، ومنحوّل أي رقم هندي ينكتب
    el.type = 'text';
    el.classList.add('num-input');
    if (!el.hasAttribute('inputmode')) el.setAttribute('inputmode', 'decimal');
    el.setAttribute('autocomplete', 'off');
    el.addEventListener('input', () => {
      const v = el.value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/[٫,]/g, '.').replace(/[^\d.\-]/g, '');
      if (v !== el.value) el.value = v;
    }, true);
  }
  if (value != null) el.value = value;
  return el;
}

export function fill(el, items) {
  el.replaceChildren();
  appendAll(el, items);
}

export function haptic(kind = 'tap') {
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const pattern = { tap: 6, select: 10, success: [12, 40, 12], warn: [20, 40, 20], done: [8, 30, 18] }[kind] || 8;
    navigator.vibrate?.(pattern);
  } catch { /* */ }
}

/* ---------- الورقة المنزلقة: زر الرجوع بيسكّرها، والسحب لتحت كمان ---------- */
const stack = [];
window.addEventListener('popstate', () => {
  const top = stack.pop();
  if (top) top.destroy();
});
export const sheetOpen = () => stack.length > 0;
export function closeAllSheets() { while (stack.length) history.back(); }

export function openSheet(title, build, { onClose, tall = false, full = false, cls = '' } = {}) {
  // ما منفتح نافذتين فوق بعض إلا إذا التانية انطلبت من جوّا الأولى (متل اختيار تاريخ من نافذة مهمة).
  // ضغطة جاية من الصفحة اللي ورا (أو ضغطتين ورا بعض) بتسكّر القديمة وبتحط الجديدة مكانها.
  const ev = window.event;
  const path = ev?.composedPath?.() || [];
  const fromSheet = path.some((n) => n?.classList?.contains('sheet')) || Boolean(ev?.target?.closest?.('.sheet'));
  let reuseState = false;
  if (stack.length && !fromSheet) {
    while (stack.length) stack.pop().destroy();
    reuseState = true;
  }
  const titleId = `sheet-${Math.random().toString(36).slice(2, 8)}`;
  const body = h('div', { class: 'sheet-body' });
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const head = title === null ? null : h('div', { class: 'sheet-head' },
    h('h2', { id: titleId }, title),
    h('button', { class: 'icon-btn ghost', type: 'button', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 20)));
  const grip = h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }, h('span'));
  const panel = h('div', { class: `sheet${tall ? ' tall' : ''}${full ? ' full' : ''} ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': head ? titleId : null }, grip, head, body);
  const prevFocus = document.activeElement;

  const entry = {
    destroy() {
      panel.classList.remove('open');
      panel.style.transform = '';
      backdrop.classList.remove('open');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => { panel.remove(); backdrop.remove(); }, 260);
      if (!stack.length) document.body.classList.remove('sheet-lock');
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      onClose?.();
    },
  };
  function close() { if (stack[stack.length - 1] === entry) history.back(); }
  function onKey(e) { if (e.key === 'Escape' && stack[stack.length - 1] === entry) close(); }

  let startY = null, lastY = 0, lastT = 0, velocity = 0;
  const onDown = (e) => {
    if (e.target.closest('button, input, select, textarea')) return;
    startY = e.clientY; lastY = e.clientY; lastT = performance.now();
    panel.classList.add('dragging');
    try { panel.setPointerCapture?.(e.pointerId); } catch { /* */ }
  };
  const onMove = (e) => {
    if (startY == null) return;
    const dy = Math.max(0, e.clientY - startY);
    const now = performance.now();
    velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
    lastY = e.clientY; lastT = now;
    panel.style.transform = `translateY(${dy}px)`;
  };
  const onUp = (e) => {
    if (startY == null) return;
    const dy = Math.max(0, e.clientY - startY);
    startY = null;
    panel.classList.remove('dragging');
    if (dy > 120 || (dy > 40 && velocity > 0.6)) { haptic('tap'); close(); } else panel.style.transform = '';
  };
  for (const el of [grip, head].filter(Boolean)) el.addEventListener('pointerdown', onDown);
  panel.addEventListener('pointermove', onMove);
  panel.addEventListener('pointerup', onUp);
  panel.addEventListener('pointercancel', onUp);

  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  stack.push(entry);
  if (reuseState) history.replaceState({ sheet: stack.length }, ''); else history.pushState({ sheet: stack.length }, '');
  document.body.append(backdrop, panel);
  document.body.classList.add('sheet-lock');
  build(body, close, { panel, setTitle: (t) => { const el = panel.querySelector('.sheet-head h2'); if (el) el.textContent = t; } });
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    panel.classList.add('open');
    panel.querySelector('[data-autofocus]')?.focus();
  });
  return close;
}

export function confirmSheet(title, message, okLabel = 'تأكيد', { danger = true } = {}) {
  return new Promise((resolve) => {
    let result = false;
    openSheet(title, (body, close) => {
      body.append(
        h('p', { class: 'confirm-msg' }, message),
        h('div', { class: 'two' },
          h('button', { class: 'btn secondary', type: 'button', onclick: () => close() }, 'إلغاء'),
          h('button', { class: danger ? 'btn danger-solid' : 'btn', type: 'button', onclick: () => { result = true; close(); } }, okLabel)));
    }, { onClose: () => resolve(result) });
  });
}

// قائمة إجراءات قصيرة (بدل الضغط المطوّل)
export function openActions(title, actions) {
  openSheet(title, (body, close) => {
    fill(body, [h('div', { class: 'rows sheet-rows' }, actions.filter(Boolean).map((a) => h('button', {
      class: `row${a.danger ? ' danger-row-l' : ''}`, type: 'button',
      onclick: () => { haptic('select'); close(); setTimeout(() => a.run(), 120); },
    }, a.icon ? h('span', { class: 'row-ic' }, icon(a.icon, 20)) : null,
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, a.label), a.sub ? h('span', { class: 'row-sub' }, a.sub) : null))))]);
  });
}

let toastTimer = 0;
export function toast(message, { action, onAction, duration = 3500, kind = 'ok' } = {}) {
  const root = document.getElementById('toast-root');
  clearTimeout(toastTimer);
  const el = h('div', { class: `toast ${kind}`, role: 'status' },
    h('span', { class: 'toast-ic' }, icon(kind === 'warn' ? 'alert' : kind === 'gold' ? 'star' : 'check', 16)),
    h('span', { class: 'toast-msg' }, message),
    action ? h('button', { type: 'button', onclick: () => { hide(); onAction?.(); } }, action) : null);
  function hide() { el.classList.remove('show'); setTimeout(() => el.remove(), 200); }
  root.replaceChildren(el);
  requestAnimationFrame(() => el.classList.add('show'));
  if (duration) toastTimer = setTimeout(hide, duration);
}

export function field(label, control, hint) {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    control,
    hint ? h('span', { class: 'field-hint' }, hint) : null);
}

export function segmented(options, value, onChange, label) {
  return h('div', { class: 'seg', role: 'group', 'aria-label': label },
    options.map((o) => h('button', {
      type: 'button', 'aria-pressed': String(o.value === value),
      onclick: () => { if (o.value !== value) haptic('select'); onChange(o.value); },
    }, o.icon ? icon(o.icon, 16) : null, o.label)));
}

export function chips(options, value, onChange, { multi = false } = {}) {
  return h('div', { class: 'chips' }, options.map((o) => {
    const on = multi ? (value || []).includes(o.value) : o.value === value;
    return h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(on), style: o.tint ? { '--tint': o.tint } : null,
      onclick: () => { haptic('select'); onChange(o.value); },
    }, o.icon ? icon(o.icon, 15) : null, o.label);
  }));
}

export function toggleRow({ title, sub, checked, onChange, ic }) {
  return h('label', { class: 'switch-row' },
    ic ? h('span', { class: 'row-ic' }, icon(ic, 20)) : null,
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, title), sub ? h('span', { class: 'row-sub wrap' }, sub) : null),
    h('span', { class: 'switch' },
      h('input', { type: 'checkbox', checked: checked ? true : null, onchange: (e) => { haptic('select'); onChange(e.target.checked); } }),
      h('i')));
}

export function stepper(value, onChange, { min = 0, max = 9999, step = 1, suffix = '' } = {}) {
  const out = h('b', { class: 'stepper-val' }, `${value}${suffix}`);
  let v = value;
  const set = (n) => { v = Math.max(min, Math.min(max, n)); out.textContent = `${v}${suffix}`; onChange(v); };
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'إنقاص', onclick: () => { haptic('tap'); set(v - step); } }, icon('minus', 18)),
    out,
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'زيادة', onclick: () => { haptic('tap'); set(v + step); } }, icon('plus', 18)));
}

// حلقة تقدّم صغيرة (SVG)
export function ring(pct, size = 44, { stroke = 4, color = 'var(--accent)', track = 'rgba(255,255,255,0.08)', label } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  const wrap = h('span', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } });
  wrap.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)"/></svg>`;
  if (label != null) wrap.append(h('span', { class: 'ring-label' }, label));
  return wrap;
}

export function bar(pct, { cls = '', color } = {}) {
  return h('span', { class: `bar ${cls}` }, h('i', { style: { width: `${Math.round(Math.max(0, Math.min(1, pct || 0)) * 100)}%`, background: color || null } }));
}

export function empty(ic, text, action) {
  return h('div', { class: 'empty' }, badge(ic, 'slate', 48), h('p', null, text), action || null);
}

/* ---------- نوافذ اختيار من ثيم التطبيق ---------- */
export function openPicker({ title, options, value, onPick }) {
  openSheet(title, (body, close) => {
    fill(body, [h('div', { class: 'rows sheet-rows pick-list' }, options.map((o) => h('button', {
      class: 'row', type: 'button', 'aria-pressed': String(o.value === value),
      onclick: () => { haptic('select'); onPick(o.value); close(); },
    },
    o.icon ? badge(o.icon, o.tint || 'slate', 36, o.image) : null,
    h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, o.label), o.sub ? h('span', { class: 'row-sub' }, o.sub) : null),
    o.value === value ? h('span', { class: 'pick-check' }, icon('check', 20, { stroke: 2.2 })) : null)))]);
  });
}

export function selectButton({ value, options, onChange, title, placeholder = 'اختار', ic }) {
  const current = options.find((o) => o.value === value);
  return h('button', { type: 'button', class: 'select-btn', onclick: () => openPicker({ title, options, value, onPick: onChange }) },
    current?.icon ? badge(current.icon, current.tint || 'slate', 26, current.image) : (ic ? icon(ic, 18) : null),
    h('span', { class: current ? 'sb-val' : 'sb-val ph' }, current ? current.label : placeholder),
    icon('chevD', 18));
}

const WEEK_ORDER = Array.from({ length: 7 }, (_, i) => (WEEK_START + i) % 7);

// تقويم: اختيار يوم
export function openDatePicker({ value, onPick, title = 'التاريخ', today = calendarToday(), allowEmpty = false, emptyLabel = 'بلا تاريخ', marks = null }) {
  let shown = (value || today).slice(0, 7);
  openSheet(title, (body, close) => {
    const pick = (d) => { haptic('select'); onPick(d); close(); };
    const plus = (n) => { const x = parseISO(today); x.setDate(x.getDate() + n); return iso(x); };
    const chip = (label, d) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(value === d), onclick: () => pick(d) }, label);
    function render() {
      const [y, m] = shown.split('-').map(Number);
      const first = new Date(y, m - 1, 1);
      const offset = (first.getDay() - WEEK_START + 7) % 7;
      const dim = new Date(y, m, 0).getDate();
      const cells = [];
      for (let i = 0; i < offset; i++) cells.push(h('span'));
      for (let d = 1; d <= dim; d++) {
        const ds = iso(new Date(y, m - 1, d));
        const mk = marks ? marks(ds) : null;
        cells.push(h('button', {
          type: 'button', class: `cal-day${ds === value ? ' on' : ''}${ds === today ? ' today' : ''}${mk ? ` ${mk}` : ''}`,
          onclick: () => pick(ds),
        }, String(d)));
      }
      fill(body, [
        h('div', { class: 'chips', style: { marginBottom: '14px' } }, [chip('اليوم', today), chip('بكرة', plus(1)), chip('بعد بكرة', plus(2)), chip('بعد أسبوع', plus(7))]),
        h('div', { class: 'cal-nav' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الشهر السابق', onclick: () => { shown = addMonths(shown, -1); render(); } }, icon('chevR', 20)),
          h('strong', null, monthLabel(shown)),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'الشهر التالي', onclick: () => { shown = addMonths(shown, 1); render(); } }, icon('chevL', 20))),
        h('div', { class: 'cal-grid cal-week' }, WEEK_ORDER.map((w) => h('span', null, WEEK_SHORT[w]))),
        h('div', { class: 'cal-grid' }, cells),
        allowEmpty ? h('button', { type: 'button', class: 'btn secondary block', style: { marginTop: '14px' }, onclick: () => pick(null) }, emptyLabel) : null,
      ]);
    }
    render();
  });
}

// اختيار وقت بساعة ودقيقة كبيرة
export function openTimePicker({ value, onPick, title = 'الوقت', allowEmpty = true }) {
  let [hh, mm] = (value || '09:00').split(':').map(Number);
  openSheet(title, (body, close) => {
    const disp = h('div', { class: 'tp-disp' });
    const pad = (n) => String(n).padStart(2, '0');
    const draw = () => {
      const s = hh < 12 ? 'ص' : 'م';
      disp.textContent = `${hh % 12 === 0 ? 12 : hh % 12}:${pad(mm)} ${s}`;
    };
    const col = (label, get, set, step, max) => h('div', { class: 'tp-col' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `زيادة ${label}`, onclick: () => { set((get() + step) % max); draw(); haptic('tap'); } }, icon('chevU', 22)),
      h('small', null, label),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `إنقاص ${label}`, onclick: () => { set((get() - step + max) % max); draw(); haptic('tap'); } }, icon('chevD', 22)));
    const quick = [['6:00 ص', '06:00'], ['8:00 ص', '08:00'], ['10:00 ص', '10:00'], ['12:00 م', '12:00'], ['2:00 م', '14:00'], ['4:00 م', '16:00'], ['6:00 م', '18:00'], ['8:00 م', '20:00'], ['10:00 م', '22:00']];
    draw();
    fill(body, [
      h('div', { class: 'tp-wrap' },
        col('الساعة', () => hh, (v) => { hh = v; }, 1, 24),
        disp,
        col('الدقيقة', () => mm, (v) => { mm = v; }, 5, 60)),
      h('div', { class: 'chips', style: { justifyContent: 'center', margin: '6px 0 14px' } }, quick.map(([l, v]) => h('button', { type: 'button', class: 'chip', onclick: () => { [hh, mm] = v.split(':').map(Number); draw(); } }, l))),
      h('div', { class: 'two' },
        allowEmpty ? h('button', { type: 'button', class: 'btn secondary', onclick: () => { onPick(null); close(); } }, 'بلا وقت') : h('span'),
        h('button', { type: 'button', class: 'btn', onclick: () => { onPick(`${pad(hh)}:${pad(mm)}`); close(); } }, 'تم')),
    ]);
  });
}

export function openMonthPicker({ value, onPick, title = 'الشهر' }) {
  let year = Number((value || calendarToday()).slice(0, 4));
  openSheet(title, (body, close) => {
    function render() {
      fill(body, [
        h('div', { class: 'cal-nav' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'السنة السابقة', onclick: () => { year -= 1; render(); } }, icon('chevR', 20)),
          h('strong', null, String(year)),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'السنة التالية', onclick: () => { year += 1; render(); } }, icon('chevL', 20))),
        h('div', { class: 'month-grid' }, MONTHS.map((name, i) => {
          const v = `${year}-${String(i + 1).padStart(2, '0')}`;
          return h('button', { type: 'button', class: `month-cell${v === value ? ' on' : ''}`, onclick: () => { haptic('select'); onPick(v); close(); } }, name);
        })),
      ]);
    }
    render();
  });
}

// الصور القديمة الصغيرة (أقل من 400 بكسل) بالأغلفة الكبيرة: بدل ما تنمطّ وتطلع مغبّشة،
// منعرضها بحجم بيناسب دقّتها فوق نسخة مغبّشة منها كخلفية
document.addEventListener('load', (e) => {
  const im = e.target;
  if (!(im instanceof HTMLImageElement)) return;
  const box = im.parentElement;
  if (!box?.matches?.('.ic-cov, .xm-cover')) return;
  const need = Math.max(im.clientWidth, im.clientHeight) * (window.devicePixelRatio || 1);
  if (im.naturalWidth && im.naturalWidth < 400 && need > im.naturalWidth * 1.25) {
    box.classList.add('lr');
    box.style.setProperty('--lr', `url("${im.currentSrc || im.src}")`);
  }
}, true);
// صورة قديمة دقّتها قليلة (أقل من 400 بكسل)؟ منحط عليها علامة صغيرة حتى تبدّلها
export function lowResCheck(e) {
  const im = e.currentTarget, box = im?.parentElement;
  if (!box || !im.naturalWidth || im.naturalWidth >= 400 || box.querySelector('.lowres-tag')) return;
  box.classList.add('has-lowres');
  box.append(h('span', { class: 'lowres-tag' }, 'دقّة قليلة'));
}
// اختيار صورة وتصغيرها (مربعة). 720 بكسل: بتطلع واضحة حتى بالبطاقات الكبيرة على شاشات الموبايل
export const IMG_SIZE = 720;
export function pickImage({ size = IMG_SIZE, square = true } = {}) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    inp.addEventListener('change', () => {
      const f = inp.files?.[0];
      inp.remove();
      if (!f) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          const g = cv.getContext('2d');
          g.imageSmoothingQuality = 'high';
          if (square) {
            const s = Math.min(img.width, img.height);
            const out = Math.min(size, s);   // ما منكبّر صورة صغيرة أصلاً
            cv.width = out; cv.height = out;
            g.imageSmoothingQuality = 'high';
            g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, out, out);
          } else {
            const k = Math.min(1, size / Math.max(img.width, img.height));
            cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
            g.imageSmoothingQuality = 'high';
            g.drawImage(img, 0, 0, cv.width, cv.height);
          }
          resolve(cv.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = () => resolve(null);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(f);
    });
    document.body.append(inp);
    inp.click();
  });
}

/* ---------- ترتيب قائمة: اسحب من المقبض (⋮⋮) أو استعمل الأسهم، وبعدين «احفظ» ---------- */
// items: [{ id, label, sub, image, icon, color }] — onSave(ids بالترتيب الجديد)
export function openReorder(title, items, onSave) {
  let order = items.map((x) => x.id);
  const byId = new Map(items.map((x) => [x.id, x]));
  openSheet(title, (body, close) => {
    const list = h('div', { class: 'ro-list' });
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; haptic('select'); draw(); };
    function row(id, i) {
      const x = byId.get(id);
      const el = h('div', { class: 'ro-row', 'data-id': id, style: { '--c': x.color || 'var(--accent)' } },
        h('span', { class: 'ro-grip', 'aria-label': 'اسحب لترتّب' }, icon('grip-vertical', 15)),
        h('span', { class: 'ro-num num' }, String(i + 1)),
        x.image ? h('img', { class: 'ro-img', src: x.image, alt: '', loading: 'lazy' }) : h('span', { class: 'ro-ic' }, icon(x.icon || 'grad', 15)),
        h('span', { class: 'ro-main' }, h('b', null, x.label), x.sub ? h('small', null, x.sub) : null),
        h('span', { class: 'ro-arrows' },
          h('button', { type: 'button', 'aria-label': 'لفوق', disabled: i === 0 ? true : null, onclick: () => move(i, -1) }, icon('chevron-up', 12)),
          h('button', { type: 'button', 'aria-label': 'لتحت', disabled: i === order.length - 1 ? true : null, onclick: () => move(i, 1) }, icon('chevron-down', 12))));
      // السحب: بتمسك المقبض وبتطلّع/بتنزّل، والباقي بيفسحلك محل
      el.querySelector('.ro-grip').addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const rows = [...list.children];
        const h0 = el.getBoundingClientRect().height + 6;
        const from = rows.indexOf(el);
        let to = from;
        const y0 = e.clientY;
        el.classList.add('dragging');
        try { el.setPointerCapture(e.pointerId); } catch { /* */ }
        const onMove = (ev) => {
          const dy = ev.clientY - y0;
          el.style.transform = `translateY(${dy}px)`;
          to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h0)));
          rows.forEach((r, k) => {
            if (r === el) return;
            const shift = from < to ? (k > from && k <= to ? -h0 : 0) : (k < from && k >= to ? h0 : 0);
            r.style.transform = shift ? `translateY(${shift}px)` : '';
          });
        };
        const onUp = () => {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
          if (to !== from) { const [m] = order.splice(from, 1); order.splice(to, 0, m); haptic('select'); }
          draw();
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
      });
      return el;
    }
    function draw() { fill(list, order.map(row)); }
    draw();
    fill(body, [
      h('p', { class: 'hint' }, 'اسحب من المقبض لفوق أو لتحت، أو استعمل الأسهم.'),
      list,
      h('div', { class: 'two', style: { marginTop: '12px' } },
        h('button', { type: 'button', class: 'btn', onclick: () => { onSave(order.slice()); close(); toast('انحفظ الترتيب'); } }, icon('check', 15), 'احفظ الترتيب'),
        h('button', { type: 'button', class: 'btn secondary', onclick: () => close() }, 'إلغاء')),
    ]);
  }, { tall: true });
}

/* ---------- السحب يمين/يسار على بطاقة (لإنجاز أو تأجيل) ---------- */
export function swipeable(el, { onLeft, onRight, leftLabel, rightLabel } = {}) {
  let x0 = null, y0 = 0, dx = 0, active = false, width = 1;
  el.classList.add('swipe');
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, a')) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; active = false; width = el.offsetWidth || 1;
  });
  el.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!active) {
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) { x0 = null; return; }
      if (Math.abs(mx) < 14 || Math.abs(mx) < Math.abs(my) * 1.4) return;
      if ((mx > 0 && !onRight) || (mx < 0 && !onLeft)) return;
      active = true;
      try { el.setPointerCapture?.(e.pointerId); } catch { /* */ }
      el.classList.add('swiping');
    }
    dx = mx;
    el.style.transform = `translate3d(${dx}px, 0, 0)`;
    el.dataset.dir = dx > 0 ? 'right' : 'left';
    el.classList.toggle('swipe-armed', Math.abs(dx) > width * 0.33);
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    if (!active) return;
    el.classList.remove('swiping', 'swipe-armed');
    // السحب مش ضغطة: منسكّر أي «click» بيجي بعده مباشرة حتى ما تنفتح نافذة المهمة
    el.dataset.swipedAt = String(Date.now());
    active = false;
    if (Math.abs(dx) > width * 0.33) {
      haptic('done');
      const fn = dx > 0 ? onRight : onLeft;
      el.style.transform = '';
      fn?.();
    } else el.style.transform = '';
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', (e) => {
    if (Date.now() - Number(el.dataset.swipedAt || 0) < 500) { e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault(); }
  }, true);
  return el;
}

export function debounce(fn, ms = 250) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
