// وضع السرير: ساعة معتّمة، والشاشة بتضل شغّالة. على الوقت بيرنّ وما بيسكت إلا بحلّ المسائل
// (حتى زر الرجوع ما بيسكّته — النافذة بترجع تنفتح لحد ما تحلّ).
import { h, icon, fill, openSheet, toast, haptic } from '../ui.js';
import { logicalToday } from '../prayer.js';
import { parseISO, time12, calendarToday } from '../dates.js';
import { sleepTimes, CYCLE, sleepCfg, setWake } from '../sleep.js';
import { alarmCfg, mathProblem, startRinging, stopRinging, keepAwake } from '../alarm.js';

const pad = (n) => String(n).padStart(2, '0');
function alarmDate() {
  const d = logicalToday();
  const st = sleepTimes(d);
  const at = parseISO(d);
  at.setMinutes(st.wake);
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
  return at;
}

export function openBedside(state = null) {
  const a = alarmCfg();
  const s = state || { mode: 'sleep', solved: 0, prob: mathProblem(a.level), at: alarmDate().getTime() };
  const at = new Date(s.at);
  let ans = '';
  let tick = 0;
  let lastTap = 0;
  let leaving = false;
  let onCloseFn = null;
  openSheet(null, (body, close) => {
    keepAwake(true).then((ok) => { if (!ok && s.mode === 'sleep') toast('خلّي الشاشة شغّالة والجوال عالشاحن — جهازك ما سمح يثبّت الشاشة.', { kind: 'warn', duration: 7000 }); });
    const onVis = () => { if (document.visibilityState === 'visible' && s.mode !== 'done') keepAwake(true); };
    document.addEventListener('visibilitychange', onVis);
    const clockEl = h('div', { class: 'bs-tm num' });
    function drawClock() { const n = new Date(); clockEl.textContent = `${pad(n.getHours() % 12 || 12)}:${pad(n.getMinutes())}`; }
    function check() {
      if (s.mode === 'sleep' && Date.now() >= at.getTime()) { s.mode = 'ring'; startRinging({ gradual: a.gradual !== false, vibrate: a.vibrate !== false }); render(); return; }
      if (s.mode === 'sleep') drawClock();
    }
    tick = setInterval(check, 1000);
    function leave() {
      leaving = true;
      clearInterval(tick);
      stopRinging();
      keepAwake(false);
      document.removeEventListener('visibilitychange', onVis);
      close();
    }
    const cleanup = () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVis); };
    function press(k) {
      haptic('select');
      if (k === 'del') ans = ans.slice(0, -1);
      else if (k === 'ok') {
        if (Number(ans) === s.prob.a) {
          s.solved += 1; ans = '';
          if (s.solved >= (a.count || 3)) { s.mode = 'done'; stopRinging(); keepAwake(false); setWake(calendarToday(), true); render(); return; }
          s.prob = mathProblem(a.level);
        } else { ans = ''; toast('غلط — جرّب كمان', { kind: 'warn', duration: 1200 }); }
      } else if (ans.length < 5) ans += k;
      render();
    }
    function render() {
      if (s.mode === 'sleep') {
        const mins = Math.round((at.getTime() - Date.now()) / 60000);
        const k = Math.max(0, (mins - (sleepCfg().fallAsleep || 0)) / CYCLE);
        drawClock();
        fill(body, [h('div', {
          class: 'bs-sleep',
          onclick: () => { const t = Date.now(); if (t - lastTap < 450) leave(); lastTap = t; },
        },
        clockEl,
        h('small', null, `المنبه ${time12(`${pad(at.getHours())}:${pad(at.getMinutes())}`)} · ≈ ${k >= 1 ? `${Math.round(k * 10) / 10} دورات` : 'أقل من دورة'}`),
        h('small', { class: 'bs-tip' }, 'خلّي الجوال عالشاحن والتطبيق فاتح. اضغط مرتين لتلغي.'))]);
      } else if (s.mode === 'ring') {
        fill(body, [h('div', { class: 'bs-ring' },
          h('div', { class: 'bs-rt num' }, `${pad(at.getHours() % 12 || 12)}:${pad(at.getMinutes())}`),
          h('div', { class: 'bs-lb' }, 'قوم يا بطل — الله يبارك بيومك'),
          h('div', { class: 'bs-math' },
            h('small', null, `مسألة ${s.solved + 1} من ${a.count || 3}`),
            h('div', { class: 'bs-q num' }, s.prob.q),
            h('div', { class: 'bs-ans num' }, ans || ' '),
            h('div', { class: 'bs-keys' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => h('button', { type: 'button', class: k === 'ok' ? 'ok' : '', onclick: () => press(k) }, k === 'del' ? icon('delete-left', 16) : k === 'ok' ? icon('check', 16) : k)))))]);
      } else {
        fill(body, [h('div', { class: 'bs-done' },
          h('span', { class: 'bs-sun' }, icon('sunrise', 30)),
          h('b', null, 'صباح الخير'),
          h('p', null, 'انسجلت إنك صحيت. الحمد لله الذي أحيانا بعدما أماتنا وإليه النشور.'),
          h('button', { type: 'button', class: 'btn block', onclick: leave }, 'يلّا'))]);
      }
    }
    render();
    // إذا سكّرها بزر الرجوع وهو عم يرنّ: منرجع نفتحها (الرنين ما بيوقف إلا بالحل)
    onCloseFn = () => {
      cleanup();
      if (!leaving && s.mode === 'ring') setTimeout(() => openBedside(s), 60);
      else if (!leaving) { stopRinging(); keepAwake(false); }
    };
  }, { full: true, cls: 'bs-sheet', onClose: () => onCloseFn?.() });
}
