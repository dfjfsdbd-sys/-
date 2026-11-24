// الأدعية والعدّاد: عدّاد كبير بتضغط بأي مكان بالشاشة، وأدعية مأثورة وأدعيتك الخاصة بأوقاتها
import { h, icon, fill, openSheet, toast, haptic, confirmSheet } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { DUAS, DHIKRS, DUA_TIMES } from '../data/duas.js';
import { award } from '../rewards.js';

let tab = 'counter';
let filter = 'fav';
const dhikrById = (id) => DHIKRS.find((x) => x.id === id) || DHIKRS[0];
export const dhikrCount = (day, id) => store.state.dhikr?.counts?.[day]?.[id] || 0;
const dayTotal = (day) => Object.values(store.state.dhikr?.counts?.[day] || {}).reduce((a, b) => a + b, 0);
function bump(day, id, d) {
  store.update((s) => {
    s.dhikr = s.dhikr || { counts: {}, targets: {} };
    s.dhikr.counts[day] = s.dhikr.counts[day] || {};
    s.dhikr.counts[day][id] = Math.max(0, (s.dhikr.counts[day][id] || 0) + d);
  }, { silent: true });
}
export const allDuas = () => [...DUAS, ...(store.state.duas?.custom || []).map((x) => ({ ...x, src: 'mine' }))];
export const isFav = (id) => (store.state.duas?.favs || []).includes(id);
function toggleFav(id) { store.update((s) => { s.duas = s.duas || { custom: [], favs: [] }; const f = new Set(s.duas.favs || []); if (f.has(id)) f.delete(id); else f.add(id); s.duas.favs = [...f]; }); }
// أدعية لوقت معيّن (للتذكير بصفحة اليوم)
export const duasFor = (when) => allDuas().filter((d) => d.when === when || (when !== 'any' && isFav(d.id) && !d.when));

export function renderDuas(ctx) {
  const today = ctx.today;
  const seg = h('div', { class: 'seg du-seg' }, [['counter', 'العدّاد'], ['duas', 'الأدعية']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(tab === k), onclick: () => { tab = k; ctx.refresh(); } }, l)));
  if (tab === 'counter') {
    return h('div', { class: 'du-page' }, seg,
      h('p', { class: 'du-sub' }, `اليوم: ${dayTotal(today)} ذكر`),
      h('div', { class: 'du-list' }, DHIKRS.map((x) => {
        const n = dhikrCount(today, x.id);
        const pct = x.target ? Math.min(1, n / x.target) : 0;
        return h('button', { type: 'button', class: `du-dh${x.target && n >= x.target ? ' done' : ''}`, onclick: () => openCounter(x.id) },
          h('span', { class: 'du-ring', style: { '--p': Math.round(pct * 100) } }, h('b', { class: 'num' }, String(n))),
          h('span', { class: 'du-in' }, h('b', null, x.name), h('small', null, x.target ? `${n} من ${x.target}` : 'بلا هدف')),
          icon('chevL', 14));
      })));
  }
  const list = allDuas().filter((d) => (filter === 'fav' ? isFav(d.id) : d.src === filter));
  return h('div', { class: 'du-page' }, seg,
    h('div', { class: 'chips du-f' }, [['fav', 'المفضّلة'], ['quran', 'من القرآن'], ['sunnah', 'من السنة'], ['mine', 'أدعيتي']].map(([k, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(filter === k), onclick: () => { filter = k; ctx.refresh(); } }, l))),
    list.length ? h('div', { class: 'du-cards' }, list.map((d) => h('div', { class: 'du-card' },
      h('p', null, d.text),
      h('div', { class: 'du-meta' },
        h('button', { type: 'button', class: `du-star${isFav(d.id) ? ' on' : ''}`, 'aria-label': 'مفضّل', onclick: () => { toggleFav(d.id); haptic('select'); } }, icon('star', 13, isFav(d.id) ? {} : { fill: 'none' })),
        h('small', null, [d.ref, d.src === 'mine' ? 'أدعيتي' : null, d.when && d.when !== 'any' ? DUA_TIMES[d.when] : null].filter(Boolean).join(' · ')),
        d.src === 'mine' ? h('button', { type: 'button', class: 'link-btn', onclick: () => openDuaEdit(d.id) }, icon('pen', 11)) : null))))
      : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, filter === 'fav' ? 'اضغط النجمة على أي دعاء ليصير بالمفضّلة.' : 'اكتب دعاءك الخاص — لحاجة، للأهل، لأي شي.'))),
    h('button', { type: 'button', class: 'btn block du-add', onclick: () => openDuaEdit(null) }, icon('plus', 14), 'دعاء من عندي'));
}
export function duasActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'دعاء جديد', onclick: () => openDuaEdit(null) }, icon('plus', 20)); }

