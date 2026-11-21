// المكافآت والعقوبات: النقاط بتشتري مكافآت إنت بتحددها، واليوم الناقص بالتعهّد إله عقوبة إنت بتختارها
import { h, icon, badge, ring, fill, openSheet, toast, haptic, confirmSheet } from '../ui.js';
import { store, uid } from '../store.js';
import { balance, totalPoints, levelOf, redeem, addReward } from '../rewards.js';
import { dayLabel } from '../dates.js';
import { logicalToday } from '../prayer.js';
import { secTitle } from './components.js';

export function renderRewards(ctx) {
  const today = ctx.today;
  const bal = balance();
  const lv = levelOf(totalPoints());
  const items = store.state.rewards.items || [];
  const pens = store.state.rewards.penalties || [];
  const ledger = [...(store.state.rewards.ledger || [])].sort((a, b) => b.at - a.at).slice(0, 25);
  return h('div', null,
    h('div', { class: 'rw-hero' },
      h('div', null, h('small', null, 'رصيدك'), h('b', { class: 'num' }, String(bal)), h('span', null, `مجموع ما جمعت ${totalPoints()} — المستوى ${lv.level}`)),
      badge('gift', 'gold', 56)),
    secTitle('المكافآت', { ic: 'gift', action: h('button', { type: 'button', class: 'link-btn', onclick: () => openRewardEdit() }, icon('plus', 16), 'مكافأة') }),
    items.length ? h('div', { class: 'group rows' }, items.map((r) => h('div', { class: 'row' },
      badge('gift', 'gold', 38),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, r.title), h('span', { class: 'row-sub' }, bal >= r.cost ? 'بتقدر تاخدها هلق' : `ناقصك ${r.cost - bal} نقطة`)),
      h('button', { type: 'button', class: `btn small ${bal >= r.cost ? 'gold' : 'secondary'}`, disabled: bal < r.cost ? true : null, onclick: async () => { if (await confirmSheet(r.title, `تصرف ${r.cost} نقطة على هالمكافأة؟ تستاهلها!`, 'خدها', { danger: false })) { redeem(r.id); haptic('success'); toast('مبروك! استمتع بمكافأتك', { kind: 'gold' }); } } }, `${r.cost}`)))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'حدد مكافآت بتحبها: أكلة برا، شي بدك تشتريه، طلعة… وكل وحدة بعدد نقاط.'))),
    secTitle('العقوبات', { ic: 'alert', action: h('button', { type: 'button', class: 'link-btn', onclick: () => openPenaltyEdit() }, icon('plus', 16), 'عقوبة') }),
    h('p', { class: 'section-note' }, 'كل يوم تعهّد ما بيكمل: بينخصم 15 نقطة، وبتنضاف وحدة من هالعقوبات كمهمة لليوم اللي بعده.'),
    pens.length ? h('div', { class: 'group rows' }, pens.map((p) => h('div', { class: 'row' }, badge('alert', 'coral', 36), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, p.title)),
      h('button', { type: 'button', class: 'icon-btn ghost small', 'aria-label': 'حذف', onclick: () => store.update((s) => { s.rewards.penalties = s.rewards.penalties.filter((x) => x.id !== p.id); }) }, icon('trash', 16))))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'متل: صدقة 5$، 50 ضغطة، صيام يوم، حرمان من الموبايل ساعة…'))),
    (store.state.rewards.redeemed || []).length ? [secTitle('مكافآت أخدتها', { ic: 'medal' }), h('div', { class: 'group rows' }, [...store.state.rewards.redeemed].reverse().slice(0, 10).map((r) => h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, r.title), h('span', { class: 'row-sub' }, new Date(r.at).toLocaleDateString('ar-SY'))), h('span', { class: 'pill gold' }, `−${r.cost}`))))] : null,
    secTitle('آخر النقاط', { ic: 'star' }),
    h('div', { class: 'group rows' }, ledger.map((e) => h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, e.r), h('span', { class: 'row-sub' }, dayLabel(e.d, today))), h('span', { class: `pill ${e.p > 0 ? 'gold' : 'bad'}` }, `${e.p > 0 ? '+' : ''}${e.p}`)))));
}
export function rewardsActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'مكافأة جديدة', onclick: () => openRewardEdit() }, icon('plus', 20)); }

function openRewardEdit() {
  openSheet('مكافأة جديدة', (body, close) => {
    let title = '', cost = 300;
    fill(body, [
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'المكافأة'), h('input', { type: 'text', placeholder: 'متل: عشا برا', 'data-autofocus': true, oninput: (e) => { title = e.target.value; } })),
      h('div', { class: 'chips', style: { marginBottom: '10px' } }, [100, 300, 500, 1000, 2000].map((n) => h('button', { type: 'button', class: 'chip', onclick: (e) => { cost = n; e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, `${n} نقطة`))),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'أو عدد النقاط'), h('input', { type: 'number', value: cost, oninput: (e) => { cost = Number(e.target.value) || cost; } })),
      h('p', { class: 'hint' }, 'للمقارنة: يوم تعهّد كامل مع مهامك ≈ 60–100 نقطة.'),
      h('button', { type: 'button', class: 'btn block', onclick: () => { if (!title.trim()) return; addReward(title.trim(), cost); close(); } }, 'أضف'),
    ]);
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
