// المكافآت والعقوبات: رصيدك فوق، وكل مكافأة إلها شريط لقدّيش قرّبت وكم يوم تقريباً باقي،
// والعقوبات اللي انضافت عليك ونفّذتها أو لسّا، وتحت «شلون بتجمع النقاط».
import { h, icon, fill, openSheet, toast, haptic, confirmSheet } from '../ui.js';
import { store, uid } from '../store.js';
import { balance, totalPoints, levelOf, redeem, POINTS, pointsOn, pointsBetween } from '../rewards.js';
import { dayLabel, addDays, daysText } from '../dates.js';
import { isDoneOn, setDone } from '../tasks.js';
import { secTitle } from './components.js';

const RW_ICONS = ['gift', 'mug-hot', 'utensils', 'book', 'umbrella-beach', 'shirt', 'gamepad', 'plane', 'bag', 'star'];
const EARN = [
  ['مهمة خلصتها', POINTS.task], ['مهمة أساسية', POINTS.taskImportant], ['صلاة بوقتها', POINTS.prayer], ['صلاة جماعة', POINTS.prayerJamaah],
  ['أذكار', POINTS.adhkar], ['صفحة قرآن', POINTS.quranPage], ['محاضرة أو حلقة', POINTS.unit], ['عادة يومية', POINTS.habit],
  ['تمرين', POINTS.workout], ['يوم تعهّد مكتمل', POINTS.fullDay], ['محاسبة النفس', 5], ['مراجعة الأسبوع', 10],
];

export function renderRewards(ctx) {
  const today = ctx.today;
  const bal = balance();
  const lv = levelOf(totalPoints());
  const rate = Math.max(0, pointsBetween(addDays(today, -13), today) / 14);
  const items = [...(store.state.rewards.items || [])].sort((a, b) => (bal >= b.cost) - (bal >= a.cost) || a.cost - b.cost);
  const pool = store.state.rewards.penalties || [];
  const pens = store.state.tasks.filter((t) => t.link?.kind === 'penalty' && t.date && t.date >= addDays(today, -13)).sort((a, b) => b.date.localeCompare(a.date));
  const ledger = [...(store.state.rewards.ledger || [])].sort((a, b) => b.at - a.at).slice(0, 25);
  const pToday = pointsOn(today);
  return h('div', null,
    h('div', { class: 'rw-bal' },
      h('span', { class: 'rw-coin' }, icon('coins', 24)),
      h('div', null, h('b', { class: 'num' }, String(bal)), h('small', null, `نقطة برصيدك${rate >= 1 ? ` · معدّلك ${Math.round(rate)} باليوم` : ''} · المستوى ${lv.level}`)),
      pToday ? h('span', { class: `pill ${pToday > 0 ? 'good' : 'bad'}` }, `${pToday > 0 ? '+' : ''}${pToday} اليوم`) : null),

    secTitle('مكافآتي', { ic: 'gift', count: items.length || null, action: h('button', { type: 'button', class: 'link-btn', onclick: () => openRewardEdit() }, icon('plus', 16), 'مكافأة') }),
    items.length ? h('div', { class: 'rw-list' }, items.map((r) => {
      const ok = bal >= r.cost;
      const pct = Math.min(1, Math.max(0, bal) / r.cost);
      const rem = r.cost - bal;
      const eta = !ok && rate >= 1 ? Math.ceil(rem / rate) : null;
      return h('div', { class: `rw-it${ok ? ' ready' : ''}` },
        h('button', { type: 'button', class: 'rw-main', onclick: () => openRewardEdit(r.id) },
          h('span', { class: 'rw-ic' }, icon(r.icon || 'gift', 16)),
          h('span', { class: 'rw-in' }, h('b', null, r.title),
            h('small', null, ok ? `${r.cost} نقطة — وصلتلها` : `${r.cost} نقطة — باقي ${rem}${eta ? ` (≈ ${daysText(eta)})` : ''}`),
            h('span', { class: 'rw-bar' }, h('i', { style: { width: `${Math.round(pct * 100)}%` } })))),
        h('button', {
          type: 'button', class: 'rw-go', disabled: ok ? null : true,
          onclick: async () => { if (await confirmSheet(r.title, `تصرف ${r.cost} نقطة على هالمكافأة؟ تستاهلها!`, 'خدها', { danger: false })) { redeem(r.id); haptic('success'); toast('مبروك! استمتع بمكافأتك', { kind: 'gold' }); } },
        }, ok ? 'استبدل' : `${Math.round(pct * 100)}%`));
    })) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'حدد مكافآت بتحبها: أكلة برّا، شي بدك تشتريه، طلعة… وكل وحدة بعدد نقاط.'), h('button', { type: 'button', class: 'btn', onclick: () => openRewardEdit() }, icon('plus', 16), 'أول مكافأة'))),

    secTitle('العقوبات', { ic: 'alert', count: pens.length ? 'آخر أسبوعين' : null }),
    pens.length ? h('div', { class: 'pen-list' }, pens.map((t) => {
      const done = isDoneOn(t, t.date);
      return h('button', { type: 'button', class: `pen-it${done ? ' done' : ''}`, onclick: () => { setDone(t.id, t.date, !done); haptic('select'); } },
        h('span', { class: 'pen-ic' }, icon(done ? 'check' : 'person-running', 14)),
        h('span', { class: 'pen-in' }, h('b', null, t.title.replace(/^عقوبة:\s*/, '')), h('small', null, `${t.link?.day ? `لأنّ يوم ${dayLabel(t.link.day, today)} ما كمل` : dayLabel(t.date, today)}`)),
        h('span', { class: `pill ${done ? 'good' : 'bad'}` }, done ? 'نفّذتها' : 'لسّا'));
    })) : h('p', { class: 'section-note' }, 'ما في عقوبات عليك هالأسبوعين. الله يقوّيك.'),
    h('div', { class: 'pen-pool' },
      h('small', null, 'كل يوم تعهّد ما بيكمل: بينخصم 15 نقطة، وبتنضاف وحدة من هدول كمهمة لليوم اللي بعده:'),
      h('div', { class: 'chips' }, pool.map((p) => h('span', { class: 'chip small pen-chip' }, p.title, h('button', { type: 'button', 'aria-label': 'شيلها', onclick: () => store.update((s) => { s.rewards.penalties = s.rewards.penalties.filter((x) => x.id !== p.id); }) }, icon('close', 9)))),
        h('button', { type: 'button', class: 'chip small', onclick: () => openPenaltyEdit() }, icon('plus', 10), 'عقوبة'))),

    secTitle('شلون بتجمع النقاط', { ic: 'star' }),
    h('div', { class: 'group earn-grid' }, EARN.map(([l, p]) => h('div', null, h('span', null, l), h('b', { class: 'num' }, `+${p}`)))),

    (store.state.rewards.redeemed || []).length ? [secTitle('مكافآت أخدتها', { ic: 'medal' }), h('div', { class: 'group rows' }, [...store.state.rewards.redeemed].reverse().slice(0, 10).map((r) => h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, r.title), h('span', { class: 'row-sub' }, new Date(r.at).toLocaleDateString('ar-SY'))), h('span', { class: 'pill gold' }, `−${r.cost}`))))] : null,
    ledger.length ? h('details', { class: 'past-exams' }, h('summary', null, 'آخر النقاط'),
      h('div', { class: 'group rows' }, ledger.map((e) => h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, e.r), h('span', { class: 'row-sub' }, dayLabel(e.d, today))), h('span', { class: `pill ${e.p > 0 ? 'gold' : 'bad'}` }, `${e.p > 0 ? '+' : ''}${e.p}`))))) : null);
}
export function rewardsActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'مكافأة جديدة', onclick: () => openRewardEdit() }, icon('plus', 20)); }

