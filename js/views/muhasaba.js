// محاسبة النفس قبل النوم: ملخّص اليوم جاهز، تقييم اليوم، و3 أسئلة قصيرة. بتنحفظ بسجل،
// و«شو بدك تصلّح بكرة» بيطلعلك الصبح.
import { h, icon, fill, openSheet, toast, haptic } from '../ui.js';
import { store } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, WEEKDAYS, parseISO, shortDate } from '../dates.js';
import { prayersDone } from '../worship.js';
import { tasksOn, isDoneOn } from '../tasks.js';
import { commitActive, liveVerdict } from '../commit.js';
import { award, revoke } from '../rewards.js';

export const MOODS = [
  { v: 1, label: 'سيئ', icon: 'face-frown', c: '#ee5253' },
  { v: 2, label: 'عادي', icon: 'face-meh', c: '#e0a04a' },
  { v: 3, label: 'منيح', icon: 'face-smile', c: '#4cb8d4' },
  { v: 4, label: 'كتير منيح', icon: 'face-smile-beam', c: '#35b791' },
  { v: 5, label: 'مبارك', icon: 'star', c: '#e8c46a' },
];
export const muhasabaOf = (day) => store.state.muhasaba?.[day] || null;
export const muhasabaDone = (day) => Boolean(muhasabaOf(day)?.at);
export function muhasabaStreak(today) {
  let n = 0, d = muhasabaDone(today) ? today : addDays(today, -1);
  for (let i = 0; i < 400 && muhasabaDone(d); i++) { n += 1; d = addDays(d, -1); }
  return n;
}
const moodOf = (v) => MOODS.find((m) => m.v === v) || null;

export function openMuhasaba(day = logicalToday()) {
  const prev = muhasabaOf(day) || {};
  const f = { mood: prev.mood || null, good: prev.good || '', bad: prev.bad || '', fix: prev.fix || '' };
  openSheet(null, (body, close) => {
    const tasks = tasksOn(day);
    const tDone = tasks.filter((t) => isDoneOn(t, day)).length;
    const lv = commitActive() ? liveVerdict(day) : null;
    function render() {
      const q = (k, ic, color, label, ph) => h('label', { class: 'mu-q' },
        h('span', { class: 'mu-ql' }, h('i', { class: `fa-solid fa-${ic}`, style: { color } }), label),
        h('textarea', { rows: 2, placeholder: ph, oninput: (e) => { f[k] = e.target.value; } }, f[k]));
      fill(body, [
        h('div', { class: 'mu-wrap' },
          h('div', { class: 'mu-top' },
            h('button', { type: 'button', class: 'fs-icon-btn', 'aria-label': 'إغلاق', onclick: () => close() }, icon('close', 15)),
            h('button', { type: 'button', class: 'mu-log-btn', onclick: () => openMuhasabaLog() }, icon('feather', 12), 'السجل')),
          h('h3', { class: 'mu-h' }, 'قبل ما تنام…'),
          h('p', { class: 'mu-sub' }, '«حاسبوا أنفسكم قبل أن تحاسبوا» — عمر بن الخطاب'),
          h('div', { class: 'mu-sum' },
            h('div', null, h('b', { style: { color: prayersDone(day) >= 5 ? 'var(--good)' : null } }, `${prayersDone(day)}/5`), h('small', null, 'الصلوات')),
            h('div', null, h('b', null, `${tDone}/${tasks.length}`), h('small', null, 'المهام')),
            lv ? h('div', null, h('b', { style: { color: lv.v === 'done' ? 'var(--good)' : 'var(--warn)' } }, `${Math.round(lv.pct * 100)}%`), h('small', null, 'التعهّد')) : h('div', null, h('b', null, `${(store.state.focusLog || []).filter((x) => x.d === day).reduce((a, x) => a + x.sec, 0) / 60 | 0} د`), h('small', null, 'تركيز'))),
          h('div', { class: 'f-label' }, 'كيف كان يومك؟'),
          h('div', { class: 'mu-moods' }, MOODS.map((m) => h('button', {
            type: 'button', class: `mu-mood${f.mood === m.v ? ' on' : ''}`, style: { '--c': m.c },
            onclick: () => { f.mood = m.v; haptic('select'); render(); },
          }, h('i', { class: `fa-solid fa-${m.icon}` }), h('span', null, m.label)))),
          q('good', 'circle-check', 'var(--good)', 'شو أحسنت اليوم؟', 'ولو شي صغير…'),
          q('bad', 'circle-exclamation', 'var(--warn)', 'وين قصّرت؟', 'بصراحة مع نفسك'),
          q('fix', 'arrow-trend-up', 'var(--accent)', 'شو بدك تصلّح بكرة؟', 'شغلة وحدة واضحة'),
          h('button', { type: 'button', class: 'btn block mu-save', onclick: save }, icon('check', 15), prev.at ? 'احفظ التعديل' : 'احفظ (+5 نقاط)'),
          h('p', { class: 'mu-hint' }, '«شو بدك تصلّح بكرة» بيطلعلك تذكير الصبح')),
      ]);
    }
    function save() {
      if (!f.mood && !f.good.trim() && !f.bad.trim() && !f.fix.trim()) { toast('اختار كيف كان يومك أو اكتب شي.', { kind: 'warn' }); return; }
      store.update((s) => { s.muhasaba = s.muhasaba || {}; s.muhasaba[day] = { ...f, good: f.good.trim(), bad: f.bad.trim(), fix: f.fix.trim(), at: Date.now() }; });
      award(`muhasaba:${day}`, 5, 'محاسبة النفس', day);
      haptic('success'); toast('انحفظت — تصبح على خير', { kind: 'ok' });
      close();
    }
    render();
  }, { cls: 'mu-sheet' });
}

export function openMuhasabaLog() {
  const today = logicalToday();
  openSheet('سجل محاسبة النفس', (body) => {
    const days = Object.keys(store.state.muhasaba || {}).filter((d) => muhasabaDone(d)).sort().reverse();
    const st = muhasabaStreak(today);
    fill(body, [
      st ? h('div', { class: 'mu-streak' }, icon('fire', 14), `${st} ليالي ورا بعض`) : null,
      days.length ? h('div', { class: 'mu-hist' }, days.map((d) => {
        const e = muhasabaOf(d), m = moodOf(e.mood);
        return h('details', { class: 'mu-day' },
          h('summary', null,
            h('span', { class: 'mu-dm', style: { '--c': m?.c || 'var(--ink3)' } }, h('i', { class: `fa-solid fa-${m?.icon || 'feather'}` })),
            h('span', { class: 'mu-dt' }, h('b', null, `${WEEKDAYS[parseISO(d).getDay()]} ${shortDate(d)}`), h('small', null, e.bad || e.good || e.fix || '')),
            m ? h('small', { class: 'mu-dl' }, m.label) : null),
          h('div', { class: 'mu-dbody' },
            e.good ? h('p', null, h('b', null, 'أحسنت: '), e.good) : null,
            e.bad ? h('p', null, h('b', null, 'قصّرت: '), e.bad) : null,
            e.fix ? h('p', null, h('b', null, 'بدّي صلّح: '), e.fix) : null));
      })) : h('p', { class: 'muted' }, 'لسّا ما في محاسبات. أول وحدة الليلة إن شاء الله.'),
    ]);
  }, { tall: true });
}
export { revoke };
