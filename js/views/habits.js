// العادات والسلوك: تقييم يومي بالنسبة، سلسلة الالتزام، والإعدادات (أساسية/ثانوية، يومية/أسبوعية)
import { h, icon, badge, fill, openSheet, toast, haptic, chips, toggleRow, confirmSheet, segmented, empty } from '../ui.js';
import { store } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, dayLabel, daysText, WEEK_SHORT, parseISO } from '../dates.js';
import { activeHabits, habitById, habitEntry, habitScore, habitOk, logHabit, addHabit, habitStreak, habitDaysOk, scoreLabel, SCORE_STEPS, passThreshold, HABIT_KINDS } from '../habits.js';
import { invalidateDay, commitActive } from '../commit.js';
import { ITEM_ICON_CHOICES, TINT_KEYS, tintHex } from '../icons.js';
import { secTitle } from './components.js';

const GROUPS = { behavior: 'السلوك', worship: 'عبادة', sport: 'رياضة وصحة', other: 'أخرى' };

export function renderHabits(ctx) {
  const today = ctx.today;
  const list = activeHabits();
  if (!list.length) return h('div', null, empty('leaf', 'أضف عادة بدك تبنيها أو شي بدك تتركه، وقيّم حالك كل يوم بنسبة.', h('button', { type: 'button', class: 'btn', onclick: () => openHabitEdit(null) }, icon('plus', 18), 'عادة جديدة')));
  const groups = {};
  for (const hb of list) (groups[hb.group || 'other'] = groups[hb.group || 'other'] || []).push(hb);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  return h('div', null,
    h('p', { class: 'section-note' }, `حدّ النجاح ${Math.round(passThreshold() * 100)}%: التقييم تحته ما بينحسب التزام.`),
    Object.entries(groups).map(([g, items]) => [
      secTitle(GROUPS[g] || g, { count: items.length }),
      h('div', { class: 'group rows' }, items.map((hb) => {
        const st = habitStreak(hb.id, today);
        const sc = habitScore(today, hb.id);
        return h('div', { class: 'habit-row' },
          h('button', { type: 'button', class: 'row-tap', onclick: () => openHabitLog(today, hb.id) },
            badge(hb.icon || 'leaf', hb.color || 'mint', 40),
            h('span', { class: 'row-main' },
              h('span', { class: 'row-title' }, hb.name, hb.core ? h('span', { class: `pill ${hb.level === 'secondary' ? 'gold' : 'bad'}`, style: { marginInlineStart: '6px' } }, hb.level === 'secondary' ? 'ثانوية' : 'أساسية') : null),
              h('span', { class: 'row-sub' }, sc == null ? 'ما قيّمت اليوم' : `اليوم ${Math.round(sc * 100)}% — ${scoreLabel(sc)}`, st ? ` · ${daysText(st)} ورا بعض` : ''))),
          h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': 'إعدادات', onclick: () => openHabitEdit(hb.id) }, icon('sliders', 18)),
          h('div', { class: 'h-strip' }, days.map((d) => {
            const s = habitScore(d, hb.id);
            return h('button', { type: 'button', class: `h-cell${s == null ? '' : s >= passThreshold() ? ' ok' : s > 0 ? ' part' : ' no'}${d === today ? ' today' : ''}`, title: d, 'aria-label': d, onclick: () => openHabitLog(d, hb.id) }, WEEK_SHORT[parseISO(d).getDay()]);
          })));
      })),
    ]),
    h('div', { class: 'section-actions' }, h('button', { type: 'button', class: 'btn secondary', onclick: () => openHabitEdit(null) }, icon('plus', 18), 'عادة جديدة')));
}
export function habitsActions() {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'عادة جديدة', onclick: () => openHabitEdit(null) }, icon('plus', 20));
}

// تقييم يوم: نسبة بلمسة، أو رقم إذا العادة بتنقاس (ساعات هاتف مثلاً)
export function openHabitLog(day, id) {
  const hb = habitById(id);
  if (!hb) return;
  openSheet(hb.name, (body, close) => {
    const e = habitEntry(day, id);
    const cur = habitScore(day, id);
    const th = passThreshold();
    const done = (entry) => {
      logHabit(day, id, entry);
      if (day < logicalToday()) invalidateDay(day);
      const s = habitScore(day, id);
      haptic(s != null && s >= th ? 'success' : 'warn');
      if (s != null) toast(s >= th ? `${Math.round(s * 100)}% — ${scoreLabel(s)}${habitStreak(id, logicalToday()) > 1 ? ` · ${daysText(habitStreak(id, logicalToday()))} ورا بعض` : ''}` : `${Math.round(s * 100)}% — دون الحدّ، بكرة أحسن بإذن الله`, { kind: s >= th ? 'ok' : 'warn' });
      close();
    };
    const valInput = hb.measured ? h('input', { type: 'number', inputmode: 'decimal', value: e?.value ?? '', placeholder: hb.unit || 'الرقم' }) : null;
    fill(body, [
      h('p', { class: 'hint' }, `${dayLabel(day, logicalToday())} — ${hb.kind === 'abstain' ? 'قدّيش التزمت بالترك؟' : 'قدّيش التزمت؟'}${hb.note ? ` (${hb.note})` : ''}`),
      hb.measured ? h('div', { class: 'ql-to', style: { marginBottom: '12px' } },
        h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, `${hb.direction === 'atLeast' ? 'لازم ما يقل عن' : 'لازم ما يزيد عن'} ${hb.limit} ${hb.unit || ''}`), valInput),
        h('button', { type: 'button', class: 'btn', onclick: () => { const v = Number(valInput.value); if (Number.isNaN(v) || valInput.value === '') return; done({ value: v }); } }, 'سجّل')) : null,
      h('div', { class: 'rate-grid' }, SCORE_STEPS.map((s) => h('button', {
        type: 'button', class: `rate-opt${s < th ? ' fail' : ''}${cur != null && Math.abs(cur - s) < 0.01 ? ' on' : ''}`,
        onclick: () => done({ score: s, done: s >= th }),
      }, h('b', null, `${Math.round(s * 100)}%`), h('small', null, s === 0 ? 'ما التزمت' : scoreLabel(s))))),
      e ? h('button', { type: 'button', class: 'btn danger block', onclick: () => done(null) }, 'امسح تقييم هاليوم') : null,
    ]);
  });
}

