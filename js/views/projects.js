// المشاريع: القائمة (بالتخطيط) وصفحة المشروع بمراحله وخطواته وميزانيته
import { h, icon, fill, openSheet, toast, haptic, openDatePicker, confirmSheet, openActions } from '../ui.js';
import { store } from '../store.js';
import { logicalToday } from '../prayer.js';
import { shortDate, daysText, inDaysText, WEEKDAYS, parseISO, dayLabel, countText, daysBetween } from '../dates.js';
import {
  PROJECT_ICONS, PROJECT_COLORS, PROJECT_TEMPLATES, projects, projectById, stepsOf, projectStats, addProject, updateProject, deleteProject,
  addPhase, renamePhase, deletePhase, saveStep, deleteStep, stepTask, toggleStep, stepToTask, distributeSteps,
} from '../projects.js';
import { secTitle } from './components.js';

const money = (n) => Number(n || 0).toLocaleString('en-US');
const stepsWord = (n) => countText(n, ['خطوة', 'خطوتين', 'خطوات', 'خطوة']);
// «اليوم / بكرة / الخميس / 9 ك1»
function whenText(d, today) {
  const n = daysBetween(today, d);
  if (n < 0) return `من ${shortDate(d)}`;
  if (n <= 1) return dayLabel(d, today);
  return n < 7 ? WEEKDAYS[parseISO(d).getDay()] : shortDate(d);
}

export function renderProjectsInline(ctx) {
  const list = projects();
  const today = ctx.today;
  return h('div', { class: 'pj-wrap' },
    h('div', { class: 'pj-head' }, h('p', null, 'الأشياء الكبيرة بمراحل وخطوات وموعد — والخطوة بتصير مهمة بكبسة.'),
      h('button', { type: 'button', class: 'link-btn', onclick: () => openProjectNew(ctx) }, icon('plus', 14), 'مشروع')),
    list.length ? h('div', { class: 'pj-list' }, list.map((p) => {
      const st = projectStats(p, today);
      return h('button', { type: 'button', class: 'pj-it', style: { '--c': p.color }, onclick: () => ctx.open(`plan/project/${p.id}`) },
        h('span', { class: 'pj-ic' }, icon(p.icon, 16)),
        h('span', { class: 'pj-in' }, h('b', null, p.name),
          h('small', null, [`${p.phases.length} مراحل`, `${st.done} من ${st.total}`, st.daysLeft != null ? (st.daysLeft >= 0 ? `باقي ${daysText(st.daysLeft)}` : 'مضى الموعد') : null].filter(Boolean).join(' · ')),
          h('span', { class: 'pj-bar' }, h('i', { style: { width: `${Math.round(st.pct * 100)}%` } }))),
        h('span', { class: 'pj-pc num' }, `${Math.round(st.pct * 100)}%`));
    })) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'متل: تجهيز الزواج، التخرّج، سفر العمرة. بتقسمه مراحل وخطوات، والتطبيق بيوزّعها على أيامك.'), h('button', { type: 'button', class: 'btn', onclick: () => openProjectNew(ctx) }, icon('plus', 16), 'أول مشروع'))));
}

