// الدراسة: المواد ومحاضراتها، وجدول المذاكرات والامتحانات (تاريخ، محاضرات داخلة، جاهزيتك، وخطة مذاكرة)
import { h, icon, badge, bar, ring, fill, openSheet, toast, haptic, chips, openDatePicker, openTimePicker, confirmSheet, pickImage, lowResCheck, empty, openActions } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, dayLabel, shortDate, daysBetween, parseISO, MONTHS, WEEKDAYS, time12, durText, daysText, countText, inDaysText } from '../dates.js';
import { MASTERY_STEPS, masteryLabel, studyUnit, unitsProgress, addUnits } from '../library.js';
import { addTask } from '../tasks.js';
import { openFocus } from './focus.js';
import { secTitle, itemCard } from './components.js';
import { ITEM_ICON_CHOICES, TINT_KEYS, tintHex } from '../icons.js';

import { EXAM_KINDS, examView, examsBetween, examCard, openExam, openExamEdit, openShareExams } from './exams.js';
export { EXAM_KINDS, examsBetween, openExam, openExamEdit, openShareExams };
const subjectById = (id) => store.state.subjects.find((x) => x.id === id);

/* ---------- صفحة الدراسة ---------- */
export function renderStudy(ctx) {
  const today = ctx.today;
  const subs = store.state.subjects;
  const all = (store.state.exams || []).map(examView).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = all.filter((e) => e.date >= today);
  const past = all.filter((e) => e.date < today);
  const overall = subs.length ? subs.reduce((a, s) => a + unitsProgress(s.lectures), 0) / subs.length : 0;
  const lectCount = subs.reduce((a, s) => a + (s.lectures?.length || 0), 0);
  return h('div', null,
    h('div', { class: 'study-hero' },
      ring(overall, 62, { stroke: 5, color: 'var(--sky)', label: `${Math.round(overall * 100)}%` }),
      h('div', null, h('strong', null, `${subs.length} مواد، ${lectCount} محاضرة`), h('small', null, upcoming.length ? `أقرب ${upcoming[0].kindLabel}: ${upcoming[0].subjectName} ${dayLabel(upcoming[0].date, today)}` : 'ما في امتحانات قريبة مسجّلة'))),
    secTitle('المذاكرات والامتحانات', { ic: 'calCheck', count: upcoming.length || null, action: h('span', { class: 'sec-acts' },
      upcoming.length ? h('button', { type: 'button', class: 'link-btn share-btn', onclick: () => openShareExams() }, icon('share-nodes', 13), 'شارك') : null,
      h('button', { type: 'button', class: 'link-btn', onclick: () => openExamEdit(null) }, icon('plus', 16), 'إضافة')) }),
    upcoming.length ? h('div', { class: 'exam-list' }, upcoming.map((e) => examCard(e, today))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'سجّل مذاكراتك وامتحاناتك بتواريخها والمحاضرات الداخلة فيها، والتطبيق بيوزّع عليك الدراسة.'), h('button', { type: 'button', class: 'btn', onclick: () => openExamEdit(null) }, icon('plus', 18), 'مذاكرة أو امتحان'))),
    past.length ? h('details', { class: 'past-exams' }, h('summary', null, `امتحانات مضت (${past.length})`), h('div', { class: 'group rows' }, past.reverse().map((e) => h('button', { type: 'button', class: 'row', onclick: () => openExam(e.id) },
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, `${e.kindLabel}: ${e.subjectName}`), h('span', { class: 'row-sub' }, shortDate(e.date))),
      e.grade != null ? h('span', { class: 'pill accent' }, `${e.grade}${e.outOf ? `/${e.outOf}` : ''}`) : h('span', { class: 'pill' }, 'سجّل العلامة'))))) : null,
    secTitle('المواد', { ic: 'grad', count: subs.length, action: h('button', { type: 'button', class: 'link-btn', onclick: () => openSubjectEdit(null) }, icon('plus', 16), 'مادة') }),
    // المواد بطاقات بصورها بعمودين، والمادة اللي امتحانها قريب عليها علامة
    subs.length ? h('div', { class: 'ic-grid' }, subs.map((s) => {
      const next = (s.lectures || []).find((l) => (l.mastery || 0) < 100);
      const ex = upcoming.find((e) => e.subjectId === s.id);
      return itemCard({
        tint: s.color || 'sky', ic: s.icon || 'grad', image: s.image, title: s.name,
        sub: `${(s.lectures || []).length} محاضرة${next ? ` · التالية ${next.title}` : s.lectures?.length ? ' · كلها ثابتة' : ''}`,
        pct: unitsProgress(s.lectures), tag: ex ? `${ex.kindLabel} ${inDaysText(daysBetween(today, ex.date))}` : null,
        onClick: () => ctx.open(`tracks/subject/${s.id}`),
      });
    })) : empty('grad', 'أضف مواد الفصل ومحاضراتها، وكل محاضرة بتصير مهمة بلمسة.', h('button', { type: 'button', class: 'btn', onclick: () => openSubjectEdit(null) }, icon('plus', 18), 'مادة جديدة')));
}
export function studyActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'إضافة', onclick: () => openActions('إضافة', [{ icon: 'grad', label: 'مادة جديدة', run: () => openSubjectEdit(null) }, { icon: 'calCheck', label: 'مذاكرة أو امتحان', run: () => openExamEdit(null) }, { icon: 'share-nodes', label: 'شارك المذاكرات', run: () => openShareExams() }]) }, icon('plus', 20)); }