function openDuaEdit(id) {
  const ex = id ? (store.state.duas?.custom || []).find((x) => x.id === id) : null;
  const f = { text: ex?.text || '', when: ex?.when || 'any' };
  openSheet(ex ? 'دعائي' : 'دعاء من عندي', (body, close) => {
    function render() {
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الدعاء'), h('textarea', { rows: 3, 'data-autofocus': !ex ? true : null, placeholder: 'اللهم يسّر لي…', oninput: (e) => { f.text = e.target.value; } }, f.text)),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'ذكّرني فيه'),
          h('div', { class: 'chips' }, Object.entries(DUA_TIMES).map(([k, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(f.when === k), onclick: () => { f.when = k; render(); } }, l)))),
        h('button', { type: 'button', class: 'btn block', onclick: () => {
          if (!f.text.trim()) { toast('اكتب الدعاء.', { kind: 'warn' }); return; }
          store.update((s) => {
            s.duas = s.duas || { custom: [], favs: [] };
            if (ex) Object.assign(s.duas.custom.find((x) => x.id === id), { text: f.text.trim(), when: f.when });
            else { const nid = uid('du'); s.duas.custom.push({ id: nid, text: f.text.trim(), when: f.when }); s.duas.favs = [...(s.duas.favs || []), nid]; }
          });
          close();
        } }, ex ? 'احفظ' : 'أضف'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف', 'حذف هالدعاء؟', 'احذف')) { store.update((s) => { s.duas.custom = s.duas.custom.filter((x) => x.id !== id); s.duas.favs = (s.duas.favs || []).filter((x) => x !== id); }); close(); } } }, 'حذف') : null,
      ]);
    }
    render();
  });
}

/* ---------- العدّاد: كل الشاشة زر ---------- */
export function openCounter(id = 'istighfar') {
  const day = logicalToday();
  let cur = dhikrById(id);
  openSheet(null, (body, close) => {
    function vib(ms) { try { navigator.vibrate?.(ms); } catch { /* */ } }
    function tap() {
      bump(day, cur.id, 1);
      const n = dhikrCount(day, cur.id);
      if (cur.target && n === cur.target) { vib([120, 60, 220]); toast(`تمّ ${cur.target} — تقبّل الله`, { kind: 'gold' }); award(`dhikr:${day}:${cur.id}`, 4, cur.name, day); }
      else if (n % 33 === 0) vib(120); else vib(12);
      draw();
    }
    function draw() {
      const n = dhikrCount(day, cur.id);
      const pct = cur.target ? Math.min(1, n / cur.target) : (n % 33) / 33;
      const phase = cur.phases ? cur.phases[Math.min(2, Math.floor(Math.min(n, cur.target - 1) / 33))] : null;
      fill(body, [
        h('div', { class: 'ct-top' },
          h('button', { type: 'button', class: 'am-x', 'aria-label': 'إغلاق', onclick: (e) => { e.stopPropagation(); close(); } }, icon('close', 16)),
          h('div', { class: 'chips ct-chips', onclick: (e) => e.stopPropagation() }, DHIKRS.map((x) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(x.id === cur.id), onclick: (e) => { e.stopPropagation(); cur = x; draw(); } }, x.name)))),
        h('div', { class: 'ct-main' },
          h('div', { class: 'ct-text' }, phase || cur.text),
          h('div', { class: 'ct-ring', style: { '--p': Math.round(pct * 100) } }, h('div', null, h('b', { class: 'num' }, String(n)), h('small', null, cur.target ? `من ${cur.target}` : 'اضغط بأي مكان'))),
          h('small', { class: 'ct-hint' }, `اضغط بأي مكان بالشاشة · اليوم كلّه ${dayTotal(day)}`)),
        h('div', { class: 'ct-acts', onclick: (e) => e.stopPropagation() },
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { bump(day, cur.id, -1); draw(); } }, icon('rotate-left', 13), 'ناقص وحدة'),
          h('button', { type: 'button', class: 'btn secondary', onclick: async () => { if (await confirmSheet('تصفير', `تصفّر «${cur.name}» لليوم؟`, 'صفّر')) { bump(day, cur.id, -dhikrCount(day, cur.id)); draw(); } } }, 'صفّر')),
      ]);
    }
    body.addEventListener('click', tap);
    draw();
  }, { full: true, cls: 'ct-sheet', onClose: () => store.update(() => {}) });
}