function openProjectNew(ctx) {
  let tpl = 'marriage';
  const f = { name: '', icon: null, color: null, deadline: null, budget: null };
  openSheet('مشروع جديد', (body, close) => {
    function render() {
      const t = PROJECT_TEMPLATES[tpl];
      fill(body, [
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'بلّش من'),
          h('div', { class: 'chips' }, [['marriage', 'تجهيز الزواج'], ['travel', 'سفر'], ['blank', 'فاضي']].map(([k, l]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(tpl === k), onclick: () => { tpl = k; render(); } }, l)))),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: f.name || t.name, placeholder: 'متل: التخرّج', oninput: (e) => { f.name = e.target.value; } })),
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'select-btn', onclick: () => openDatePicker({ value: f.deadline, today: logicalToday(), title: 'الموعد', allowEmpty: true, emptyLabel: 'بلا موعد', onPick: (d) => { f.deadline = d || null; render(); } }) }, icon('calendar', 16), h('span', { class: f.deadline ? 'sb-val' : 'sb-val ph' }, f.deadline ? shortDate(f.deadline) : 'الموعد')),
          h('label', { class: 'field', style: { margin: 0 } }, h('input', { type: 'number', value: f.budget || '', placeholder: 'الميزانية (اختياري)', oninput: (e) => { f.budget = Number(e.target.value) || null; } }))),
        h('p', { class: 'hint' }, tpl === 'blank' ? 'بتضيف المراحل والخطوات بعدين.' : `فيه مراحل جاهزة (${t.phases().map((x) => x.name).join('، ')}) — بتعدّلها على كيفك.`),
        h('button', { type: 'button', class: 'btn block', onclick: () => {
          const p = addProject(tpl, { ...f, name: (f.name || t.name || '').trim() || 'مشروع' });
          close(); setTimeout(() => ctx.open(`plan/project/${p.id}`), 200);
        } }, icon('check', 15), 'أنشئ'),
      ]);
    }
    render();
  });
}

/* ---------- صفحة المشروع ---------- */
export function renderProject(ctx) {
  const p = projectById(ctx.params.id);
  if (!p) return h('div', { class: 'empty' }, 'المشروع مش موجود');
  const today = ctx.today;
  const st = projectStats(p, today);
  const root = h('div', { class: 'pj-page' },
    h('div', { class: 'pj-cov', style: { '--c': p.color } }, h('span', { class: 'pj-cic' }, icon(p.icon, 42)),
      h('div', { class: 'pj-cap' }, h('b', null, p.name), h('small', null, p.deadline ? `الموعد: ${shortDate(p.deadline)} · ${st.daysLeft >= 0 ? inDaysText(st.daysLeft) : 'مضى'}` : 'بلا موعد'))),
    h('div', { class: 'pj-body' },
      h('span', { class: 'pj-bar big' }, h('i', { style: { width: `${Math.round(st.pct * 100)}%` } })),
      h('div', { class: 'pj-kp' },
        h('div', null, h('b', { class: 'num' }, `${Math.round(st.pct * 100)}%`), h('small', null, 'التقدّم')),
        h('div', null, h('b', { class: 'num' }, `${st.done}/${st.total}`), h('small', null, 'خطوة')),
        h('div', null, h('b', { class: 'num' }, st.perWeek ? String(st.perWeek) : '—'), h('small', null, st.perWeek ? 'بالأسبوع لتلحق' : 'خطوات بالأسبوع'))),
      p.budget || st.costTotal ? h('button', { type: 'button', class: 'pj-budget', onclick: () => openProjectEdit(p.id) },
        h('span', null, icon('wallet', 13), 'الميزانية'), h('b', { class: 'num' }, `صرفت ${money(st.spent)}${p.budget ? ` من ${money(p.budget)}` : ''}`),
        p.budget ? h('span', { class: 'pj-bbar' }, h('i', { style: { width: `${Math.min(100, Math.round((st.spent / p.budget) * 100))}%` } })) : null,
        st.costTotal && p.budget ? h('small', null, st.costTotal > p.budget ? `مجموع الخطوات ${money(st.costTotal)} — أكتر من الميزانية بـ ${money(st.costTotal - p.budget)}` : `مجموع الخطوات ${money(st.costTotal)}`) : null) : null),
    secTitle('المراحل', { ic: 'layer-group', action: h('button', { type: 'button', class: 'link-btn', onclick: () => openPhaseEdit(p.id, null) }, icon('plus', 13), 'مرحلة') }),
    h('div', { class: 'pj-phases' }, p.phases.map((ph) => {
      const done = ph.steps.filter((x) => x.done).length;
      return h('div', { class: 'pj-ph' },
        h('button', { type: 'button', class: 'pj-phh', onclick: () => openPhaseEdit(p.id, ph.id) }, h('span', { class: 'pj-ic sm', style: { '--c': p.color } }, icon(ph.icon || 'flag', 13)), h('b', null, ph.name), h('em', null, `${done} من ${ph.steps.length}`)),
        ph.steps.map((s) => {
          const t = stepTask(s);
          return h('div', { class: `pj-st${s.done ? ' ok' : ''}` },
            h('button', { type: 'button', class: 'pj-ck', 'aria-label': s.done ? 'تراجع' : 'خلصت', onclick: () => { toggleStep(p.id, s.id); haptic(s.done ? 'select' : 'success'); } }, s.done ? icon('check', 10) : null),
            h('button', { type: 'button', class: 'pj-stt', onclick: () => openStepEdit(p.id, ph.id, s.id) }, h('span', null, s.title),
              t && !t.done && t.date ? h('em', { class: 'pj-tag' }, `مهمة ${whenText(t.date, today)}`) : null),
            s.cost ? h('small', { class: 'num' }, money(s.cost)) : null);
        }),
        h('button', { type: 'button', class: 'pj-add', onclick: () => openStepEdit(p.id, ph.id, null) }, icon('plus', 11), 'خطوة'));
    })),
    st.left ? h('div', { class: 'pj-acts' },
      h('button', { type: 'button', class: 'btn block', onclick: () => { const n = distributeSteps(p.id, today); toast(n ? `انوزّعت ${stepsWord(n)} على أيامك — بتطلع بمهام اليوم` : 'كل الخطوات إلها مهام'); } }, icon('wand', 14), 'وزّع الباقي على أسابيعي')) : h('p', { class: 'section-note' }, 'خلّصت كل الخطوات — الله يبارك.'));
  root.dataset.title = p.name;
  return root;
}
export function projectActions(ctx) {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'خيارات', onclick: () => openActions('المشروع', [
    { icon: 'edit', label: 'تعديل المشروع', run: () => openProjectEdit(ctx.params.id) },
    { icon: 'plus', label: 'مرحلة جديدة', run: () => openPhaseEdit(ctx.params.id, null) },
    { icon: 'trash', label: 'حذف المشروع', run: async () => { if (await confirmSheet('حذف المشروع', 'بينحذف المشروع ومهام خطواته اللي ما خلصت.', 'احذف')) { deleteProject(ctx.params.id); ctx.back(); } } },
  ]) }, icon('more', 20));
}

