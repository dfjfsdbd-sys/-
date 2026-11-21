// الدراسة: المواد ومحاضراتها، وجدول المذاكرات والامتحانات (تاريخ، محاضرات داخلة، جاهزيتك، وخطة مذاكرة)
import { h, icon, badge, bar, ring, fill, openSheet, toast, haptic, chips, openDatePicker, openTimePicker, confirmSheet, pickImage, empty, openActions } from '../ui.js';
import { store, uid } from '../store.js';
import { logicalToday } from '../prayer.js';
import { addDays, dayLabel, shortDate, daysBetween, parseISO, MONTHS, WEEKDAYS, time12, durText, daysText } from '../dates.js';
import { MASTERY_STEPS, masteryLabel, studyUnit, unitsProgress, addUnits } from '../library.js';
import { addTask } from '../tasks.js';
import { openFocus } from './focus.js';
import { secTitle } from './components.js';
import { ITEM_ICON_CHOICES, TINT_KEYS, tintHex } from '../icons.js';

export const EXAM_KINDS = { quiz: 'مذاكرة', final: 'امتحان نهائي', practical: 'امتحان عملي', oral: 'شفهي', other: 'تقييم' };
const subjectById = (id) => store.state.subjects.find((x) => x.id === id);

export function examsBetween(from, to) {
  return (store.state.exams || []).filter((e) => e.date >= from && e.date <= to).map(examView).sort((a, b) => a.date.localeCompare(b.date));
}
function examView(e) {
  const s = subjectById(e.subjectId);
  const lects = (s?.lectures || []).filter((l) => e.lectureIds?.includes(l.id));
  return { ...e, subjectName: s?.name || 'مادة محذوفة', subjectColor: s?.color, kindLabel: EXAM_KINDS[e.kind] || 'امتحان', lectures: lects.length, ready: lects.length ? unitsProgress(lects) : 0, lectureList: lects };
}

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
    secTitle('المذاكرات والامتحانات', { ic: 'calCheck', count: upcoming.length || null, action: h('button', { type: 'button', class: 'link-btn', onclick: () => openExamEdit(null) }, icon('plus', 16), 'إضافة') }),
    upcoming.length ? h('div', { class: 'exam-list' }, upcoming.map((e) => examCard(e, today))) : h('div', { class: 'group' }, h('div', { class: 'empty small' }, h('p', null, 'سجّل مذاكراتك وامتحاناتك بتواريخها والمحاضرات الداخلة فيها، والتطبيق بيوزّع عليك الدراسة.'), h('button', { type: 'button', class: 'btn', onclick: () => openExamEdit(null) }, icon('plus', 18), 'مذاكرة أو امتحان'))),
    past.length ? h('details', { class: 'past-exams' }, h('summary', null, `امتحانات مضت (${past.length})`), h('div', { class: 'group rows' }, past.reverse().map((e) => h('button', { type: 'button', class: 'row', onclick: () => openExam(e.id) },
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, `${e.kindLabel}: ${e.subjectName}`), h('span', { class: 'row-sub' }, shortDate(e.date))),
      e.grade != null ? h('span', { class: 'pill accent' }, `${e.grade}${e.outOf ? `/${e.outOf}` : ''}`) : h('span', { class: 'pill' }, 'سجّل العلامة'))))) : null,
    secTitle('المواد', { ic: 'grad', count: subs.length, action: h('button', { type: 'button', class: 'link-btn', onclick: () => openSubjectEdit(null) }, icon('plus', 16), 'مادة') }),
    subs.length ? h('div', { class: 'sub-grid' }, subs.map((s) => {
      const p = unitsProgress(s.lectures);
      const next = (s.lectures || []).find((l) => (l.mastery || 0) < 100);
      const ex = upcoming.find((e) => e.subjectId === s.id);
      return h('button', { type: 'button', class: 'sub-card', style: { '--tint': tintHex(s.color) }, onclick: () => ctx.open(`tracks/subject/${s.id}`) },
        h('div', { class: 'sc-top' }, badge(s.icon || 'grad', s.color, 40, s.image), ex ? h('span', { class: 'pill warn' }, `${ex.kindLabel} ${daysBetween(today, ex.date)} يوم`) : null),
        h('b', null, s.name),
        h('small', null, `${(s.lectures || []).length} محاضرة — ${Math.round(p * 100)}%`),
        bar(p, { cls: 'thin' }),
        next ? h('span', { class: 'sc-next' }, `التالي: ${next.title}`) : (s.lectures?.length ? h('span', { class: 'sc-next good' }, 'كلها ثابتة') : null));
    })) : empty('grad', 'أضف مواد الفصل ومحاضراتها، وكل محاضرة بتصير مهمة بلمسة.', h('button', { type: 'button', class: 'btn', onclick: () => openSubjectEdit(null) }, icon('plus', 18), 'مادة جديدة')));
}
export function studyActions() { return h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'إضافة', onclick: () => openActions('إضافة', [{ icon: 'grad', label: 'مادة جديدة', run: () => openSubjectEdit(null) }, { icon: 'calCheck', label: 'مذاكرة أو امتحان', run: () => openExamEdit(null) }]) }, icon('plus', 20)); }

