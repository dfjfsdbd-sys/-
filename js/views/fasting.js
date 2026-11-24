// الصيام والقضاء والسنن: تقويم الشهر بالأيام اللي صمتها والسنن الجاية، عدّاد القضاء، والسنن الرواتب والنوافل
import { h, icon, toast, haptic, toggleRow } from '../ui.js';
import { MONTHS, WEEK_SHORT, WEEK_START, daysInMonth, iso, shortDate, dayLabel, hijriDate } from '../dates.js';
import { PRAYER_NAMES } from '../prayer.js';
import {
  SUNNAH_SLOTS, NAWAFIL, sunnahOn, toggleSunnahSlot, rakaatOn, sunnahStreak, fastingCfg, setFastingCfg, fastInfo, fastedOn, setFasted,
  upcomingFasts, monthFasts, QADA_PRAYERS, qada, qadaAdd, qadaPrayersTotal, qadaPlanText,
} from '../fasting.js';
import { nextRamadan } from '../events.js';
import { secTitle } from './components.js';

export function renderFasting(ctx) {
  const today = ctx.today;
  const c = fastingCfg();
  const mk = today.slice(0, 7);
  const [y, m] = mk.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const off = (first.getDay() - WEEK_START + 7) % 7;
  const cells = [];
  for (let i = 0; i < off; i++) cells.push(h('i', { class: 'x' }));
  for (let dd = 1; dd <= daysInMonth(y, m - 1); dd++) {
    const d = iso(new Date(y, m - 1, dd));
    const f = fastInfo(d);
    const done = fastedOn(d);
    const cls = done ? 'f' : f.forbidden ? 'no' : f.reasons.length && d >= today ? 'w' : '';
    cells.push(h('button', {
      type: 'button', class: `${cls}${d === today ? ' t' : ''}`, 'aria-label': d,
      onclick: () => {
        if (f.forbidden) { toast(`${f.why} — ما بيجوز صيامه`, { kind: 'warn' }); return; }
        if (d > today) { toast(f.reasons.length ? `${shortDate(d)}: ${f.reasons.map((r) => r.name).join('، ')}` : `${shortDate(d)} — يوم عادي`); return; }
        setFasted(d, !done); haptic('select');
      },
    }, String(dd)));
  }
  const up = upcomingFasts(today, 4);
  const q = qada();
  const ram = nextRamadan(today);
  const plan = qadaPlanText(today, ram);
  const sn = sunnahOn(today);
  const rk = rakaatOn(today);
  const streak = sunnahStreak(today);
  return h('div', { class: 'fs-page' },
    secTitle(`الصيام — ${MONTHS[m - 1]}`, { ic: 'moon', count: monthFasts(mk) ? `صمت ${monthFasts(mk)}` : null }),
    h('div', { class: 'group fs-cal' },
      h('div', { class: 'fs-wk' }, Array.from({ length: 7 }, (_, i) => h('span', null, WEEK_SHORT[(WEEK_START + i) % 7]))),
      h('div', { class: 'fs-grid' }, cells),
      h('div', { class: 'lg3' }, h('span', null, h('i', { style: { background: 'rgba(53,183,145,.5)' } }), 'صمت'), h('span', null, h('i', { style: { background: 'rgba(232,196,106,.35)' } }), 'سنّة جاية'), h('span', null, h('i', { style: { background: 'rgba(238,82,83,.3)' } }), 'ما بيجوز')),
      h('p', { class: 'fs-tip' }, 'اضغط على يوم مضى لتعلّم إنك صمته.')),
    up.length ? h('div', { class: 'fs-up' }, up.map((x) => {
      const isT = x.d === today;
      const done = fastedOn(x.d);
      return h('div', { class: `fs-it${isT ? ' today' : ''}` },
        h('span', { class: 'fs-ic' }, icon(x.reasons.some((r) => r.k === 'white') ? 'moon' : x.reasons.some((r) => r.must) ? 'star' : 'calendar-week', 14)),
        h('span', { class: 'fs-in' }, h('b', null, x.reasons.map((r) => r.name).join(' · ')), h('small', null, `${(() => { const dl = dayLabel(x.d, today); return ['اليوم', 'بكرة', 'بعد بكرة'].includes(dl) ? `${dl} ${shortDate(x.d)}` : dl; })()} · ${hijriDate(x.d)}`)),
        isT ? h('button', { type: 'button', class: `btn small ${done ? 'secondary' : ''}`, onclick: () => { setFasted(today, !done); if (!done) toast('تقبّل الله صيامك'); } }, done ? 'تراجع' : 'صايم') : null);
    })) : null,
    h('div', { class: 'group rows', style: { marginTop: '10px' } },
      toggleRow({ title: 'الاثنين والخميس', sub: 'بيطلعوا بصفحة اليوم', checked: c.monThu, onChange: (v) => setFastingCfg({ monThu: v }) }),
      toggleRow({ title: 'الأيام البيض', sub: '13 و14 و15 من كل شهر هجري', checked: c.white, onChange: (v) => setFastingCfg({ white: v }) }),
      toggleRow({ title: 'عرفة وعاشوراء والست من شوال', checked: c.special, onChange: (v) => setFastingCfg({ special: v }) }),
      toggleRow({ title: 'ذكّرني الليلة اللي قبل', sub: 'الساعة 9 بالليل — «بكرة صيام، لا تنسى السحور»', checked: c.remind !== false, onChange: (v) => setFastingCfg({ remind: v }) })),

    secTitle('القضاء', { ic: 'rotate-left', count: qadaPrayersTotal() + q.fasts ? `${qadaPrayersTotal()} صلاة · ${q.fasts} يوم` : null }),
    h('div', { class: 'group fs-qada' },
      QADA_PRAYERS.map((k) => qRow(PRAYER_NAMES[k], 'mosque', q.prayers[k] || 0, (d) => qadaAdd(k, d))),
      qRow('صيام', 'utensils', q.fasts || 0, (d) => qadaAdd('fast', d), 'fast'),
      plan.length ? h('div', { class: 'row-note' }, plan.join(' · ')) : h('div', { class: 'row-note' }, 'إذا عليك قضاء، زيد العدد بـ+ وكل ما تقضي اضغط −.')),

    secTitle('السنن اليوم', { ic: 'star', count: `${rk} من 12 ركعة${streak ? ` · ${streak} أيام كاملة` : ''}` }),
    h('div', { class: 'fs-sn' }, SUNNAH_SLOTS.map((sl) => h('button', { type: 'button', class: sn[sl.k] ? 'on' : '', onclick: () => { const on = toggleSunnahSlot(today, sl.k); haptic(on ? 'success' : 'select'); } }, h('b', { class: 'num' }, String(sl.rak)), sl.name))),
    h('div', { class: 'chips fs-naw' }, NAWAFIL.map((n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(Boolean(sn[n.k])), onclick: () => { toggleSunnahSlot(today, n.k); haptic('select'); } }, icon(n.icon, 12), n.name))));
}
function qRow(name, ic, n, change, kind) {
  return h('div', { class: 'fs-q' },
    h('span', { class: 'fs-qic' }, icon(ic, 13)),
    h('span', { class: 'fs-qn' }, name),
    h('button', { type: 'button', class: 'fs-pm minus', 'aria-label': 'قضيت وحدة', disabled: n ? null : true, onclick: () => { change(-1); haptic('success'); toast(kind === 'fast' ? 'تقبّل الله — يوم قضاء' : 'تقبّل الله'); } }, icon('minus', 11)),
    h('b', { class: 'num' }, String(n)),
    h('button', { type: 'button', class: 'fs-pm', 'aria-label': 'زيد', onclick: () => change(1) }, icon('plus', 11)));
}