function openRewardEdit(id = null) {
  const ex = id ? store.state.rewards.items.find((x) => x.id === id) : null;
  const d = ex ? { ...ex } : { title: '', cost: 300, icon: 'gift' };
  openSheet(ex ? 'تعديل المكافأة' : 'مكافأة جديدة', (body, close) => {
    function render() {
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'المكافأة'), h('input', { type: 'text', value: d.title, placeholder: 'متل: عشا برّا', 'data-autofocus': !ex ? true : null, oninput: (e) => { d.title = e.target.value; } })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'الأيقونة'),
          h('div', { class: 'icon-grid' }, RW_ICONS.map((ic) => h('button', { type: 'button', class: 'icon-choice', 'aria-pressed': String(d.icon === ic), style: { '--tint': '#e8c46a' }, onclick: () => { d.icon = ic; render(); } }, icon(ic, 18))))),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'كم نقطة؟'),
          h('div', { class: 'chips' }, [100, 300, 500, 1000, 2000].map((n) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(d.cost === n), onclick: () => { d.cost = n; render(); } }, `${n}`))),
          h('input', { type: 'number', value: d.cost, style: { marginTop: '8px' }, oninput: (e) => { d.cost = Math.max(1, Number(e.target.value) || d.cost); } })),
        h('p', { class: 'hint' }, 'للمقارنة: يوم تعهّد كامل مع مهامك ≈ 60–100 نقطة.'),
        h('button', { type: 'button', class: 'btn block', onclick: () => {
          if (!d.title.trim()) { toast('اكتب اسم المكافأة.', { kind: 'warn' }); return; }
          store.update((s) => { if (ex) Object.assign(s.rewards.items.find((x) => x.id === id), { title: d.title.trim(), cost: Math.round(d.cost), icon: d.icon }); else s.rewards.items.push({ id: uid('rw'), title: d.title.trim(), cost: Math.round(d.cost), icon: d.icon }); });
          close();
        } }, ex ? 'احفظ' : 'أضف'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف', `حذف «${ex.title}»؟`, 'احذف')) { store.update((s) => { s.rewards.items = s.rewards.items.filter((x) => x.id !== id); }); close(); } } }, 'حذف المكافأة') : null,
      ]);
    }
    render();
  });
}
function openPenaltyEdit() {
  openSheet('عقوبة جديدة', (body, close) => {
    let title = '';
    fill(body, [
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العقوبة'), h('input', { type: 'text', placeholder: 'متل: صدقة 5 دولار', 'data-autofocus': true, oninput: (e) => { title = e.target.value; } })),
      h('div', { class: 'chips', style: { marginBottom: '10px' } }, ['صدقة 5$', '50 ضغطة', 'صيام يوم', 'بلا موبايل ساعتين', 'قراءة جزء قرآن'].map((t) => h('button', { type: 'button', class: 'chip', onclick: () => { store.update((s) => { s.rewards.penalties.push({ id: uid('pn'), title: t }); }); close(); } }, t))),
      h('button', { type: 'button', class: 'btn block', onclick: () => { if (!title.trim()) return; store.update((s) => { s.rewards.penalties.push({ id: uid('pn'), title: title.trim() }); }); close(); } }, 'أضف'),
    ]);
  });
}
