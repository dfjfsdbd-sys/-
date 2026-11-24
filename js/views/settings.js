// الإعدادات: الصلاة والموقع، النوبات، التنبيهات، يوتيوب، والنسخ الاحتياطي
import { h, icon, badge, fill, openSheet, toast, haptic, chips, toggleRow, confirmSheet, openDatePicker, openTimePicker, openPicker, stepper } from '../ui.js';
import { store, backupPayload, isBackup, listSnapshots, saveManualSnapshot, APP_VERSION } from '../store.js';
import { PRAYER_METHODS, PRAYER_NAMES, adhanFor, locate, clearPrayerCache, logicalToday, hasLocation } from '../prayer.js';
import { shortDate, time12, calendarToday, WEEKDAYS, parseISO, addDays } from '../dates.js';
import { shiftSummary, SHIFT_NAMES, startFromLeave, firstWorkFromLeave } from '../shifts.js';
import { askPermission, notifySupported } from '../notify.js';
import { isLegacyBackup, fromLegacy } from '../legacy.js';
import { openChecklistRun } from './plan.js';
import { driveCfg, connectDrive, disconnectDrive, syncNow, peekRemote, applyRemote, setDriveAuto, driveStale, driveError } from '../drive.js';
import { secTitle } from './components.js';
import { routineItems } from '../routine.js';
import { openPinSetup, disableLock, setLockAfter, enableBio, disableBio, bioAvailable } from './lock.js';
import { sleepTimes, freeTotal } from '../sleep.js';
import { fromMin, inDaysText } from '../dates.js';