/* ---------- صفحة المادة ---------- */
export function renderSubject(ctx) {
  const s = subjectById(ctx.params.id);
  if (!s) return h('div', { class: 'empty' }, 'المادة مش موجودة');
  const today = ctx.today;
  const p = unitsProgress(s.lectures);
  const spent = (s.lectures || []).reduce((a, l) => a + (l.spent || 0), 0);
  const exams = (store.state.exams || []).filter((e) => e.subjectId === s.id && e.date >= today).map(examView);
  const root = h('div', null,
    h('div', { class: 'item-hero', style: { '--tint': tintHex(s.color) } },
      badge(s.icon || 'grad', s.color, 64, s.image),
      h('div', null, h('strong', null, s.name), h('small', null, `${(s.lectures || []).length} محاضرة — ${(s.lectures || []).filter((l) => (l.mastery || 0) >= 100).length} ثابتة${spent ? ` — ${durText(spent / 60)} دراسة` : ''}`), bar(p))),
    exams.length ? h('div', { class: 'exam-list' }, exams.map((e) => examCard(e, today))) : null,
    secTitle('المحاضرات', { ic: 'list', action: h('button', { type: 'button', class: 'link-btn', onclick: () => openAddLectures(s.id) }, icon('plus', 16), 'أضف') }),
    (s.lectures || []).length ? h('div', { class: 'group rows' }, s.lectures.map((l, i) => lectureRow(s, l, i, today))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'أضف محاضرات المادة (بالعدد أو بالأسماء).'), h('button', { type: 'button', class: 'btn', onclick: () => openAddLectures(s.id) }, icon('plus', 18), 'أضف محاضرات'))));
  root.dataset.title = s.name;
  return root;
}
export function subjectActions(ctx) {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'خيارات', onclick: () => openActions('المادة', [
    { icon: 'edit', label: 'تعديل المادة', run: () => openSubjectEdit(ctx.params.id) },
    { icon: 'plus', label: 'أضف محاضرات', run: () => openAddLectures(ctx.params.id) },
    { icon: 'calCheck', label: 'مذاكرة أو امتحان لهالمادة', run: () => openExamEdit(null, { subjectId: ctx.params.id }) },
  ]) }, icon('more', 20));
}

function lectureRow(s, l, i, today) {
  const m = l.mastery || 0;
  return h('div', { class: 'row lect-row' },
    h('button', { type: 'button', class: 'row-tap', onclick: () => openLecture(s.id, l.id) },
      l.image ? badge('grad', s.color, 40, l.image) : h('span', { class: 'lect-num num' }, String(i + 1)),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, l.title), h('span', { class: 'row-sub' }, `${masteryLabel(m)}${l.spent ? ` — ${durText(l.spent / 60)}` : ''}`), h('span', { class: 'mastery-dots' }, [50, 75, 100].map((v) => h('i', { class: m >= v ? 'on' : '' }))))),
    h('button', { type: 'button', class: `btn small ${m >= 100 ? 'secondary' : ''}`, onclick: () => startLecture(s, l, today) }, icon('play', 14), m >= 100 ? 'راجع' : 'ادرس'));
}