function examCard(e, today) {
  const d = parseISO(e.date);
  const n = daysBetween(today, e.date);
  const left = e.lectureList.filter((l) => (l.mastery || 0) < 75).length;
  return h('button', { type: 'button', class: `exam-card${n <= 3 ? ' soon' : ''}`, style: { '--tint': tintHex(e.subjectColor) }, onclick: () => openExam(e.id) },
    h('div', { class: 'ex-date' }, h('b', { class: 'num' }, String(d.getDate())), h('small', null, MONTHS[d.getMonth()]), h('span', null, WEEKDAYS[d.getDay()])),
    h('div', { class: 'ex-main' },
      h('div', { class: 'ex-title' }, h('span', { class: 'pill tint' }, e.kindLabel), h('b', null, e.subjectName)),
      h('small', null, `${e.lectures} محاضرة${e.time ? ` — ${time12(e.time)}` : ''}${e.place ? ` — ${e.place}` : ''}`),
      h('div', { class: 'ex-ready' }, bar(e.ready, { cls: `thin ${e.ready >= 0.75 ? 'good' : e.ready >= 0.5 ? '' : 'warn'}` }), h('span', null, `جاهزيتك ${Math.round(e.ready * 100)}%`))),
    h('div', { class: 'ex-count' }, h('b', { class: 'num' }, n === 0 ? 'اليوم' : String(n)), n ? h('small', null, n === 1 ? 'يوم' : 'أيام') : null, left ? h('span', null, `${left} باقية`) : null));
}