export function renderSettings(ctx) {
  const s = store.state.settings;
  const p = s.prayer;
  const today = ctx.today;
  const a = adhanFor(today);
  const sh = s.shift;
  const sum = shiftSummary(today);
  const setS = (fn) => store.update((st) => fn(st.settings));
  const rh = routineItems('home').length, rw = routineItems('work').length;
  const slt = sleepTimes(today);
  return h('div', null,
    h('div', { class: 'rt-links' },
      h('button', { type: 'button', class: 'rt-link', style: { '--c': '#4cb8d4' }, onclick: () => ctx.open('settings/routine') },
        h('span', { class: 'ic' }, icon('repeat', 18)),
        h('b', null, sh.enabled ? 'روتين البيت والشغل' : 'روتيني اليومي'),
        h('small', null, rh + rw ? (sh.enabled ? `${rh} للبيت · ${rw} للشغل` : `${rh} بنود`) : 'اعمله مرة وحدة وخلّي التطبيق يوزّع')),
      h('button', { type: 'button', class: 'rt-link', style: { '--c': '#6F86D9' }, onclick: () => ctx.open('settings/sleep') },
        h('span', { class: 'ic' }, icon('moon', 18)),
        h('b', null, 'الروتين الثابت والنوم'),
        h('small', null, `نوم ${time12(fromMin(slt.bed))} · فراغ ${+(freeTotal(today) / 60).toFixed(1)} س`))),
    secTitle('ملفّي والخصوصية', { ic: 'user-shield' }),
    h('div', { class: 'group rows' },
      h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('user', 16)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'أنا'), h('span', { class: 'row-sub' }, s.gender === 'female' ? 'بيطلع قسم العناية بالمكتبة' : 'بتنحسب السعرات حسبه')),
        h('div', { class: 'seg mini-seg' }, [['male', 'شاب'], ['female', 'بنت']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String((s.gender || store.state.sport.profile?.sex || 'male') === v), onclick: () => store.update((st) => { st.settings.gender = v; st.sport.profile = { ...st.sport.profile, sex: v }; }) }, l)))),
      toggleRow({ ic: 'lock', title: 'قفل التطبيق برمز', sub: 'رمز من 4 أرقام — قفل من الفضول، مش تشفير', checked: Boolean(s.lock?.on), onChange: (v) => { if (v) openPinSetup(() => ctx.refresh()); else { disableLock(); toast('انشال القفل'); } ctx.refresh(); } }),
      s.lock?.on ? [
        h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('hourglass-half', 16)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'بيقفل بعد ما تطلع')),
          h('div', { class: 'chips' }, [[0, 'فوراً'], [60, 'دقيقة'], [300, '5 دقائق']].map(([v, l]) => h('button', { type: 'button', class: 'chip small', 'aria-pressed': String((s.lock.after ?? 60) === v), onclick: () => setLockAfter(v) }, l)))),
        toggleRow({ ic: 'fingerprint', title: 'البصمة', sub: 'إذا جوالك بيدعم', checked: Boolean(s.lock.bio), onChange: async (v) => { if (v) { if (!(await bioAvailable())) { toast('جهازك ما بيدعم البصمة لتطبيقات الويب.', { kind: 'warn' }); ctx.refresh(); return; } await enableBio(); } else disableBio(); ctx.refresh(); } }),
        h('button', { type: 'button', class: 'row', onclick: () => openPinSetup() }, h('span', { class: 'row-ic' }, icon('key', 16)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'غيّر الرمز')), icon('chevL', 16)),
      ] : null),

    secTitle('الصلاة والموقع', { ic: 'mosque' }),
    h('div', { class: 'group rows' },
      h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('pin', 18)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, hasLocation() ? `${p.lat.toFixed(3)}، ${p.lng.toFixed(3)}` : 'ما تحدد الموقع'), h('span', { class: 'row-sub' }, hasLocation() ? 'الأوقات محسوبة على موقعك' : 'الأوقات تقريبية لحد ما تسمح بالموقع')),
        h('button', { type: 'button', class: 'btn small secondary', onclick: async () => { toast('عم نحدد موقعك…'); const r = await locate(); clearPrayerCache(); toast(r ? 'تحدّد موقعك وانحسبت الأوقات' : 'ما قدرنا نحدد الموقع — اسمح للتطبيق من إعدادات المتصفح', { kind: r ? 'ok' : 'warn' }); ctx.refresh(); } }, 'حدّد')),
      h('div', { class: 'row-block' }, h('div', { class: 'times-row' }, ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => h('div', null, h('small', null, PRAYER_NAMES[k]), h('b', { class: 'num' }, time12(a[k]).replace(' ', ' ')))))),
      h('button', { type: 'button', class: 'row', onclick: () => openPicker({ title: 'طريقة الحساب', value: p.method, options: Object.entries(PRAYER_METHODS).map(([k, m]) => ({ value: k, label: m.name })), onPick: (v) => { setS((x) => { x.prayer.method = v; }); clearPrayerCache(); } }) },
        h('span', { class: 'row-main' }, h('span', { class: 'row-sub' }, 'طريقة الحساب'), h('span', { class: 'row-title' }, PRAYER_METHODS[p.method]?.name)), icon('chevL', 18)),
      h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'مدة الصلاة'), h('span', { class: 'row-sub' }, 'الفترة بتبلّش بعد الأذان بهالمدة')), stepper(p.duration || 30, (v) => setS((x) => { x.prayer.duration = v; }), { min: 10, max: 60, step: 5, suffix: ' د' })),
      h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'بداية فترة الصباح'), h('span', { class: 'row-sub' }, 'بعد الشروق بـ')), stepper(s.periodOffsets?.morning || 0, (v) => setS((x) => { x.periodOffsets = { ...(x.periodOffsets || {}), morning: v }; }), { min: 0, max: 240, step: 15, suffix: ' د' })),
      h('button', { type: 'button', class: 'row', onclick: () => openTune() }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'تعديل دقائق كل صلاة'), h('span', { class: 'row-sub' }, 'مشان تطابق أذان مسجدك')), icon('chevL', 18))),

    secTitle('النوبات (البيت والشغل)', { ic: 'briefcase' }),
    h('div', { class: 'group rows' },
      toggleRow({ title: 'عندي نوبات', sub: 'أيام بالبيت وأيام بالشغل بالتناوب — بتبين بالتقويم، والتطبيق بيذكّرك تجهّز قبل كل نوبة', checked: sh.enabled, onChange: (v) => setS((x) => { x.shift.enabled = v; if (v && !x.shift.start) x.shift.start = calendarToday(); }) }),
      sh.enabled ? [
        h('button', { type: 'button', class: 'row', onclick: () => openDatePicker({ value: sh.leave?.date || null, today, title: 'بأي يوم بتطلع عالشغل؟ (أي دورة)', onPick: (v) => { if (v) setS((x) => { x.shift.leave = { date: v, time: x.shift.leave?.time || '22:30' }; x.shift.start = startFromLeave(v, x.shift.leave.time, x.shift.pattern); }); } }) },
          h('span', { class: 'row-ic' }, icon('calendar', 16)),
          h('span', { class: 'row-main' }, h('span', { class: 'row-sub' }, 'بطلع عالشغل يوم'), h('span', { class: 'row-title' }, sh.leave?.date ? `${WEEKDAYS[parseISO(sh.leave.date).getDay()]} ${shortDate(sh.leave.date)}` : 'اختار يوم طلعة (بأي دورة)')), icon('chevL', 18)),
        h('button', { type: 'button', class: 'row', onclick: () => openTimePicker({ value: sh.leave?.time || '22:30', onPick: (v) => { if (v) setS((x) => { x.shift.leave = { date: x.shift.leave?.date || calendarToday(), time: v }; x.shift.start = startFromLeave(x.shift.leave.date, v, x.shift.pattern); }); } }) },
          h('span', { class: 'row-ic' }, icon('clock', 16)),
          h('span', { class: 'row-main' }, h('span', { class: 'row-sub' }, 'الساعة'), h('span', { class: 'row-title' }, time12(sh.leave?.time || '22:30'))), icon('chevL', 18)),
        h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'أيام الشغل')), stepper(sh.pattern[1]?.days || 7, (v) => setS((x) => { x.shift.pattern[1].days = v; }), { min: 1, max: 30 })),
        h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'أيام البيت')), stepper(sh.pattern[0]?.days || 7, (v) => setS((x) => { x.shift.pattern[0].days = v; if (x.shift.leave?.date) x.shift.start = startFromLeave(x.shift.leave.date, x.shift.leave.time, x.shift.pattern); }), { min: 1, max: 30 })),
        sh.leave?.date ? h('div', { class: 'row-note' }, (() => { const fw = firstWorkFromLeave(sh.leave.date, sh.leave.time); return `يعني أيام الشغل بتبلّش ${WEEKDAYS[parseISO(fw).getDay()]}، وآخر يوم بالبيت (يوم التجهيز) ${WEEKDAYS[parseISO(addDays(fw, -1)).getDay()]}.`; })()) : null,
        sum ? h('div', { class: 'row-note' }, `اليوم: ${SHIFT_NAMES[sum.kind]} (${sum.dayNo} من ${sum.length})${sum.nextDate ? ` — ${sum.nextKind === 'work' ? 'الشغل' : 'البيت'} ${inDaysText(sum.daysLeft)}` : ''}`) : null,
        h('button', { type: 'button', class: 'row', onclick: () => openChecklistRun(null, today) }, h('span', { class: 'row-ic' }, icon('bag', 18)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'أغراض الشغل'), h('span', { class: 'row-sub' }, 'قائمة بتطلعلك آخر يوم بالبيت')), icon('chevL', 18)),
      ] : null),

    secTitle('التنبيهات', { ic: 'bell' }),
    h('div', { class: 'group rows' },
      toggleRow({ title: 'تنبيهات التطبيق', sub: notifySupported() ? 'تذكير المهام بوقتها وأنت فاتح التطبيق أو قريب منه' : 'جهازك ما بيدعم التنبيهات', checked: s.notify.enabled, onChange: async (v) => { if (v && !(await askPermission())) { toast('لازم تسمح بالتنبيهات من المتصفح.', { kind: 'warn' }); ctx.refresh(); return; } setS((x) => { x.notify.enabled = v; }); } }),
      toggleRow({ title: 'تذكير المهام', checked: s.notify.tasks !== false, onChange: (v) => setS((x) => { x.notify.tasks = v; }) }),
      toggleRow({ title: 'تنبيه الأذان', checked: Boolean(s.notify.prayers), onChange: (v) => setS((x) => { x.notify.prayers = v; }) }),
      h('div', { class: 'row-note' }, 'للتذكير المضمون حتى والتطبيق مسكّر: افتح المهمة واضغط «تقويم جوجل» — بينضاف بموعده لتقويمك وبيذكّرك تلفونك.')),

    secTitle('يوتيوب', { ic: 'youtube' }),
    h('div', { class: 'group rows' },
      h('div', { class: 'row-block' },
        h('label', { class: 'field', style: { margin: 0 } }, h('span', { class: 'field-label' }, 'مفتاح YouTube Data API (اختياري)'), h('input', { type: 'text', dir: 'ltr', value: s.ytKey || '', placeholder: 'AIza…', onchange: (e) => setS((x) => { x.ytKey = e.target.value.trim(); }) }),
          h('span', { class: 'field-hint' }, 'بدونه منجيب القوائم من خوادم عامة (أحياناً بتتعطّل). المفتاح مجاني من Google Cloud Console ← APIs ← YouTube Data API v3 ← Credentials.')))),

    secTitle('المزامنة مع جوجل درايف', { ic: 'cloud' }),
    driveSection(ctx),

    secTitle('النسخ الاحتياطي', { ic: 'shield' }),
    h('div', { class: 'group rows' },
      h('div', { class: 'row-note' }, s.lastBackupAt ? `آخر نسخة ملف: ${new Date(s.lastBackupAt).toLocaleDateString('ar-SY')}` : 'ما حفظت نسخة ملف بعد. بياناتك على هالجهاز بس — احفظ نسخة كل فترة.'),
      h('button', { type: 'button', class: 'row', onclick: exportBackup }, h('span', { class: 'row-ic' }, icon('download', 18)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'احفظ نسخة كملف'), h('span', { class: 'row-sub' }, 'خليها بدرايف أو أرسلها لحالك'))),
      h('button', { type: 'button', class: 'row', onclick: importBackup }, h('span', { class: 'row-ic' }, icon('upload', 18)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'استرجع من ملف'), h('span', { class: 'row-sub' }, 'بيقبل نسخ التطبيق القديم كمان'))),
      h('button', { type: 'button', class: 'row', onclick: openSnapshots }, h('span', { class: 'row-ic' }, icon('refresh', 18)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'نسخ تلقائية على الجهاز'), h('span', { class: 'row-sub' }, 'لقطة كل يوم (آخر 10) للرجوع عن أي خطأ')), icon('chevL', 18))),
    h('p', { class: 'footer' }, `المنظومة الإنتاجية ${APP_VERSION}`));
}