function startLecture(s, l, today) {
  openFocus({
    title: l.title, sub: s.name, image: l.image || s.image, color: tintHex(s.color), notes: l.notes || '',
    ref: { kind: 'lecture', itemId: s.id, unitId: l.id },
    onNotes: (v) => store.update((st) => { const x = st.subjects.find((y) => y.id === s.id)?.lectures.find((z) => z.id === l.id); if (x) x.notes = v; }, { silent: true }),
    finishOptions: [
      { label: 'درستها أول مرة', sub: 'الإتقان 50%', value: 50 },
      { label: 'راجعتها', sub: 'الإتقان 75%', value: 75 },
      { label: 'ثبّتها وصرت متقن', sub: 'الإتقان 100%', value: 100 },
    ],
    onFinish: (sec, v) => {
      studyUnit('subject', s.id, l.id, { mastery: v == null ? (l.mastery || 0) : Math.max(v, l.mastery || 0), seconds: sec, day: today });
      if (v) toast(`${l.title}: ${masteryLabel(v)}`);
    },
  });
}

function openLecture(sid, lid) {
  const today = logicalToday();
  openSheet('المحاضرة', (body, close, { setTitle }) => {
    function render() {
      const s = subjectById(sid);
      const l = s?.lectures.find((x) => x.id === lid);
      if (!l) { close(); return; }
      setTitle(l.title);
      const set = (patch) => { store.update((st) => { Object.assign(st.subjects.find((y) => y.id === sid).lectures.find((z) => z.id === lid), patch); }); render(); };
      fill(body, [
        h('div', { class: 'lect-head' },
          h('button', { type: 'button', class: 'lect-img', 'aria-label': 'صورة المحاضرة', onclick: async () => { const img = await pickImage(); if (img) set({ image: img }); } }, l.image ? h('img', { src: l.image, alt: '', onload: lowResCheck }) : [icon('image', 26), h('small', null, 'صورة')]),
          h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: l.title, onchange: (e) => set({ title: e.target.value.trim() || l.title }) }))),
        h('div', { class: 'sheet-section' }, 'الإتقان'),
        h('div', { class: 'mastery-grid' }, MASTERY_STEPS.map((st) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String((l.mastery || 0) === st.v), onclick: () => { if (st.v > (l.mastery || 0)) studyUnit('subject', sid, lid, { mastery: st.v, day: today }); else set({ mastery: st.v, done: st.v >= 100 }); render(); } }, `${st.v}% ${st.label}`))),
        h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'ملاحظات المحاضرة'), h('textarea', { rows: 3, onchange: (e) => set({ notes: e.target.value }) }, l.notes || '')),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'رابط PDF (اختياري)'),
          h('input', { type: 'url', dir: 'ltr', value: l.pdf || '', placeholder: 'https://…', onchange: (e) => { const v = e.target.value.trim(); if (v && !/^https?:\/\//i.test(v)) { toast('الرابط لازم يبلّش بـ https://', { kind: 'warn' }); return; } set({ pdf: v || null }); } }),
          h('span', { class: 'field-hint' }, 'بيطلع زر PDF جنب المحاضرة بصفحة المذاكرة وبالمشاركة مع رفقاتك')),
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'btn', onclick: () => { close(); setTimeout(() => startLecture(s, l, today), 250); } }, icon('play', 16), 'ابدأ دراسة'),
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { addTask({ title: `${s.name}: ${l.title}`, date: today, tag: 'study', link: { kind: 'lecture', itemId: sid, unitId: lid, image: l.image || s.image || null } }); toast('انضافت لمهام اليوم'); } }, icon('plus', 16), 'لمهام اليوم')),
        l.image ? h('button', { type: 'button', class: 'btn danger block', onclick: () => set({ image: null }) }, 'شيل الصورة') : null,
        h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف المحاضرة', `حذف «${l.title}»؟`, 'احذف')) { store.update((st) => { const x = st.subjects.find((y) => y.id === sid); x.lectures = x.lectures.filter((z) => z.id !== lid); }); close(); } } }, 'حذف المحاضرة'),
      ]);
    }
    render();
  });
}