export function openExam(id) {
  const today = logicalToday();
  openSheet('الامتحان', (body, close, { setTitle }) => {
    function render() {
      const raw = (store.state.exams || []).find((x) => x.id === id);
      if (!raw) { close(); return; }
      const e = examView(raw);
      setTitle(`${e.kindLabel}: ${e.subjectName}`);
      const n = daysBetween(today, e.date);
      const notReady = e.lectureList.filter((l) => (l.mastery || 0) < 75);
      const perDay = n > 0 ? Math.ceil(notReady.length / Math.max(1, n - 1 || 1)) : notReady.length;
      fill(body, [
        h('div', { class: 'gl-head' }, ring(e.ready, 64, { stroke: 5, color: 'var(--sky)', label: `${Math.round(e.ready * 100)}%` }),
          h('div', null, h('strong', null, dayLabel(e.date, today)), h('small', null, `${shortDate(e.date)}${e.time ? ` — ${time12(e.time)}` : ''}${e.place ? ` — ${e.place}` : ''}`),
            h('span', { class: `pill ${n <= 3 ? 'warn' : 'accent'}` }, n > 0 ? `بعد ${daysText(n)}` : n === 0 ? 'اليوم' : 'مضى'))),
        n > 0 && notReady.length ? h('div', { class: 'banner', style: { margin: '0 0 12px' } }, h('span', { class: 'banner-ic' }, icon('bulb', 20)),
          h('p', null, `باقي ${notReady.length} محاضرة ما راجعتها. إذا درست ${perDay} باليوم بتخلص قبل الامتحان بيوم.`)) : null,
        n > 0 && notReady.length ? h('button', { type: 'button', class: 'btn block', style: { marginTop: 0, marginBottom: '12px' }, onclick: () => { planExam(raw, notReady, today); close(); } }, icon('calendar', 18), 'وزّعها على الأيام كمهام') : null,
        h('div', { class: 'sheet-section' }, `المحاضرات الداخلة (${e.lectures})`),
        h('div', { class: 'rows sheet-rows' }, e.lectureList.length ? e.lectureList.map((l) => h('div', { class: 'row' },
          badge('grad', e.subjectColor || 'sky', 32, l.image),
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, l.title), h('span', { class: 'row-sub' }, masteryLabel(l.mastery || 0))),
          h('span', { class: `pill ${(l.mastery || 0) >= 75 ? 'good' : (l.mastery || 0) >= 50 ? 'accent' : ''}` }, `${l.mastery || 0}%`))) : h('div', { class: 'row-note' }, 'ما حددت محاضرات — اضغط عدّل.')),
        e.date < today || e.grade != null ? h('div', { class: 'two' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'العلامة'), h('input', { type: 'number', value: e.grade ?? '', onchange: (ev) => store.update((s) => { s.exams.find((x) => x.id === id).grade = ev.target.value === '' ? null : Number(ev.target.value); }) })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'من'), h('input', { type: 'number', value: e.outOf ?? 100, onchange: (ev) => store.update((s) => { s.exams.find((x) => x.id === id).outOf = Number(ev.target.value) || 100; }) }))) : null,
        e.notes ? h('p', { class: 'muted', style: { margin: '6px 2px 12px' } }, e.notes) : null,
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'btn secondary', onclick: () => { close(); setTimeout(() => openExamEdit(id), 250); } }, icon('edit', 16), 'عدّل'),
          h('button', { type: 'button', class: 'btn danger', onclick: async () => { if (await confirmSheet('حذف', 'حذف هالامتحان؟', 'احذف')) { store.update((s) => { s.exams = s.exams.filter((x) => x.id !== id); }); close(); } } }, icon('trash', 16), 'حذف')),
      ]);
    }
    render();
  });
}

// توزيع المحاضرات الباقية على الأيام قبل الامتحان (آخر يوم للمراجعة العامة)
function planExam(e, lects, today) {
  const n = daysBetween(today, e.date);
  const days = Math.max(1, n - 1);
  const per = Math.ceil(lects.length / days);
  let i = 0;
  const s = subjectById(e.subjectId);
  for (let d = 0; d < days && i < lects.length; d++) {
    const date = addDays(today, d);
    for (let k = 0; k < per && i < lects.length; k++, i++) {
      const l = lects[i];
      addTask({ title: `${s?.name}: ${l.title}`, date, tag: 'study', link: { kind: 'lecture', itemId: e.subjectId, unitId: l.id, image: l.image || s?.image || null }, period: null });
    }
  }
  if (n > 1) addTask({ title: `مراجعة عامة: ${s?.name} (${EXAM_KINDS[e.kind]})`, date: addDays(e.date, -1), tag: 'study', priority: 1 });
  toast(`انوزّعت ${lects.length} محاضرة على ${daysText(days)}`);
}

