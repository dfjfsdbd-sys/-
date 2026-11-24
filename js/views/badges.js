// صفحة الأوسمة: المفتوحة بلونها وتاريخها، والمقفولة بشريط قدّيش باقي
import { h, icon } from '../ui.js';
import { shortDate } from '../dates.js';
import { BADGES, badgeState } from '../badges.js';

export function renderBadges(ctx) {
  const all = BADGES.map(badgeState);
  const got = all.filter((b) => b.at).sort((a, b) => b.at.localeCompare(a.at));
  const lock = all.filter((b) => !b.at).sort((a, b) => b.pct - a.pct);
  const last = got[0];
  return h('div', { class: 'bg-page' },
    h('p', { class: 'bg-sub' }, `${got.length} من ${all.length} — بتنفتح لحالها لما توصل`),
    last ? h('div', { class: 'bg-new', style: { '--c': last.c } }, h('span', { class: 'bg-md' }, icon(last.icon, 20)), h('div', null, h('b', null, `آخر وسام: ${last.name}`), h('small', null, `${last.desc} · ${shortDate(last.at)}`))) : null,
    h('div', { class: 'bg-grid' }, [...got, ...lock].map((b) => h('div', { class: `bg-it${b.at ? '' : ' lock'}`, style: { '--c': b.c } },
      h('span', { class: 'bg-md' }, icon(b.at ? b.icon : 'lock', b.at ? 20 : 15)),
      h('b', null, b.name),
      b.at ? h('small', null, shortDate(b.at)) : [h('span', { class: 'bg-bar' }, h('i', { style: { width: `${Math.round(b.pct * 100)}%` } })), h('small', { class: 'num' }, `${b.cur} من ${b.target}${b.unit ? ` ${b.unit}` : ''}`)]))));
}