function openAddLectures(sid) {
  openSheet('أضف محاضرات', (body, close) => {
    let count = 5, prefix = 'محاضرة', names = '';
    fill(body, [
      h('p', { class: 'hint' }, 'إما بعدد (محاضرة 1، 2، 3…) أو اكتب الأسماء كل وحدة بسطر.'),
      h('div', { class: 'two' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العدد'), h('input', { type: 'number', value: count, oninput: (e) => { count = Number(e.target.value) || 0; } })),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'البادئة'), h('input', { type: 'text', value: prefix, oninput: (e) => { prefix = e.target.value; } }))),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'أو الأسماء'), h('textarea', { rows: 4, placeholder: 'مدخل إلى النسج\nالنسج الظهاري\n…', oninput: (e) => { names = e.target.value; } })),
      h('button', { type: 'button', class: 'btn block', onclick: () => {
        const list = names.split('\n').map((x) => x.trim()).filter(Boolean);
        if (list.length) store.update((st) => { const s = st.subjects.find((y) => y.id === sid); for (const n of list) s.lectures.push({ id: uid('u'), title: n, image: null, mastery: 0, times: 0, spent: 0, estimate: 0, done: false }); });
        else if (count > 0) addUnits('subject', sid, Math.min(200, count), prefix || 'محاضرة');
        close(); toast('انضافت المحاضرات');
      } }, 'أضف'),
    ]);
  });
}

export function openSubjectEdit(id) {
  const ex = id ? subjectById(id) : null;
  const d = ex ? { name: ex.name, color: ex.color, icon: ex.icon || 'grad', image: ex.image, core: ex.core, level: ex.level, rhythm: ex.rhythm } : { name: '', color: 'sky', icon: 'grad', image: null, core: false };
  openSheet(ex ? 'تعديل المادة' : 'مادة جديدة', (body, close) => {
    function render() {
      fill(body, [
        h('div', { class: 'lect-head' },
          h('button', { type: 'button', class: 'lect-img', onclick: async () => { const img = await pickImage(); if (img) { d.image = img; render(); } } }, d.image ? h('img', { src: d.image, alt: '', onload: lowResCheck }) : [icon('image', 26), h('small', null, 'صورة')]),
          h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'اسم المادة'), h('input', { type: 'text', value: d.name, 'data-autofocus': true, placeholder: 'متل: نسج خاص نظري', oninput: (e) => { d.name = e.target.value; } }))),
        h('div', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'اللون والأيقونة'),
          h('div', { class: 'tint-row' }, TINT_KEYS.map((k) => h('button', { type: 'button', class: 'tint-dot', 'aria-pressed': String(d.color === k), style: { '--tint': tintHex(k) }, onclick: () => { d.color = k; render(); } }))),
          h('div', { class: 'icon-grid', style: { marginTop: '10px' } }, ['grad', 'book', 'tooth', 'brain', 'pill', 'bulb', 'feather', 'compass'].map((ic) => h('button', { type: 'button', class: 'icon-choice', 'aria-pressed': String(d.icon === ic), style: { '--tint': tintHex(d.color) }, onclick: () => { d.icon = ic; render(); } }, icon(ic, 20))))),
        h('button', { type: 'button', class: 'btn block', onclick: () => {
          if (!d.name.trim()) { toast('اكتب اسم المادة.', { kind: 'warn' }); return; }
          store.update((st) => { if (ex) Object.assign(st.subjects.find((y) => y.id === id), { ...d, name: d.name.trim() }); else st.subjects.push({ id: uid('sub'), ...d, name: d.name.trim(), lectures: [] }); });
          close();
        } }, ex ? 'احفظ' : 'أضف المادة'),
        ex ? h('button', { type: 'button', class: 'btn danger block', onclick: async () => { if (await confirmSheet('حذف المادة', `حذف «${ex.name}» ومحاضراتها؟`, 'احذف')) { store.update((st) => { st.subjects = st.subjects.filter((y) => y.id !== id); st.exams = st.exams.filter((e) => e.subjectId !== id); }); close(); history.back(); } } }, 'حذف المادة') : null,
      ]);
    }
    render();
  });
}
