// استوديو التركيز — نفس شاشة النسخة الأولى: ساعة بتقلب أرقامها، بومودورو تركيز/استراحة،
// وضع انغماس بيكبّر الساعة، وبيدور مع ميلان التلفون حتى لو قفل الدوران شغّال.
import { h, icon, fill, openSheet, toast, haptic, pickImage } from '../ui.js';
import { store } from '../store.js';
import { durText } from '../dates.js';
import { logicalToday } from '../prayer.js';
import { award, POINTS } from '../rewards.js';
import { tintHex } from '../icons.js';

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* */ }
}
const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
const hms = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const arNum = (n) => Number(n).toLocaleString('ar-EG');

function rgbOf(hex) {
  let x = String(hex || '#4a9ee0').replace('#', '');
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  const n = parseInt(x, 16);
  return Number.isNaN(n) ? [74, 158, 224] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// بطاقة رقم واحدة بتنقلب: اللسان العلوي بيغطّي الرقم الحالي، منكتب الجديد تحته وبعدين منطويه
function flipCard() {
  const face = (cls) => h('div', { class: cls }, h('i', null, '00'));
  const el = h('div', { class: 'flip' }, face('flip-face flip-upper'), face('flip-face flip-lower'), face('flip-flap flip-flap-upper'), face('flip-flap flip-flap-lower'));
  el.set = (val) => {
    const cur = el.dataset.val;
    if (cur === val) return;
    const [up, low, fu, fl] = [...el.querySelectorAll('i')];
    if (cur == null) { up.textContent = low.textContent = fu.textContent = fl.textContent = val; el.dataset.val = val; return; }
    if (el._t) { clearTimeout(el._t); el._t = null; low.textContent = cur; fu.textContent = cur; el.classList.remove('flipping'); void el.offsetWidth; }
    fl.textContent = val; up.textContent = val; el.dataset.val = val;
    el.classList.add('flipping');
    el._t = setTimeout(() => { low.textContent = val; fu.textContent = val; el.classList.remove('flipping'); el._t = null; }, 540);
  };
  return el;
}

// opts: { title, cat, color, image, masteryLine, notes, onNotes(text), shots, onShots(arr), spent (ثواني سابقة),
//         mode: 'pomo' | 'read', readMinutes, doneLabel, finishOptions: [{label, sub, value}], onFinish(sec, value),
//         onEdit(), onDelete(), ref, onClose(sec) }
export function openFocus(opts) {
  const reading = opts.mode === 'read' || opts.mode === 'open';
  opts.cat = opts.cat || opts.sub;
  let focusMin = reading ? (opts.readMinutes || 20) : (Number(localStorage.getItem('manz:focusMin')) || 25);
  let breakMin = Number(localStorage.getItem('manz:breakMin')) || 5;
  let phase = 'focus', running = false, locked = false, immersive = false;
  let left = focusMin * 60, elapsed = 0, sessionTotal = 0, timer = 0, last = 0, dimT = 0;
  const day = logicalToday();
  const baseSpent = Math.round(opts.spent || 0);
  let shots = [...(opts.shots || [])];
  const [r, g, b] = rgbOf(tintHex(opts.color || 'sky'));
  const on = (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#0a0a0e' : '#ffffff';

  openSheet(null, (body, close, { panel }) => {
    const root = h('div', { class: 'focus-studio' });
    root.style.setProperty('--fs-accent', `rgb(${r},${g},${b})`);
    root.style.setProperty('--fs-rgb', `${r},${g},${b}`);
    root.style.setProperty('--fs-on', on);
    if (reading) root.classList.add('is-reading');

    const mm = flipCard(), ss = flipCard();
    const clock = h('div', { class: 'flip-clock' }, mm, h('div', { class: 'flip-sep' }, h('span'), h('span')), ss);
    const modeFocus = h('span', { class: 'fs-mode active' }, reading ? 'قراءة' : 'تركيز');
    const modeBreak = h('span', { class: 'fs-mode' }, 'استراحة');
    const playBtn = h('button', { type: 'button', class: 'fs-cbtn primary', 'aria-label': 'تشغيل', onclick: () => toggle() }, icon('play', 26));
    const expandBtn = h('button', { type: 'button', class: 'fs-cbtn', 'aria-label': 'ملء الشاشة', onclick: () => setImmersive(!immersive) }, icon('expand', 22));
    const rotateBtn = h('button', { type: 'button', class: 'fs-cbtn fs-rotate', 'aria-label': 'تدوير الشاشة', onclick: () => setRot(rot === 'none' ? 'left' : 'none') }, icon('rotate', 22));
    const spentEl = h('b', { class: 'num' }, hms(baseSpent));
    const focusVal = h('span', { class: 'fs-dial-val' }, String(focusMin));
    const breakVal = h('span', { class: 'fs-dial-val' }, String(breakMin));
    const lockLbl = h('span');
    const shotsEl = h('div', { class: 'fs-shots' });

    const dial = (label, valEl, step, max, get, set) => h('div', { class: 'fs-dial' },
      h('label', null, label),
      h('div', { class: 'fs-dial-row' },
        h('button', { type: 'button', class: 'fs-dial-btn', onclick: () => { set(Math.max(1, get() - step)); } }, '−'),
        valEl,
        h('button', { type: 'button', class: 'fs-dial-btn', onclick: () => { set(Math.min(max, get() + step)); } }, '+')));

    function drawClock() {
      mm.set(pad(Math.floor(left / 60)));
      ss.set(pad(left % 60));
    }
    function drawLock() {
      root.classList.toggle('timer-locked', locked);
      lockLbl.textContent = reading ? `${arNum(focusMin)} دقيقة قراءة` : `${arNum(focusMin)} / ${arNum(breakMin)} دقيقة`;
    }
    function setFocusMin(v) {
      focusMin = v; focusVal.textContent = String(v);
      if (!reading) localStorage.setItem('manz:focusMin', v);
      if (phase === 'focus' && !running) { left = v * 60; drawClock(); }
      drawLock();
    }
    function setBreakMin(v) {
      breakMin = v; breakVal.textContent = String(v); localStorage.setItem('manz:breakMin', v);
      if (phase === 'break' && !running) { left = v * 60; drawClock(); }
      drawLock();
    }
    function setPhase(p) {
      phase = p;
      modeFocus.classList.toggle('active', p === 'focus');
      modeBreak.classList.toggle('active', p === 'break');
      left = (p === 'focus' ? focusMin : breakMin) * 60;
      drawClock();
    }
    function tick() {
      const now = Date.now();
      const dt = Math.floor((now - last) / 1000);
      if (dt < 1) return;
      last += dt * 1000;
      if (phase === 'focus') { elapsed += dt; sessionTotal += dt; spentEl.textContent = hms(baseSpent + sessionTotal); }
      left -= dt;
      if (left <= 0) {
        haptic('success');
        try { navigator.vibrate?.([200, 100, 200]); } catch { /* */ }
        if (reading) { left = 0; drawClock(); pause(); toast('خلص وقت القراءة', { kind: 'gold' }); return; }
        if (phase === 'focus') { setPhase('break'); toast('خلص وقت التركيز — استراحة', { kind: 'gold' }); }
        else { setPhase('focus'); toast('رجعنا للتركيز'); }
      }
      drawClock();
    }
    function pause() {
      running = false; clearInterval(timer); keepAwake(false);
      fill(playBtn, [icon('play', 26)]);
    }
    function toggle() {
      haptic('select');
      if (running) { pause(); return; }
      running = true; locked = true; drawLock();
      last = Date.now(); timer = setInterval(tick, 250); keepAwake(true);
      fill(playBtn, [icon('pause', 26)]);
    }
    function reset() { pause(); setPhase('focus'); }

    // ---- الانغماس والدوران ----
    let rot = 'none', gotSignal = false, probe = 0;
    const syncLandscape = () => root.classList.toggle('is-landscape', window.innerWidth > window.innerHeight || rot !== 'none');
    function setRot(v) {
      rot = v;
      root.classList.remove('rot-left', 'rot-right');
      if (v === 'left') root.classList.add('rot-left'); else if (v === 'right') root.classList.add('rot-right');
      syncLandscape();
    }
    function decide(v) { if (!immersive) return; if (window.innerWidth > window.innerHeight) { if (rot !== 'none') setRot('none'); return; } if (v !== rot) setRot(v); }
    const alive = () => { if (gotSignal) return; gotSignal = true; clearTimeout(probe); root.classList.remove('no-sensor'); };
    const onOrient = (e) => {
      if (e.gamma == null) return; alive();
      const gm = e.gamma, bt = e.beta ?? 0; let v = rot;
      if (Math.abs(bt) < 58) { if (gm > 40) v = 'left'; else if (gm < -40) v = 'right'; else if (Math.abs(gm) < 24) v = 'none'; } else if (Math.abs(bt) > 72) v = 'none';
      decide(v);
    };
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity; if (!a || a.x == null) return; alive();
      const ax = a.x, ay = a.y ?? 0; let v = rot;
      if (ax < -5.5 && Math.abs(ay) < 5.5) v = 'left'; else if (ax > 5.5 && Math.abs(ay) < 5.5) v = 'right'; else if (Math.abs(ax) < 3.5) v = 'none';
      decide(v);
    };
    function watch(onOff) {
      if (onOff) {
        gotSignal = false;
        window.addEventListener('deviceorientation', onOrient, true);
        window.addEventListener('devicemotion', onMotion, true);
        clearTimeout(probe); probe = setTimeout(() => { if (!gotSignal) root.classList.add('no-sensor'); }, 1600);
      } else {
        window.removeEventListener('deviceorientation', onOrient, true);
        window.removeEventListener('devicemotion', onMotion, true);
        clearTimeout(probe); root.classList.remove('no-sensor'); setRot('none');
      }
    }
    const wake = () => { root.classList.remove('controls-dim'); clearTimeout(dimT); if (immersive) dimT = setTimeout(() => root.classList.add('controls-dim'), 3500); };
    function setImmersive(v) {
      immersive = v;
      root.classList.toggle('is-immersive', v);
      fill(expandBtn, [icon(v ? 'compress' : 'expand', 22)]);
      watch(v); wake();
      try { if (v) document.documentElement.requestFullscreen?.().catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch { /* */ }
    }
    root.addEventListener('pointerdown', wake);
    window.addEventListener('resize', syncLandscape);

    // ---- اللقطات ----
    function drawShots() {
      shotsEl.style.display = shots.length ? 'flex' : 'none';
      fill(shotsEl, shots.map((src, i) => h('button', { type: 'button', class: 'fs-shot-thumb', onclick: () => viewShot(i) }, h('img', { src, alt: '' }))));
    }
    function viewShot(i) {
      openSheet(`لقطة ${arNum(i + 1)} من ${arNum(shots.length)}`, (bd, cl) => {
        fill(bd, [h('img', { src: shots[i], alt: '', style: { width: '100%', borderRadius: '16px', display: 'block' } }),
          h('button', { type: 'button', class: 'btn danger block', onclick: () => { shots.splice(i, 1); opts.onShots?.(shots); drawShots(); cl(); } }, icon('trash', 16), 'احذف اللقطة')]);
      });
    }
    async function addShot() {
      const src = await pickImage({ size: 1280, square: false }).catch(() => null);
      if (!src) return;
      shots.push(src); opts.onShots?.(shots); drawShots(); toast('انحفظت اللقطة');
    }

    function logTime() {
      if (elapsed >= 60) {
        store.update((s) => { s.focusLog.push({ d: day, sec: elapsed, title: opts.title, ref: opts.ref || null }); }, { silent: true });
        if (elapsed >= 20 * 60) award(`focus:${day}:${Date.now()}`, POINTS.focus, 'جلسة تركيز', day);
      }
    }
    function finish() {
      pause();
      const sec = elapsed;
      logTime(); elapsed = 0;
      if (opts.finishOptions?.length) {
        openSheet(opts.finishTitle || 'شو عملت؟', (bd, cl) => {
          fill(bd, [
            sec >= 60 ? h('p', { class: 'hint' }, `ركّزت ${durText(sec / 60)} بهالجلسة.`) : null,
            h('div', { class: 'act-list' }, opts.finishOptions.map((o) => h('button', { type: 'button', class: 'act-btn', onclick: () => { cl(); setTimeout(() => { opts.onFinish?.(sec, o.value); close(); }, 230); } },
              icon(o.icon || 'check', 16), h('span', null, o.label, o.sub ? h('small', null, o.sub) : null)))),
          ]);
        });
      } else { opts.onFinish?.(sec, null); close(); }
    }

    const notes = h('textarea', { placeholder: 'اكتب ما تريد تذكّره...', oninput: (e) => opts.onNotes?.(e.target.value) }, opts.notes || '');
    root.append(
      h('div', { class: 'fs-topbar' },
        h('button', { type: 'button', class: 'fs-icon-btn', 'aria-label': 'عودة', onclick: () => close() }, icon('arrowR', 16)),
        opts.cat ? h('span', { class: 'fs-cat' }, opts.cat) : h('span')),
      h('div', { class: 'fs-body' },
        h('div', { class: 'fs-head' },
          opts.image ? h('img', { class: 'fs-avatar', src: opts.image, alt: '' }) : null,
          h('div', null, h('h1', null, opts.title || 'جلسة تركيز'), opts.masteryLine ? h('div', { class: 'fs-mastery' }, opts.masteryLine) : null)),
        h('div', { class: 'fs-timer' },
          h('div', { class: 'fs-modes' }, modeFocus, h('span', { class: 'dot' }), modeBreak),
          clock,
          h('div', { class: 'fs-controls' }, expandBtn, rotateBtn, playBtn,
            h('button', { type: 'button', class: 'fs-cbtn', 'aria-label': 'إعادة ضبط', onclick: () => reset() }, icon('undo', 20))),
          h('div', { class: 'fs-dials' },
            dial(reading ? 'مدة القراءة' : 'تركيز', focusVal, 5, 120, () => focusMin, setFocusMin),
            dial('استراحة', breakVal, 1, 60, () => breakMin, setBreakMin)),
          h('button', { type: 'button', class: 'fs-edit-timer', onclick: () => { locked = false; drawLock(); } }, icon('sliders', 14), lockLbl, ' — تعديل'),
          h('div', { class: 'fs-spent' }, 'الوقت الفعلي على المهمة ', spentEl)),
        h('div', { class: 'fs-notes' },
          h('div', { class: 'fs-notes-head' }, h('span', null, 'ملاحظات'),
            opts.onShots ? h('button', { type: 'button', class: 'fs-icon-btn', 'aria-label': 'لقطة', onclick: addShot }, icon('camera', 16)) : null),
          notes, shotsEl)),
      h('div', { class: 'fs-actions' },
        h('button', { type: 'button', class: 'fs-done', onclick: finish }, icon('check', 16), opts.doneLabel || 'تم الإنجاز'),
        opts.onEdit ? h('button', { type: 'button', class: 'fs-side', onclick: () => { close(); setTimeout(() => opts.onEdit(), 260); } }, icon('pen', 14), 'تعديل') : null,
        opts.onDelete ? h('button', { type: 'button', class: 'fs-side icon-only danger', 'aria-label': 'حذف', onclick: () => { close(); setTimeout(() => opts.onDelete(), 260); } }, icon('trash', 15)) : null));
    body.append(root);
    panel.classList.add('studio-panel');
    drawClock(); drawLock(); drawShots();

    root._cleanup = () => {
      clearInterval(timer); keepAwake(false); watch(false);
      window.removeEventListener('resize', syncLandscape);
      try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); } catch { /* */ }
      logTime();
      opts.onClose?.(sessionTotal);
    };
    panel._studio = root;
  }, {
    full: true, cls: 'studio-sheet',
    onClose: () => { document.querySelector('.studio-sheet')?._studio?._cleanup?.(); },
  });
}