function agoText(ms) {
  if (!ms) return 'لسّا ما انرفعت';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'هلّق';
  if (m < 60) return `من ${m} دقيقة`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `من ${hr} ساعة`;
  return new Date(ms).toLocaleDateString('ar-SY');
}
function driveSection(ctx) {
  const c = driveCfg();
  const fail = (e) => toast(driveError(e), { kind: 'warn' });
  if (!c.connected) {
    return h('div', { class: 'group rows' },
      h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('cloud', 18)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'احفظ كل شي بحسابك على جوجل'), h('span', { class: 'row-sub' }, 'نسخة تلقائية بدرايفك'))),
      h('div', { class: 'row-block' }, h('button', { type: 'button', class: 'btn block', onclick: async () => {
        try {
          toast('عم نفتح تسجيل الدخول…');
          const r = await connectDrive();
          if (r.remote) offerRestore(r.remote, ctx); else toast('تربط حسابك وانرفعت نسختك', { kind: 'ok' });
          ctx.refresh();
        } catch (e) { fail(e); }
      } }, icon('cloud', 18), 'سجّل الدخول بجوجل')),
      h('div', { class: 'row-note' }, 'ما بيضيع شي إذا مسحت المتصفح أو غيّرت تلفونك. التطبيق ما بيشوف إلا ملف النسخة اللي بيعمله هو بدرايفك، وما في سيرفر بالنص.'));
  }
  return h('div', { class: 'group rows' },
    h('div', { class: 'row' }, h('span', { class: 'row-ic' }, icon('cloud', 18)),
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, c.email || 'مربوط بجوجل درايف'), h('span', { class: 'row-sub' }, c.busy ? 'عم نرفع…' : `آخر رفع: ${agoText(c.lastSync)}`)),
      driveStale() ? h('span', { class: 'pill warn' }, 'متأخرة') : h('span', { class: 'pill good' }, 'مربوط')),
    c.fromV1 ? h('div', { class: 'row-note' }, 'كنت رابط درايف بالنسخة القديمة. اضغط «ارفع هلّق» مرة وحدة لتصير نسختك الجديدة بدرايف.') : null,
    h('button', { type: 'button', class: 'row', onclick: async () => { try { toast('عم نرفع لدرايف…'); await syncNow({ silent: false }); toast('انحفظت نسختك بدرايف', { kind: 'ok' }); ctx.refresh(); } catch (e) { fail(e); } } },
      h('span', { class: 'row-ic' }, icon('upload', 18)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'ارفع هلّق'))),
    h('button', { type: 'button', class: 'row', onclick: async () => {
      try { toast('عم نجيب النسخة من درايف…'); const r = await peekRemote(); if (!r) { toast('ما في نسخة بدرايف لسّا.'); return; } offerRestore(r, ctx); } catch (e) { fail(e); }
    } }, h('span', { class: 'row-ic' }, icon('download', 18)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'رجّع من درايف'), h('span', { class: 'row-sub' }, 'مثلاً على تلفون جديد'))),
    toggleRow({ title: 'رفع تلقائي', sub: 'بعد كل تعديل بدقيقة، ومرة باليوم (طالما الإذن صالح)', checked: c.auto !== false, onChange: (v) => setDriveAuto(v) }),
    h('button', { type: 'button', class: 'row danger-row-l', onclick: async () => {
      if (!(await confirmSheet('إيقاف المزامنة', 'نسختك بدرايف بتضل متل ما هي، وبياناتك على الجهاز ما بتتأثر.', 'أوقف'))) return;
      disconnectDrive(); toast('توقفت المزامنة'); ctx.refresh();
    } }, h('span', { class: 'row-ic' }, icon('close', 18)), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, 'افصل الحساب'))));
}
async function offerRestore(remote, ctx) {
  const when = remote.modified ? new Date(remote.modified).toLocaleString('ar-SY') : '';
  const msg = `${remote.legacy ? 'نسخة من التطبيق القديم' : 'نسخة'} بتاريخ ${when}\n${remote.summary}\nبتحلّ محل بياناتك على هالجهاز (منحفظ لقطة من وضعك الحالي قبل).`;
  if (!(await confirmSheet('رجّع من درايف', msg, 'رجّع'))) return;
  await applyRemote(remote);
  toast('رجعت بياناتك من درايف', { kind: 'ok' });
  ctx.refresh();
}