export function openExamEdit(id, preset = {}) {
  const ex = id ? store.state.exams.find((x) => x.id === id) : null;
  const d = ex ? JSON.parse(JSON.stringify(ex)) : { kind: 'quiz', subjectId: preset.subjectId || store.state.subjects[0]?.id || null, date: addDays(logicalToday(), 7), time: null, place: '', lectureIds: [], notes: '' };
  if (!store.state.subjects.length) { toast('أضف مادة أول.', { kind: 'warn' }); openSubjectEdit(null); return; }
  openSheet(ex ? 'تعديل الامتحان' : 'مذاكرة أو امتحان', (body, close) => {
    function render() {
      const s = subjectById(d.subjectId);
      fill(body, [
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'النوع'), chips(Object.entries(EXAM_KINDS).map(([v, l]) => ({ value: v, label: l })), d.kind, (v) => { d.kind = v; render(); })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'المادة'), chips(store.state.subjects.map((x) => ({ value: x.id, label: x.name, tint: tintHex(x.color) })), d.subjectId, (v) => { d.subjectId = v; d.lectureIds = []; render(); })),
        h('div', { class: 'two' },
          h('button', { type: 'button', class: 'select-btn', onclick: () => openDatePicker({ value: d.date, today: logicalToday(), title: 'تاريخ الامتحان', onPick: (v) => { if (v) d.date = v; render(); } }) }, icon('calendar', 18), h('span', { class: 'sb-val' }, shortDate(d.date))),
          h('button', { type: 'button', class: 'select-btn', onclick: () => openTimePicker({ value: d.time, onPick: (v) => { d.time = v; render(); } }) }, icon('clock', 18), h('span', { class: d.time ? 'sb-val' : 'sb-val ph' }, d.time ? time12(d.time) : 'الساعة'))),
        h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'المكان (اختياري)'), h('input', { type: 'text', value: d.place || '', placeholder: 'القاعة، المخبر…', oninput: (ev) => { d.place = ev.target.value; } })),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, `المحاضرات الداخلة (${d.lectureIds.length})`),
          s?.lectures?.length ? [
            h('div', { class: 'chips', style: { marginBottom: '8px' } },
              h('button', { type: 'button', class: 'chip small', onclick: () => { d.lectureIds = s.lectures.map((l) => l.id); render(); } }, 'الكل'),
              h('button', { type: 'button', class: 'chip small', onclick: () => { d.lectureIds = []; render(); } }, 'ولا وحدة')),
            h('div', { class: 'lect-pick' }, s.lectures.map((l, i) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String(d.lectureIds.includes(l.id)), onclick: () => { d.lectureIds = d.lectureIds.includes(l.id) ? d.lectureIds.filter((x) => x !== l.id) : [...d.lectureIds, l.id]; render(); } }, l.title || `محاضرة ${i + 1}`)))]
            : h('p', { class: 'field-hint' }, 'هالمادة ما فيها محاضرات بعد — أضفها من صفحة المادة.')),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'ملاحظات'), h('textarea', { rows: 2, placeholder: 'متل: المذاكرة من النظري بس', oninput: (ev) => { d.notes = ev.target.value; } }, d.notes || '')),
        h('button', { type: 'button', class: 'btn block', onclick: () => {
          if (!d.subjectId || !d.date) { toast('اختار المادة والتاريخ.', { kind: 'warn' }); return; }
          store.update((st) => { if (ex) { const i = st.exams.findIndex((x) => x.id === id); st.exams[i] = { ...st.exams[i], ...d }; } else st.exams.push({ id: uid('ex'), ...d, createdAt: Date.now() }); });
          close(); toast(ex ? 'انحفظ' : `انضاف ${EXAM_KINDS[d.kind]} ${shortDate(d.date)}`);
        } }, ex ? 'احفظ' : 'أضف'),
      ]);
    }
    render();
  });
}

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
          h('button', { type: 'button', class: 'lect-img', 'aria-label': 'صورة المحاضرة', onclick: async () => { const img = await pickImage(); if (img) set({ image: img }); } }, l.image ? h('img', { src: l.image, alt: '' }) : [icon('image', 26), h('small', null, 'صورة')]),
          h('label', { class: 'field', style: { flex: 1, margin: 0 } }, h('span', { class: 'field-label' }, 'الاسم'), h('input', { type: 'text', value: l.title, onchange: (e) => set({ title: e.target.value.trim() || l.title }) }))),
        h('div', { class: 'sheet-section' }, 'الإتقان'),
        h('div', { class: 'mastery-grid' }, MASTERY_STEPS.map((st) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String((l.mastery || 0) === st.v), onclick: () => { if (st.v > (l.mastery || 0)) studyUnit('subject', sid, lid, { mastery: st.v, day: today }); else set({ mastery: st.v, done: st.v >= 100 }); render(); } }, `${st.v}% ${st.label}`))),
        h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', { class: 'field-label' }, 'ملاحظات المحاضرة'), h('textarea', { rows: 3, onchange: (e) => set({ notes: e.target.value }) }, l.notes || '')),
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
          h('button', { type: 'button', class: 'lect-img', onclick: async () => { const img = await pickImage(); if (img) { d.image = img; render(); } } }, d.image ? h('img', { src: d.image, alt: '' }) : [icon('image', 26), h('small', null, 'صورة')]),
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
