// شاشة التركيز: مؤقّت بومودورو أو عدّاد مفتوح، مع ملاحظات، وبالآخر بتسجّل شو أنجزت
import { h, icon, ring, fill, openSheet, toast, haptic, segmented, badge } from '../ui.js';
import { store } from '../store.js';
import { clockText, durText } from '../dates.js';
import { logicalToday } from '../prayer.js';
import { award, POINTS } from '../rewards.js';

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* */ }
}

// opts: { title, sub, tint, image, icon, notes, onNotes(text), finishOptions: [{label, value}], onFinish(seconds, value) }
export function openFocus(opts) {
  let mode = opts.mode || 'pomo';
  let focusMin = Number(localStorage.getItem('manz:focusMin')) || 25;
  let breakMin = 5;
  let phase = 'focus';
  let running = false;
  let elapsed = 0; // ثواني التركيز الفعلي
  let phaseLeft = focusMin * 60;
  let timer = 0;
  let last = 0;
  const startedDay = logicalToday();
  openSheet(null, (body, close) => {
    const notes = h('textarea', { class: 'fx-notes', rows: 3, placeholder: 'ملاحظات وأنت عم تدرس…', oninput: (e) => opts.onNotes?.(e.target.value) }, opts.notes || '');
    const clock = h('div', { class: 'fx-clock num' });
    const ringWrap = h('div', { class: 'fx-ring' });
    const label = h('div', { class: 'fx-phase' });
    const playBtn = h('button', { type: 'button', class: 'fx-play', 'aria-label': 'ابدأ', onclick: () => toggle() });
    function draw() {
      const total = phase === 'focus' ? focusMin * 60 : breakMin * 60;
      if (mode === 'pomo') {
        clock.textContent = clockText(phaseLeft);
        fill(ringWrap, [ring(1 - phaseLeft / total, 230, { stroke: 7, color: phase === 'focus' ? (opts.color || 'var(--accent)') : 'var(--good)' })]);
        label.textContent = phase === 'focus' ? 'تركيز' : 'استراحة';
      } else {
        clock.textContent = clockText(elapsed);
        fill(ringWrap, [ring((elapsed % 3600) / 3600, 230, { stroke: 7, color: opts.color || 'var(--accent)' })]);
        label.textContent = 'وقت مفتوح';
      }
      fill(playBtn, [icon(running ? 'pause' : 'play', 30)]);
    }
    function tick() {
      const now = Date.now();
      const dt = Math.round((now - last) / 1000);
      if (dt < 1) return;
      last = now;
      if (phase === 'focus') elapsed += dt;
      if (mode === 'pomo') {
        phaseLeft -= dt;
        if (phaseLeft <= 0) {
          haptic('success');
          if (phase === 'focus') { phase = 'break'; phaseLeft = breakMin * 60; toast('خلص وقت التركيز — استراحة قصيرة', { kind: 'gold' }); }
          else { phase = 'focus'; phaseLeft = focusMin * 60; toast('رجعنا للتركيز'); }
        }
      }
      draw();
    }
    function toggle() {
      running = !running;
      haptic('select');
      if (running) { last = Date.now(); timer = setInterval(tick, 500); keepAwake(true); } else { clearInterval(timer); keepAwake(false); }
      draw();
    }
    function finish() {
      clearInterval(timer); running = false; keepAwake(false);
      const sec = elapsed;
      if (sec >= 60) {
        store.update((s) => { s.focusLog.push({ d: startedDay, sec, title: opts.title, ref: opts.ref || null }); }, { silent: true });
        if (sec >= 20 * 60) award(`focus:${startedDay}:${Date.now()}`, POINTS.focus, 'جلسة تركيز', startedDay);
      }
      if (opts.finishOptions?.length) {
        fill(body, [
          h('div', { class: 'fx-done' },
            badge('check', 'mint', 64),
            h('h3', null, sec >= 60 ? `ركّزت ${durText(sec / 60)}` : 'خلصت؟'),
            h('p', { class: 'muted' }, 'شو عملت بهالجلسة؟'),
            h('div', { class: 'rows sheet-rows', style: { width: '100%' } }, opts.finishOptions.map((o) => h('button', { type: 'button', class: 'row', onclick: () => { opts.onFinish?.(sec, o.value); close(); } }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, o.label), o.sub ? h('span', { class: 'row-sub' }, o.sub) : null), icon('chevL', 18)))),
            h('button', { type: 'button', class: 'btn secondary block', onclick: () => { opts.onFinish?.(sec, null); close(); } }, 'بس سجّل الوقت')),
        ]);
      } else { opts.onFinish?.(sec, null); close(); if (sec >= 60) toast(`سجّلنا ${durText(sec / 60)} تركيز`); }
    }
    function render() {
      fill(body, [
        h('div', { class: 'az-head' },
          h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'إغلاق', onclick: () => { if (elapsed >= 60) finish(); else close(); } }, icon('close', 22)),
          h('div', null, h('b', null, opts.title), opts.sub ? h('small', null, opts.sub) : null),
          opts.image ? badge('book', 'slate', 40, opts.image) : h('span', { style: { width: '42px' } })),
        h('div', { style: { padding: '6px 0 2px' } }, segmented([{ value: 'pomo', label: 'بومودورو' }, { value: 'open', label: 'وقت مفتوح' }], mode, (v) => { mode = v; draw(); render(); })),
        mode === 'pomo' && !running ? h('div', { class: 'chips', style: { justifyContent: 'center' } }, [15, 25, 45, 60, 90].map((m) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(focusMin === m), onclick: () => { focusMin = m; localStorage.setItem('manz:focusMin', m); if (phase === 'focus') phaseLeft = m * 60; draw(); render(); } }, `${m} د`))) : null,
        h('div', { class: 'fx-center' }, ringWrap, h('div', { class: 'fx-mid' }, label, clock, h('small', { class: 'muted num' }, `تركيز فعلي ${clockText(elapsed)}`))),
        h('div', { class: 'fx-controls' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'من الأول', onclick: () => { phase = 'focus'; phaseLeft = focusMin * 60; draw(); } }, icon('refresh', 20)),
          playBtn,
          h('button', { type: 'button', class: 'icon-btn accent', 'aria-label': 'خلصت', onclick: () => finish() }, icon('check', 22))),
        notes,
      ]);
      draw();
    }
    render();
  }, { full: true, cls: 'az-sheet', onClose: () => { clearInterval(timer); keepAwake(false); } });
}