function openProjectEdit(id) {
  const p = projectById(id);
  if (!p) return;
  const f = { name: p.name, icon: p.icon, color: p.color, deadline: p.deadline, budget: p.budget };
  openSheet('تعديل المشروع', (body, close) => {
    function render() {
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: f.name, oninput: (e) => { f.name = e.target.value; } })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'الأيقونة واللون'),
          h('div', { class: 'icon-grid' }, PROJECT_ICONS.map((ic) => h('button', { type: 'button', class: 'icon-choice', 'aria-pressed': String(f.icon === ic), style: { '--tint': f.color }, onclick: () => { f.icon = ic; render(); } }, icon(ic, 18)))),
          h('div', { class: 'tint-row', style: { marginTop: '10px' } }, PROJECT_COLORS.map((c) => h('button', { type: 'button', class: 'tint-dot', 'aria-pressed': String(f.color === c), style: { '--tint': c }, onclick: () => { f.color = c; render(); } })))),
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'select-btn', onclick: () => openDatePicker({ value: f.deadline, today: logicalToday(), title: 'الموعد', allowEmpty: true, emptyLabel: 'بلا موعد', onPick: (d) => { f.deadline = d || null; render(); } }) }, icon('calendar', 16), h('span', { class: f.deadline ? 'sb-val' : 'sb-val ph' }, f.deadline ? shortDate(f.deadline) : 'الموعد')),
          h('label', { class: 'field', style: { margin: 0 } }, h('input', { type: 'number', value: f.budget || '', placeholder: 'الميزانية', oninput: (e) => { f.budget = Number(e.target.value) || null; } }))),
        h('button', { type: 'button', class: 'btn block', onclick: () => { updateProject(id, { ...f, name: f.name.trim() || p.name }); close(); } }, 'احفظ'),
      ]);
    }
    render();
  });
}
function openPhaseEdit(pid, phid) {
  const p = projectById(pid);
  const ph = phid ? p?.phases.find((x) => x.id === phid) : null;
  let name = ph?.name || '';
  let ic = ph?.icon || 'flag';
  openSheet(ph ? 'المرحلة' : 'مرحلة جديدة', (body, close) => {
    function render() {
      fill(body, [
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: name, 'data-autofocus': !ph ? true : null, placeholder: 'متل: الأوراق الرسمية', oninput: (e) => { name = e.target.value; } })),
        h('div', { class: 'icon-grid' }, ['flag', 'house', 'file-signature', 'champagne-glasses', 'ticket', 'suitcase', 'cart-shopping', 'list-check'].map((x) => h('button', { type: 'button', class: 'icon-choice', 'aria-pressed': String(ic === x), style: { '--tint': p.color }, onclick: () => { ic = x; render(); } }, icon(x, 18)))),
        h('button', { type: 'button', class: 'btn block', onclick: () => { if (!name.trim()) { toast('اكتب اسم المرحلة.', { kind: 'warn' }); return; } if (ph) renamePhase(pid, phid, { name: name.trim(), icon: ic }); else addPhase(pid, name.trim(), ic); close(); } }, ph ? 'احفظ' : 'أضف'),
        ph ? h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف المرحلة', `حذف «${ph.name}» وخطواتها؟`, 'احذف')) { deletePhase(pid, phid); close(); } } }, 'حذف المرحلة') : null,
      ]);
    }
    render();
  });
}
function openStepEdit(pid, phid, sid) {
  const p = projectById(pid);
  const ph = p?.phases.find((x) => x.id === phid);
  const ex = sid ? ph?.steps.find((x) => x.id === sid) : null;
  const f = { title: ex?.title || '', cost: ex?.cost || null, notes: ex?.notes || '' };
  const today = logicalToday();
  openSheet(ex ? 'الخطوة' : `خطوة بـ«${ph?.name}»`, (body, close) => {
    const t = stepTask(ex);
    fill(body, [
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الخطوة'), h('input', { type: 'text', value: f.title, 'data-autofocus': !ex ? true : null, placeholder: 'متل: حجز الصالة', oninput: (e) => { f.title = e.target.value; } })),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'الكلفة (اختياري)'), h('input', { type: 'number', value: f.cost || '', oninput: (e) => { f.cost = Number(e.target.value) || null; } })),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'ملاحظات'), h('textarea', { rows: 2, oninput: (e) => { f.notes = e.target.value; } }, f.notes)),
      ex && !ex.done ? h('button', { type: 'button', class: 'btn secondary block', onclick: () => openDatePicker({ value: t?.date || today, today, title: 'إيمت بدك تعملها؟', onPick: (d) => { if (!d) return; saveStep(pid, phid, { id: ex.id, ...f, title: f.title.trim() || ex.title }); stepToTask(pid, ex.id, d); close(); toast(`صارت مهمة ${dayLabel(d, today)}`); } }) },
        icon('calendar-plus', 15), t && !t.done ? `مهمة ${whenText(t.date, today)} — غيّر اليوم` : 'خلّيها مهمة بيوم') : null,
      h('button', { type: 'button', class: 'btn block', onclick: () => { if (!f.title.trim()) { toast('اكتب الخطوة.', { kind: 'warn' }); return; } saveStep(pid, phid, ex ? { id: ex.id, ...f, title: f.title.trim() } : { ...f, title: f.title.trim() }); close(); } }, ex ? 'احفظ' : 'أضف'),
      ex ? h('button', { type: 'button', class: 'btn danger block', onclick: () => { deleteStep(pid, phid, ex.id); close(); } }, 'حذف الخطوة') : null,
    ]);
  });
}
export { stepsOf };