function openTune() {
  openSheet('دقائق كل صلاة', (body) => {
    function render() {
      const tune = store.state.settings.prayer.tune || {};
      fill(body, [h('p', { class: 'hint' }, 'زيد أو نقّص دقائق لتطابق مسجدك.'),
        h('div', { class: 'rows sheet-rows' }, ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => h('div', { class: 'row' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, PRAYER_NAMES[k])),
          stepper(tune[k] || 0, (v) => { store.update((s) => { s.settings.prayer.tune = { ...(s.settings.prayer.tune || {}), [k]: v }; }); clearPrayerCache(); }, { min: -30, max: 30, suffix: ' د' }))))]);
    }
    render();
  });
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function exportBackup() {
  try {
    download(`manzumati-backup-${calendarToday()}.json`, JSON.stringify(backupPayload()));
    store.update((s) => { s.settings.lastBackupAt = new Date().toISOString(); });
    toast('انحفظت النسخة بالتنزيلات');
  } catch { toast('ما قدرنا نحفظ الملف.', { kind: 'warn' }); }
}
function importBackup() {
  const inp = h('input', { type: 'file', accept: 'application/json,.json,text/plain', style: { display: 'none' } });
  inp.addEventListener('change', () => {
    const f = inp.files?.[0]; inp.remove();
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      let p;
      try { p = JSON.parse(String(r.result)); } catch { toast('الملف مش نسخة صالحة.', { kind: 'warn' }); return; }
      let next = null;
      if (isBackup(p)) next = p.data;
      else if (isLegacyBackup(p)) next = fromLegacy(p);
      if (!next) { toast('الملف مش نسخة من هالتطبيق.', { kind: 'warn' }); return; }
      if (!(await confirmSheet('استرجاع', 'بتحلّ محل بياناتك الحالية. منحفظ لقطة من وضعك الحالي قبل، فيك ترجعلها.', 'استرجع'))) return;
      await saveManualSnapshot('قبل الاسترجاع');
      store.replaceAll(next);
      toast('رجعت بياناتك');
    };
    r.readAsText(f, 'utf-8');
  });
  document.body.append(inp); inp.click();
}
async function openSnapshots() {
  const list = await listSnapshots();
  openSheet('النسخ التلقائية', (body, close) => {
    fill(body, [
      list.length ? h('div', { class: 'rows sheet-rows' }, list.map((sn) => h('button', { type: 'button', class: 'row', onclick: async () => {
        if (!(await confirmSheet('استرجاع لقطة', `ترجع لوضع ${sn.manual ? sn.day : `بداية يوم ${shortDate(sn.day)}`}؟`, 'استرجع'))) return;
        await saveManualSnapshot('قبل استرجاع لقطة');
        store.replaceAll(sn.data); close(); toast('رجعت للّقطة');
      } }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, sn.manual ? sn.day : `بداية ${shortDate(sn.day)}`), h('span', { class: 'row-sub' }, `${sn.data?.tasks?.length || 0} مهمة — ${new Date(sn.at).toLocaleString('ar-SY')}`)), icon('refresh', 18)))) : h('p', { class: 'muted' }, 'أول لقطة بتنحفظ مع بداية يومك.'),
    ]);
  });
}