export function openHabitEdit(id) {
  const existing = id ? habitById(id) : null;
  const d = existing ? JSON.parse(JSON.stringify(existing)) : { name: '', kind: 'build', note: '', icon: 'leaf', color: 'mint', core: false, level: 'essential', rhythm: { type: 'daily' }, group: 'behavior' };
  openSheet(existing ? 'تعديل العادة' : 'عادة جديدة', (body, close) => {
    function render() {
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: d.name, placeholder: 'متل: ترك إدمان الهاتف', 'data-autofocus': true, oninput: (e) => { d.name = e.target.value; } })),
        segmented(Object.entries(HABIT_KINDS).map(([v, l]) => ({ value: v, label: l.split(' (')[0] })), d.measured ? 'measure' : d.kind, (v) => { if (v === 'measure') { d.measured = true; d.kind = 'abstain'; } else { d.measured = false; d.kind = v; } render(); }),
        d.measured ? h('div', { class: 'three' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الحد'), h('input', { type: 'number', value: d.limit || '', oninput: (e) => { d.limit = Number(e.target.value); } })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الوحدة'), h('input', { type: 'text', value: d.unit || '', placeholder: 'ساعة', oninput: (e) => { d.unit = e.target.value; } })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الاتجاه'), h('select', { onchange: (e) => { d.direction = e.target.value; } }, h('option', { value: 'atMost', selected: d.direction !== 'atLeast' ? true : null }, 'لا يزيد'), h('option', { value: 'atLeast', selected: d.direction === 'atLeast' ? true : null }, 'لا يقل')))) : null,
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'ملاحظة (اختياري)'), h('input', { type: 'text', value: d.note || '', placeholder: 'متل: ترفيه 4 ساعات بالحد الأقصى', oninput: (e) => { d.note = e.target.value; } })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'القسم'), chips(Object.entries(GROUPS).map(([v, l]) => ({ value: v, label: l })), d.group, (v) => { d.group = v; render(); })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'التكرار'), chips([{ value: 'daily', label: 'كل يوم' }, { value: 'weekly', label: 'عدد مرات بالأسبوع' }], d.rhythm?.type || 'daily', (v) => { d.rhythm = v === 'weekly' ? { type: 'weekly', times: d.rhythm?.times || 3 } : { type: 'daily' }; render(); })),
        d.rhythm?.type === 'weekly' ? h('div', { class: 'chips', style: { marginBottom: '14px' } }, [1, 2, 3, 4, 5, 6].map((n) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(d.rhythm.times === n), onclick: () => { d.rhythm.times = n; render(); } }, `${n} مرات`))) : null,
        h('div', { class: 'rows sheet-rows' },
          toggleRow({ title: 'من شروط التعهّد', sub: commitActive() ? 'بتدخل بحكم اليوم ونسبته' : 'بتشتغل لما تبدأ تعهّد', checked: d.core, onChange: (v) => { d.core = v; render(); } })),
        d.core ? h('div', { class: 'seg' }, [['essential', 'أساسية: اليوم ما بيكمل بدونها'], ['secondary', 'ثانوية: بترفع النسبة']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String((d.level || 'essential') === v), onclick: () => { d.level = v; render(); } }, l.split(':')[0]))) : null,
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'الأيقونة واللون'),
          h('div', { class: 'icon-grid' }, ITEM_ICON_CHOICES.slice(0, 24).map((ic) => h('button', { type: 'button', class: 'icon-choice', 'aria-pressed': String(d.icon === ic), style: { '--tint': tintHex(d.color) }, onclick: () => { d.icon = ic; render(); } }, icon(ic, 20)))),
          h('div', { class: 'tint-row', style: { marginTop: '10px' } }, TINT_KEYS.map((k) => h('button', { type: 'button', class: 'tint-dot', 'aria-pressed': String(d.color === k), style: { '--tint': tintHex(k) }, 'aria-label': k, onclick: () => { d.color = k; render(); } })))),
        h('button', { type: 'button', class: 'btn block', onclick: save }, existing ? 'احفظ' : 'أضف العادة'),
        existing ? h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('أرشفة العادة', 'بتختفي من اليوم ومن التعهّد، وسجلّها بيضل محفوظ.', 'أرشف')) { store.update((s) => { const x = s.habits.find((y) => y.id === id); x.archived = true; }); close(); } } }, 'أرشف العادة') : null,
      ]);
    }
    function save() {
      if (!d.name.trim()) { toast('اكتب اسم العادة.', { kind: 'warn' }); return; }
      if (existing) store.update((s) => { const i = s.habits.findIndex((x) => x.id === id); s.habits[i] = { ...s.habits[i], ...d, name: d.name.trim() }; });
      else addHabit({ ...d, name: d.name.trim() });
      close();
      toast(existing ? 'انحفظت' : 'انضافت العادة');
    }
    render();
  });
}
export { habitOk, habitDaysOk };
