/* Daymark — a local-first homeschool planner. No framework or build step required. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = 'daymark-planner-v1';
  const COLORS = ['#6f8f7b', '#6e8da8', '#c38e62', '#8f7cae', '#b77b7e', '#7b9b9b', '#9a9568'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ACTIVITY_TYPES = [
    { value: 'chapter', label: 'Chapter / section' }, { value: 'video', label: 'Video' }, { value: 'experiment', label: 'Experiment' }, { value: 'test', label: 'Test' },
    { value: 'quiz', label: 'Quiz' }, { value: 'reading', label: 'Reading' }, { value: 'lesson', label: 'Lesson' },
    { value: 'exercise', label: 'Exercise' }, { value: 'assignment', label: 'Assignment' }, { value: 'project', label: 'Project' },
    { value: 'discussion', label: 'Discussion' }, { value: 'other', label: 'Other' }
  ];
  const ACTIVITY_LABELS = Object.fromEntries(ACTIVITY_TYPES.map(item => [item.value, item.label]));
  const today = dateKey(new Date());

  function makeId(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function dateKey(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function parseDate(key) {
    if (!key) return null;
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12);
  }
  function addDays(date, amount) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    result.setDate(result.getDate() + amount);
    return result;
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function formatNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  function formatDate(key, options = {}) {
    const date = parseDate(key);
    if (!date) return 'Not set';
    const mode = state.settings.dateFormat || 'long';
    if (mode === 'iso') return key;
    if (mode === 'numeric') return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
    const opts = mode === 'short'
      ? { month: 'short', day: 'numeric', ...options }
      : { month: 'long', day: 'numeric', year: 'numeric', ...options };
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  }
  function formatLongDay(key) {
    const date = parseDate(key);
    return date ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date) : key;
  }
  function monthLabel(date) {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
  }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function starterSubjects() {
    return [
      { id: makeId('subject'), name: 'Math', curriculum: 'DIVE / Shorman Mathematics', tracking: 'minutes', dailyMinutes: 50, finishDate: '', color: COLORS[0], priority: 'normal', estimatedMinutes: 0, milestones: [], metrics: [], structureLabel: 'Chapter', chapters: [] },
      { id: makeId('subject'), name: 'Biology', curriculum: 'Berean Builders — Discovering Design with Biology', tracking: 'metrics', dailyMinutes: 0, finishDate: '', color: COLORS[1], priority: 'normal', estimatedMinutes: 0, milestones: [], metrics: [metric('pages', 'Pages', 'pages'), metric('videos', 'Videos', 'videos')], structureLabel: 'Chapter', chapters: [] },
      { id: makeId('subject'), name: 'History', curriculum: 'Biblioplan — Medieval and Church History', tracking: 'metrics', dailyMinutes: 0, finishDate: '', color: COLORS[2], priority: 'normal', estimatedMinutes: 0, milestones: [], metrics: [metric('pages', 'Reading', 'pages')], structureLabel: 'Chapter', chapters: [] },
      { id: makeId('subject'), name: 'Writing', curriculum: 'Writing and Rhetoric', tracking: 'metrics', dailyMinutes: 0, finishDate: '', color: COLORS[3], priority: 'normal', estimatedMinutes: 0, milestones: [], metrics: [metric('lessons', 'Lessons', 'lessons')], structureLabel: 'Lesson', chapters: [] }
    ];
  }
  function metric(key, label, unit, start = '', end = '', next = '') {
    return { key, label, unit, start, end, next, baselineNext: next };
  }
  function normalizeCurriculumTemplate(template) {
    const allowed = ['video', 'experiment', 'test', 'reading', 'exercise', 'quiz', 'project'];
    const counts = {};
    allowed.forEach(type => { counts[type] = clamp(Number(template.counts?.[type]) || 0, 0, 30); });
    return { id: String(template.id || makeId('template')), name: String(template.name || 'My template'), structureLabel: String(template.structureLabel || 'Chapter'), counts };
  }
  function defaultCurriculumTemplates() {
    return [
      { id: 'biology-default', name: 'Biology — 2 videos + test', structureLabel: 'Chapter', counts: { video: 2, experiment: 0, test: 1, reading: 0, exercise: 0, quiz: 0, project: 0 } },
      { id: 'lesson-default', name: 'Lesson — reading + exercises', structureLabel: 'Lesson', counts: { video: 0, experiment: 0, test: 0, reading: 1, exercise: 2, quiz: 0, project: 0 } },
      { id: 'history-default', name: 'History — reading + quiz', structureLabel: 'Unit', counts: { video: 0, experiment: 0, test: 0, reading: 1, exercise: 0, quiz: 1, project: 0 } }
    ];
  }
  function defaultState() {
    return {
      version: 7,
      settings: {
        schoolStart: '', schoolEnd: '', weekdays: [1, 2, 3, 4, 5], holidays: [],
        theme: 'light', density: 'balanced', accent: '#607d71', calendarStyle: 'blocks',
        defaultCalendar: 'month', dashboard: 'calendar', sidebarWidth: 250, fontSize: 'normal',
        dateFormat: 'long', clockFormat: '12', appScale: 100, maxDailyMinutes: 180,
        curriculumOllamaModel: ''
      },
      subjects: starterSubjects(), logs: [], manualTasks: [], taskOverrides: {}, lockedTasks: [], planSnapshots: {}, dayNotes: {},
      taskMoves: {}, curriculumTemplates: defaultCurriculumTemplates()
    };
  }
  function loadState() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
      console.warn('Browser storage is unavailable for this page.', error);
      return defaultState();
    }
    if (!raw) return defaultState();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultState();
      const base = defaultState();
      const settings = { ...base.settings, ...(parsed.settings || {}) };
      settings.weekdays = (Array.isArray(settings.weekdays) ? settings.weekdays : base.settings.weekdays).map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
      if (!settings.weekdays.length) settings.weekdays = base.settings.weekdays.slice();
      settings.holidays = Array.isArray(settings.holidays) ? settings.holidays.filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date)).map(item => ({ date: item.date, label: String(item.label || '') })) : [];
      settings.appScale = clamp(Number(settings.appScale) || 100, 80, 150);
      // V2.5 no longer uses a cloud AI Worker; discard obsolete endpoint/token settings.
      delete settings.curriculumAiEndpoint;
      delete settings.curriculumAiToken;
      settings.curriculumOllamaModel = String(settings.curriculumOllamaModel || '');
      settings.maxDailyMinutes = clamp(Number(settings.maxDailyMinutes) || 0, 0, 600);
      return {
        ...base, ...parsed, version: 7, settings,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects.filter(item => item && typeof item === 'object').map(normalizeSubject) : base.subjects,
        logs: Array.isArray(parsed.logs) ? parsed.logs.filter(item => item && typeof item === 'object') : [],
        manualTasks: Array.isArray(parsed.manualTasks) ? parsed.manualTasks.filter(item => item && typeof item === 'object') : [],
        taskOverrides: parsed.taskOverrides && typeof parsed.taskOverrides === 'object' ? parsed.taskOverrides : {},
        lockedTasks: Array.isArray(parsed.lockedTasks) ? parsed.lockedTasks : [],
        planSnapshots: parsed.planSnapshots && typeof parsed.planSnapshots === 'object' ? parsed.planSnapshots : {},
        dayNotes: parsed.dayNotes && typeof parsed.dayNotes === 'object' ? parsed.dayNotes : {},
        taskMoves: parsed.taskMoves && typeof parsed.taskMoves === 'object' ? parsed.taskMoves : {},
        curriculumTemplates: Array.isArray(parsed.curriculumTemplates) ? parsed.curriculumTemplates.filter(t => t && typeof t === 'object').map(normalizeCurriculumTemplate) : base.curriculumTemplates
      };
    } catch (error) {
      console.warn('Could not read Daymark data. Starting with a fresh planner.', error);
      return defaultState();
    }
  }
  function normalizeSubject(subject, index = 0) {
    return {
      id: subject.id || makeId('subject'), name: subject.name || 'Untitled subject', curriculum: subject.curriculum || '',
      tracking: subject.tracking || 'metrics', dailyMinutes: Math.max(1, Number(subject.dailyMinutes) || 50),
      finishDate: subject.finishDate || '', color: subject.color || COLORS[index % COLORS.length],
      priority: ['low', 'normal', 'high', 'very-high', 'urgent'].includes(subject.priority) ? subject.priority : 'normal',
      estimatedMinutes: Math.max(0, Number(subject.estimatedMinutes) || 0),
      milestones: Array.isArray(subject.milestones) ? subject.milestones.map((m, i) => ({ id: m.id || `milestone-${i + 1}`, title: String(m.title || 'Milestone'), targetDate: m.targetDate || '', completed: !!m.completed })) : [],
      structureLabel: String(subject.structureLabel || 'Chapter').trim() || 'Chapter',
      chapters: Array.isArray(subject.chapters) ? subject.chapters.map((chapter, ci) => ({
        id: chapter.id || `chapter-${ci + 1}`, number: String(chapter.number ?? ci + 1), title: String(chapter.title || `Chapter ${ci + 1}`),
        startPage: chapter.startPage === '' || chapter.startPage == null ? '' : String(chapter.startPage), endPage: chapter.endPage === '' || chapter.endPage == null ? '' : String(chapter.endPage),
        plannedDate: chapter.plannedDate || '', completed: !!chapter.completed, completedAt: chapter.completedAt || '', completedLogId: chapter.completedLogId || '',
        activities: Array.isArray(chapter.activities) ? chapter.activities.map((activity, ai) => ({
          id: activity.id || `activity-${ci + 1}-${ai + 1}`, type: ACTIVITY_TYPES.some(item => item.value === activity.type) ? activity.type : 'other',
          title: String(activity.title || 'Activity'), plannedDate: activity.plannedDate || '',
          estimatedMinutes: clamp(Number(activity.estimatedMinutes) || 0, 0, 600), completed: !!activity.completed,
          completedAt: activity.completedAt || '', note: String(activity.note || ''), completedLogId: activity.completedLogId || ''
        })) : []
      })) : [],
      metrics: Array.isArray(subject.metrics) ? subject.metrics.map((m, i) => ({
        key: m.key || `metric-${i + 1}`, label: m.label || 'Work', unit: m.unit || 'items',
        start: m.start ?? '', end: m.end ?? '', next: m.next ?? m.current ?? '', baselineNext: m.baselineNext ?? m.next ?? m.current ?? ''
      })) : []
    };
  }
  let storageAvailable = true;
  let storageWarningShown = false;
  let state = loadState();
  let selectedDate = today;
  let calendarView = state.settings.defaultCalendar || 'month';
  let calendarCursor = parseDate(today);
  let reviewCursor = parseDate(today);
  let activeView = 'overview';
  let modalAction = null;
  let modalWide = false;
  let toastTimer = null;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
      const status = $('.sidebar-footer');
      if (status) status.innerHTML = '<span class="status-dot"></span> Saved on this device';
      return true;
    } catch (error) {
      storageAvailable = false;
      console.error('Unable to save Daymark data.', error);
      const status = $('.sidebar-footer');
      if (status) status.innerHTML = '<span class="status-dot" style="background:#c39b5d"></span> Browser storage unavailable';
      if (!storageWarningShown) {
        showToast('This browser is blocking local saving. Use Data & backups to export your work.');
        storageWarningShown = true;
      }
      return false;
    }
  }
  function showToast(message) {
    const node = $('#toast');
    node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
  }
  function openModal(title, eyebrow, body, footer, onSave = null, wide = false) {
    $('#modalTitle').textContent = title;
    $('#modalEyebrow').textContent = eyebrow;
    $('#modalBody').innerHTML = body;
    $('#modalFooter').innerHTML = footer;
    $('#modalBackdrop').hidden = false;
    $('.modal', $('#modalBackdrop')).classList.toggle('wide', wide);
    modalAction = onSave; modalWide = wide;
  }
  function closeModal() {
    $('#modalBackdrop').hidden = true; modalAction = null;
  }
  function showView(name) {
    activeView = name;
    $$('.view').forEach(view => view.classList.toggle('active-view', view.id === `view-${name}`));
    $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    $('#currentSectionLabel').textContent = ({ overview: 'Overview', calendar: 'Calendar', subjects: 'Subjects', progress: 'Progress', settings: 'Settings' })[name] || 'Overview';
    $('#sidebar').classList.remove('mobile-open');
    if (name === 'calendar') { renderCalendar(); renderDayDetail(); }
    if (name === 'subjects') renderSubjects();
    if (name === 'progress') renderProgress();
    if (name === 'settings') renderSettings();
  }

  function isStudyDay(key) {
    const date = parseDate(key);
    if (!date || !state.settings.weekdays.includes(date.getDay())) return false;
    return !state.settings.holidays.some(h => h.date === key);
  }
  function nextStudyDate(fromKey = today) {
    let date = parseDate(fromKey) || parseDate(today);
    if (dateKey(date) < today) date = parseDate(today);
    for (let guard = 0; date && guard < 370; guard++, date = addDays(date, 1)) {
      if (isStudyDay(dateKey(date))) return dateKey(date);
    }
    return today;
  }
  function countStudyDays(startKey, endKey) {
    const start = parseDate(startKey), end = parseDate(endKey);
    if (!start || !end || end < start) return 0;
    let count = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) if (isStudyDay(dateKey(d))) count++;
    return count;
  }
  function getDeadline(subject) { return subject.finishDate || state.settings.schoolEnd || ''; }
  function getScheduleStart() { const start = state.settings.schoolStart || today; return start > today ? start : today; }
  function priorityMultiplier(priority = 'normal') {
    return ({ low: .75, normal: 1, high: 1.25, 'very-high': 1.5, urgent: 2 })[priority] || 1;
  }
  function priorityLabel(priority = 'normal') {
    return ({ low: 'Low', normal: 'Normal', high: 'High', 'very-high': 'Very high', urgent: 'Urgent' })[priority] || 'Normal';
  }
  function startOfWeekMonday(date) { return addDays(date, -((date.getDay() + 6) % 7)); }
  function weekDateKeys(anchor) {
    const start = startOfWeekMonday(parseDate(anchor) || parseDate(today));
    return Array.from({ length: 7 }, (_, i) => dateKey(addDays(start, i)));
  }
  function validMetric(m) {
    return m.end !== '' && Number.isFinite(Number(m.end)) && m.next !== '' && Number.isFinite(Number(m.next));
  }
  function getMetricProgress(subject, m) {
    if (!validMetric(m)) return null;
    const start = Number(m.start === '' ? m.next : m.start);
    const end = Number(m.end);
    const next = Number(m.next);
    const total = Math.max(0, end - start + 1);
    if (total <= 0) return next > end ? 100 : 0;
    return clamp(((next - start) / total) * 100, 0, 100);
  }
  function subjectProgress(subject) {
    const structure = curriculumStats(subject);
    const structureTotal = structure.chapters + structure.total;
    const structureCompleted = structure.chaptersCompleted + structure.completed;
    const structurePercent = structureTotal > 0 ? clamp((structureCompleted / structureTotal) * 100, 0, 100) : null;
    if (subject.tracking === 'minutes') {
      const minutes = state.logs.filter(log => log.subjectId === subject.id).reduce((sum, log) => sum + (Number(log.minutes) || 0), 0);
      return {
        percent: structurePercent,
        completedLabel: structurePercent === null ? `${formatNumber(minutes)} min logged` : `${structureCompleted}/${structureTotal} curriculum items · ${formatNumber(minutes)} min logged`,
        remainingLabel: structurePercent === null ? `${subject.dailyMinutes || 50} min/day` : `${Math.max(0, structureTotal - structureCompleted)} curriculum items remaining`,
        completed: structureCompleted, total: structureTotal || null
      };
    }
    const metricValues = subject.metrics.map(m => ({ metric: m, percent: getMetricProgress(subject, m) })).filter(x => x.percent !== null);
    if (structurePercent !== null) metricValues.push({ metric: null, percent: structurePercent });
    const milestoneTotal = (subject.milestones || []).length;
    const milestoneDone = (subject.milestones || []).filter(item => item.completed).length;
    if (milestoneTotal) metricValues.push({ metric: null, percent: (milestoneDone / milestoneTotal) * 100 });
    if (!metricValues.length) return { percent: null, completedLabel: 'Targets not set', remainingLabel: 'Add curriculum sections, activities, or a tracker range', completed: 0, total: 0 };
    const avg = metricValues.reduce((sum, x) => sum + x.percent, 0) / metricValues.length;
    const metricItemsRemaining = metricValues.filter(x => x.metric && x.percent < 100).length;
    const structureRemaining = structureTotal ? Math.max(0, structureTotal - structureCompleted) : 0;
    const remainingParts = [];
    if (metricItemsRemaining) remainingParts.push(`${metricItemsRemaining} tracker${metricItemsRemaining === 1 ? '' : 's'}`);
    if (structureRemaining) remainingParts.push(`${structureRemaining} chapter / activity items`);
    return {
      percent: avg,
      completedLabel: `${Math.round(avg)}% complete`,
      remainingLabel: remainingParts.length ? `${remainingParts.join(' · ')} remaining` : 'All tracked work complete',
      completed: structureCompleted, total: structureTotal || metricValues.length
    };
  }
  function dateAfterStudySessions(startKey, sessions) {
    let date = parseDate(startKey) || parseDate(today), count = 0, guard = 0;
    while (date && count < sessions && guard < 5000) {
      if (isStudyDay(dateKey(date))) count++;
      if (count >= sessions) return dateKey(date);
      date = addDays(date, 1); guard++;
    }
    return count >= sessions ? dateKey(date) : null;
  }
  function metricPrediction(subject, metricItem) {
    if (!validMetric(metricItem)) return null;
    const remaining = Math.max(0, Number(metricItem.end) - Number(metricItem.next) + 1);
    if (!remaining) return today;
    const logs = state.logs.filter(log => log.subjectId === subject.id && (log.metricKey ? log.metricKey === metricItem.key : log.unit === metricItem.unit) && Number(log.quantity) > 0);
    let dailyPace = 0;
    if (logs.length) {
      const firstDate = logs.map(log => log.date).filter(Boolean).sort()[0];
      const elapsed = Math.max(1, countStudyDays(firstDate || today, today));
      dailyPace = logs.reduce((sum, log) => sum + Number(log.quantity || 0), 0) / elapsed;
    }
    const deadline = getDeadline(subject), scheduleStart = getScheduleStart();
    if (!dailyPace && deadline && deadline >= scheduleStart) {
      const available = Math.max(1, countStudyDays(scheduleStart, deadline));
      dailyPace = (remaining / available) * priorityMultiplier(subject.priority);
    } else if (dailyPace) {
      dailyPace *= priorityMultiplier(subject.priority);
    }
    return dailyPace > 0 ? dateAfterStudySessions(scheduleStart, Math.max(1, Math.ceil(remaining / dailyPace))) : null;
  }
  function subjectPrediction(subject) {
    if (subject.tracking === 'minutes') return null;
    const dates = subject.metrics.map(item => metricPrediction(subject, item)).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }
  function expectedProgress(subject) {
    const deadline = getDeadline(subject), start = state.settings.schoolStart || today;
    if (!deadline || deadline <= start || today < start) return 0;
    const total = countStudyDays(start, deadline);
    if (!total) return 0;
    return clamp((countStudyDays(start, today > deadline ? deadline : today) / total) * 100, 0, 100);
  }
  function formatRange(metricItem, start, quantity) {
    if (!metricItem) return `${formatNumber(quantity)} minutes`;
    return `${metricItem.label} ${formatNumber(start)}–${formatNumber(Math.min(Number(metricItem.end), Number(start) + Math.max(1, Number(quantity)) - 1))}`;
  }

  function metricDailyTarget(subject, metricItem, deadline) {
    const remaining = Number(metricItem.end) - Number(metricItem.next) + 1;
    const availableDays = countStudyDays(getScheduleStart(), deadline);
    if (remaining <= 0 || availableDays <= 0) return 0;
    // A steady priority-adjusted pace makes higher importance genuinely finish sooner.
    return Math.min(remaining, Math.max(1, Math.ceil((remaining / availableDays) * priorityMultiplier(subject.priority))));
  }
  function projectedMetricStart(subject, metricItem, key, baselineTarget) {
    let projected = Number(metricItem.next);
    const deadline = getDeadline(subject);
    const scheduleStart = getScheduleStart();
    if (!deadline || key <= scheduleStart || !baselineTarget) return projected;
    const targetDate = parseDate(key);
    for (let date = parseDate(scheduleStart); date && date < targetDate; date = addDays(date, 1)) {
      const dayKey = dateKey(date);
      if (dayKey > deadline || !isStudyDay(dayKey)) continue;
      const taskId = `scheduled:${dayKey}:${subject.id}:${metricItem.key}`;
      const movedForDay = Object.entries(state.taskMoves || {}).find(([id, record]) =>
        record && record.date === dayKey && record.subjectId === subject.id && record.metricKey === metricItem.key
      );
      if (movedForDay) {
        if (dayKey < dateKey(targetDate)) projected += Math.max(0, Number(movedForDay[1].quantity) || 0);
        continue;
      }
      // If the original day's assignment was moved elsewhere, the old slot is empty.
      if (state.taskMoves?.[taskId]) continue;
      // Work already logged is reflected in metricItem.next, so do not count it twice.
      if (state.logs.some(log => log.taskId === taskId)) continue;
      const override = state.taskOverrides[taskId];
      projected += override !== undefined ? Math.max(0, Number(override) || 0) : baselineTarget;
    }
    return Math.min(Number(metricItem.end) + 1, projected);
  }
  function getScheduledTargets(key) {
    const targets = [];
    const scheduledLogs = state.logs.filter(log => log.date === key && String(log.taskId || '').startsWith('scheduled:'));
    const loggedIds = new Set();
    for (const log of scheduledLogs) {
      const match = String(log.taskId).match(/^scheduled:(\d{4}-\d{2}-\d{2}):([^:]+):(.+)$/);
      const subject = state.subjects.find(s => s.id === log.subjectId || s.id === match?.[2]);
      if (!subject) continue;
      const metricItem = subject.metrics.find(m => m.key === match?.[3]) || null;
      targets.push({ id: log.taskId, subject, metric: metricItem, label: log.label || (metricItem?.label || 'Study session'), rangeLabel: log.rangeLabel || log.label, description: subject.curriculum || subject.name, quantity: Number(log.quantity || log.minutes || 0), unit: log.unit || (subject.tracking === 'minutes' ? 'minutes' : 'items'), estimatedMinutes: Number(log.estimatedMinutes) || 0, locked: state.lockedTasks.includes(log.taskId), done: true, doneLog: log });
      loggedIds.add(log.taskId);
    }
    // Past days and days off never generate new assignments. Unfinished work is not carried forward.
    if (key < today || key < getScheduleStart() || !isStudyDay(key)) return targets;
    for (const subject of state.subjects) {
      const deadline = getDeadline(subject);
      if (!deadline || key > deadline) continue;
      const daysLeft = countStudyDays(key, deadline);
      if (!daysLeft) continue;
      if (subject.tracking === 'minutes') {
        const taskId = `scheduled:${key}:${subject.id}:minutes`;
        if (loggedIds.has(taskId)) continue;
        const doneLog = state.logs.find(log => log.taskId === taskId);
        const plannedMinutes = Math.max(1, Math.round(Number(subject.dailyMinutes || 50) * priorityMultiplier(subject.priority)));
        const quantity = doneLog ? Number(doneLog.minutes || doneLog.quantity || plannedMinutes) : clamp(Number(state.taskOverrides[taskId] ?? plannedMinutes), 1, 600);
        targets.push({ id: taskId, subject, metric: null, label: 'Study session', rangeLabel: `${formatNumber(quantity)} minutes`, description: subject.curriculum || subject.name, quantity, unit: 'minutes', estimatedMinutes: quantity, locked: state.lockedTasks.includes(taskId), done: !!doneLog, doneLog });
      } else {
        for (const metricItem of subject.metrics) {
          if (!validMetric(metricItem)) continue;
          const baselineTarget = metricDailyTarget(subject, metricItem, deadline);
          const next = projectedMetricStart(subject, metricItem, key, baselineTarget);
          const remaining = Number(metricItem.end) - next + 1;
          if (remaining <= 0 || baselineTarget <= 0) continue;
          const taskId = `scheduled:${key}:${subject.id}:${metricItem.key}`;
          if (loggedIds.has(taskId)) continue;
          const doneLog = state.logs.find(log => log.taskId === taskId);
          const defaultQuantity = Math.min(remaining, baselineTarget);
          const quantity = doneLog ? Number(doneLog.quantity) : clamp(Number(state.taskOverrides[taskId] ?? defaultQuantity), 1, Math.max(1, remaining));
          const rangeLabel = `${metricItem.label} ${formatNumber(next)}–${formatNumber(Math.min(Number(metricItem.end), next + Math.max(1, quantity) - 1))}`;
          targets.push({ id: taskId, subject, metric: metricItem, label: metricItem.label, rangeLabel, description: subject.curriculum || subject.name, quantity, unit: metricItem.unit, estimatedMinutes: subject.estimatedMinutes > 0 ? Math.round(subject.estimatedMinutes / Math.max(1, subject.metrics.filter(validMetric).length)) : 0, locked: state.lockedTasks.includes(taskId), done: false, doneLog });
        }
      }
    }
    return targets;
  }
  function getManualTasks(key) { return state.manualTasks.filter(task => task.date === key); }
  function curriculumStats(subject) {
    const activities = (subject.chapters || []).flatMap(chapter => chapter.activities || []);
    return { chapters: (subject.chapters || []).length, chaptersCompleted: (subject.chapters || []).filter(chapter => chapter.completed).length, total: activities.length, completed: activities.filter(activity => activity.completed).length };
  }
  function findCurriculumActivity(subjectId, chapterId, activityId) {
    const subject = state.subjects.find(item => item.id === subjectId);
    const chapter = subject?.chapters?.find(item => item.id === chapterId);
    const activity = chapter?.activities?.find(item => item.id === activityId);
    return subject && chapter && activity ? { subject, chapter, activity } : null;
  }
  function curriculumTaskId(subjectId, chapterId, activityId) { return `curriculum:${subjectId}:${chapterId}:${activityId}`; }
  function curriculumChapterTaskId(subjectId, chapterId) { return `chapter:${subjectId}:${chapterId}`; }
  function curriculumRangeLabel(subject, chapter, activity) {
    const section = `${subject.structureLabel || 'Chapter'} ${chapter.number || ''}`.trim();
    return `${section}${chapter.title ? ` · ${chapter.title}` : ''} — ${activity.title}`;
  }
  function curriculumTasksForDate(key) {
    const tasks = [];
    for (const subject of state.subjects) {
      for (const chapter of subject.chapters || []) {
        const chapterTask = curriculumChapterTaskId(subject.id, chapter.id);
        if (chapter.plannedDate === key && (!chapter.completed || chapter.completedAt === key)) {
          tasks.push({ id: chapterTask, date: key, subject, metric: null, curriculum: true, curriculumChapter: true, chapter,
            label: `${subject.structureLabel || 'Chapter'} ${chapter.number}`, rangeLabel: `${subject.structureLabel || 'Chapter'} ${chapter.number}${chapter.title ? ` · ${chapter.title}` : ''} — Section complete`,
            description: `${subject.name} · ${subject.curriculum || subject.name}`, quantity: 1, unit: 'chapter', estimatedMinutes: 0, done: !!chapter.completed });
        }
        for (const activity of chapter.activities || []) {
          const id = curriculumTaskId(subject.id, chapter.id, activity.id);
          if (activity.plannedDate === key && (!activity.completed || activity.completedAt === key)) {
            tasks.push({ id, date: key, subject, metric: null, curriculum: true, chapter, activity,
              label: activity.title, rangeLabel: curriculumRangeLabel(subject, chapter, activity),
              description: `${subject.name} · ${subject.curriculum || subject.name}`, quantity: 1,
              unit: activity.type, estimatedMinutes: activity.estimatedMinutes || 0, done: !!activity.completed });
          }
        }
      }
    }
    const existing = new Set(tasks.map(task => task.id));
    for (const log of state.logs.filter(item => (item.kind === 'curriculum-activity' || item.kind === 'curriculum-section') && item.date === key)) {
      const id = log.taskId || (log.kind === 'curriculum-section' ? curriculumChapterTaskId(log.subjectId, log.chapterId) : curriculumTaskId(log.subjectId, log.chapterId, log.activityId));
      if (existing.has(id)) continue;
      const subject = state.subjects.find(item => item.id === log.subjectId) || null;
      tasks.push({ id, date: key, subject, metric: null, curriculum: true, curriculumChapter: log.kind === 'curriculum-section', label: log.label || 'Curriculum activity',
        rangeLabel: log.rangeLabel || log.label || 'Curriculum activity', description: log.subjectName || subject?.name || 'Curriculum activity',
        quantity: Number(log.quantity) || 1, unit: log.activityType || log.unit || 'activity', estimatedMinutes: Number(log.minutes) || 0, done: true, doneLog: log });
    }
    return tasks;
  }
  function setCurriculumChapterComplete(subjectId, chapterId, completed, completedDate = today) {
    const subject = state.subjects.find(item => item.id === subjectId);
    const chapter = subject?.chapters?.find(item => item.id === chapterId);
    if (!subject || !chapter) return;
    const taskId = curriculumChapterTaskId(subjectId, chapterId);
    if (completed && !chapter.completed) {
      chapter.completed = true; chapter.completedAt = completedDate || today;
      const rangeLabel = `${subject.structureLabel || 'Chapter'} ${chapter.number}${chapter.title ? ` · ${chapter.title}` : ''} — Section complete`;
      const log = { id: makeId('log'), taskId, kind: 'curriculum-section', date: chapter.completedAt, subjectId, subjectName: subject.name,
        curriculum: subject.curriculum || '', chapterId, chapterNumber: chapter.number, chapterTitle: chapter.title,
        structureLabel: subject.structureLabel || 'Chapter', activityType: 'chapter', label: `${subject.structureLabel || 'Chapter'} ${chapter.number} complete`,
        rangeLabel, quantity: 1, unit: 'chapter', minutes: 0, note: '', source: 'curriculum-section-checklist', createdAt: new Date().toISOString() };
      state.logs.push(log); chapter.completedLogId = log.id;
      showToast(`${subject.structureLabel || 'Chapter'} ${chapter.number} logged as complete.`);
    } else if (!completed && chapter.completed) {
      const logId = chapter.completedLogId;
      state.logs = state.logs.filter(log => log.id !== logId && !(log.kind === 'curriculum-section' && log.taskId === taskId));
      chapter.completed = false; chapter.completedAt = ''; chapter.completedLogId = '';
      showToast('Section marked incomplete; its completion entry was removed.');
    }
    saveState(); renderAll();
  }
  function setCurriculumActivityComplete(subjectId, chapterId, activityId, completed, completedDate = today) {
    const found = findCurriculumActivity(subjectId, chapterId, activityId);
    if (!found) return;
    const { subject, chapter, activity } = found;
    const taskId = curriculumTaskId(subjectId, chapterId, activityId);
    if (completed && !activity.completed) {
      activity.completed = true;
      activity.completedAt = completedDate || today;
      const log = {
        id: makeId('log'), taskId, kind: 'curriculum-activity', date: activity.completedAt,
        subjectId, subjectName: subject.name, curriculum: subject.curriculum || '',
        chapterId, chapterNumber: chapter.number, chapterTitle: chapter.title, structureLabel: subject.structureLabel || 'Chapter',
        activityId, activityType: activity.type, label: activity.title,
        rangeLabel: curriculumRangeLabel(subject, chapter, activity), quantity: 1, unit: activity.type,
        minutes: Number(activity.estimatedMinutes) || 0, note: activity.note || '', source: 'curriculum-checklist', createdAt: new Date().toISOString()
      };
      state.logs.push(log); activity.completedLogId = log.id;
      showToast(`${ACTIVITY_LABELS[activity.type] || 'Activity'} logged as complete.`);
    } else if (!completed && activity.completed) {
      const logId = activity.completedLogId;
      state.logs = state.logs.filter(log => log.id !== logId && !(log.kind === 'curriculum-activity' && log.taskId === taskId));
      activity.completed = false; activity.completedAt = ''; activity.completedLogId = '';
      showToast('Activity marked incomplete; its completion entry was removed.');
    }
    saveState(); renderAll();
  }
  function getMovedScheduledTasks(key) {
    const moved = [];
    for (const [taskId, record] of Object.entries(state.taskMoves || {})) {
      if (!record || record.date !== key) continue;
      const subject = state.subjects.find(item => item.id === record.subjectId);
      if (!subject) continue;
      const metricItem = subject.metrics.find(item => item.key === record.metricKey) || null;
      const doneLog = state.logs.find(log => log.taskId === taskId) || null;
      moved.push({ id: taskId, date: key, subject, metric: metricItem, label: record.label || metricItem?.label || 'Study session',
        rangeLabel: doneLog?.rangeLabel || record.rangeLabel || record.label || 'Study session', description: subject.curriculum || subject.name,
        quantity: Number(doneLog?.quantity ?? record.quantity) || 0, unit: record.unit || metricItem?.unit || 'items',
        estimatedMinutes: Number(record.estimatedMinutes) || 0, locked: true, done: !!doneLog, doneLog, moved: true, movedFrom: record.fromDate || '' });
    }
    return moved;
  }
  function getMovedTaskById(taskId) {
    const record = state.taskMoves?.[taskId];
    return record ? getMovedScheduledTasks(record.date).find(item => item.id === taskId) || null : null;
  }
  function getAllDayTasks(key) {
    let generated = getScheduledTargets(key);
    if (key < today && Array.isArray(state.planSnapshots?.[key])) {
      const snapshot = state.planSnapshots[key];
      const snapshotIds = new Set(snapshot.map(item => item.id));
      generated = snapshot.map(item => {
        const subject = state.subjects.find(s => s.id === item.subjectId) || null;
        if (!subject) return null;
        const metricItem = subject.metrics.find(m => m.key === item.metricKey) || null;
        const doneLog = state.logs.find(log => log.taskId === item.id) || null;
        return { id: item.id, date: key, subject, metric: metricItem, label: item.label || metricItem?.label || 'Study session', rangeLabel: doneLog?.rangeLabel || item.rangeLabel || item.label, description: subject.curriculum || subject.name, quantity: Number(doneLog?.quantity ?? item.quantity) || 0, unit: item.unit || metricItem?.unit || 'minutes', estimatedMinutes: Number(item.estimatedMinutes) || 0, locked: state.lockedTasks.includes(item.id), done: !!doneLog, doneLog };
      }).filter(Boolean);
      generated.push(...getScheduledTargets(key).filter(item => !snapshotIds.has(item.id)));
    }
    generated = generated.filter(task => !state.taskMoves?.[task.id]);
    const movedScheduled = getMovedScheduledTasks(key);
    if (movedScheduled.length) {
      generated = generated.filter(task => !movedScheduled.some(moved => moved.subject?.id === task.subject?.id && moved.metric?.key && moved.metric.key === task.metric?.key));
      generated.push(...movedScheduled);
    }
    const curriculum = curriculumTasksForDate(key);
    const manual = getManualTasks(key).map(task => ({
      id: task.id, date: key, subject: state.subjects.find(s => s.id === task.subjectId) || null,
      label: task.title, description: task.subjectId ? (state.subjects.find(s => s.id === task.subjectId)?.curriculum || '') : 'Custom task',
      quantity: Number(task.quantity) || 0, unit: task.unit || 'tasks', done: !!task.done, metric: null, custom: true, task
    }));
    return [...generated, ...curriculum, ...manual];
  }
  function toggleAssignmentLock(taskId) {
    const index = state.lockedTasks.indexOf(taskId);
    if (index >= 0) {
      state.lockedTasks.splice(index, 1);
      delete state.taskOverrides[taskId];
      showToast('Assignment unlocked. Its target can recalculate.');
    } else {
      const task = findTaskByIdAcrossDates(taskId) || getScheduledTargets(selectedDate).find(item => item.id === taskId);
      state.lockedTasks.push(taskId);
      if (task) state.taskOverrides[taskId] = Number(task.quantity) || 0;
      showToast('Assignment locked. Its amount will stay fixed.');
    }
    saveState(); renderAll();
  }
  function saveAssignmentQuantity(taskId, value) {
    const task = findTaskByIdAcrossDates(taskId);
    const requested = Math.max(1, Number(value) || 1);
    const maximum = task?.metric ? Math.max(1, Number(task.metric.end) - Number(task.metric.next) + 1) : 600;
    const quantity = clamp(requested, 1, maximum);
    state.taskOverrides[taskId] = quantity;
    if (!state.lockedTasks.includes(taskId)) state.lockedTasks.push(taskId);
    saveState(); renderAll();
    showToast('Assignment amount updated and locked.');
  }
  function dailyWorkloadEstimate(key) {
    let total = 0;
    getAllDayTasks(key).forEach(task => {
      if (task.done) return;
      if (task.custom && String(task.unit).toLowerCase().includes('min')) { total += Number(task.quantity) || 0; return; }
      if (task.subject?.tracking === 'minutes') { total += Number(task.estimatedMinutes || task.quantity) || 0; return; }
      total += Number(task.estimatedMinutes) || 0;
    });
    return Math.round(total);
  }
  function workloadWarning(key) {
    const limit = Math.max(0, Number(state.settings.maxDailyMinutes) || 0);
    const total = dailyWorkloadEstimate(key);
    return limit > 0 && total > limit ? { total, limit } : null;
  }
  function refreshPlanSnapshots() {
    // Preserve already-generated dates when the app has been closed for a few days.
    // Rebuild today and future dates only; past snapshots remain as the historical plan.
    const next = Object.fromEntries(Object.entries(state.planSnapshots || {}).filter(([key]) => key < today));
    const scheduleStart = getScheduleStart();
    const deadlines = state.subjects.map(getDeadline).filter(key => key && key >= scheduleStart).sort();
    if (deadlines.length) {
      const last = parseDate(deadlines[deadlines.length - 1]);
      const cap = addDays(parseDate(today), 400);
      const end = last > cap ? cap : last;
      for (let date = parseDate(scheduleStart); date && date <= end; date = addDays(date, 1)) {
        const key = dateKey(date), tasks = getScheduledTargets(key);
        if (tasks.length) next[key] = tasks.map(task => ({ id: task.id, subjectId: task.subject.id, metricKey: task.metric?.key || '', label: task.label, rangeLabel: task.rangeLabel || task.label, quantity: Number(task.quantity) || 0, unit: task.unit, estimatedMinutes: Number(task.estimatedMinutes) || 0 }));
        else next[key] = [];
      }
    }
    if (JSON.stringify(next) !== JSON.stringify(state.planSnapshots || {})) { state.planSnapshots = next; saveState(); }
  }
  function logForTask(taskId) { return state.logs.find(log => log.taskId === taskId); }
  function applyMetricLogDelta(subject, metricItem, quantity, direction, date, excludeLogId = '') {
    if (!subject || !metricItem || metricItem.next === '' || !Number.isFinite(Number(metricItem.next))) return;
    const metricLogs = state.logs.filter(log => log.id !== excludeLogId && log.subjectId === subject.id && (log.metricKey ? log.metricKey === metricItem.key : String(log.unit || '').toLowerCase() === String(metricItem.unit || '').toLowerCase()));
    if (metricLogs.some(log => log.date > date)) return; // Keep later progress intact when editing an older entry.
    const current = Number(metricItem.next);
    const floor = Number(metricItem.baselineNext !== '' ? metricItem.baselineNext : (metricItem.start !== '' ? metricItem.start : current));
    const end = Number(metricItem.end);
    const ceiling = metricItem.end !== '' && Number.isFinite(end) ? end + 1 : Number.MAX_SAFE_INTEGER;
    metricItem.next = clamp(current + direction * quantity, floor, ceiling);
  }
  function toggleTask(taskId, checked, quantityOverride = null, taskDate = '') {
    const chapterMatch = String(taskId).match(/^chapter:([^:]+):(.+)$/);
    if (chapterMatch) { setCurriculumChapterComplete(chapterMatch[1], chapterMatch[2], checked, taskDate || selectedDate || today); return; }
    const curriculumMatch = String(taskId).match(/^curriculum:([^:]+):([^:]+):(.+)$/);
    if (curriculumMatch) { setCurriculumActivityComplete(curriculumMatch[1], curriculumMatch[2], curriculumMatch[3], checked, taskDate || selectedDate || today); return; }
    const manual = state.manualTasks.find(task => task.id === taskId);
    if (manual) {
      const subject = state.subjects.find(s => s.id === manual.subjectId);
      const matched = subject?.metrics.find(m => m.key === manual.metricKey || m.unit.toLowerCase() === String(manual.unit).toLowerCase());
      if (checked && !manual.done) {
        const requested = quantityOverride === null ? Number(manual.quantity) || 0 : Math.max(0, Number(quantityOverride) || 0);
        const remaining = matched && matched.end !== '' ? Math.max(0, Number(matched.end) - Number(matched.next) + 1) : requested;
        const quantity = matched ? Math.min(requested, remaining) : requested;
        manual.quantity = quantity; manual.done = true;
        if (matched && quantity > 0) applyMetricLogDelta(subject, matched, quantity, 1, manual.date);
        state.logs.push({ id: makeId('log'), taskId, date: manual.date, subjectId: manual.subjectId || '', subjectName: subject?.name || 'Personal work', metricKey: matched?.key || '', label: manual.title, quantity, unit: manual.unit || 'tasks', minutes: String(manual.unit).toLowerCase().includes('min') ? quantity : 0, note: manual.note || '', source: 'manual-task', createdAt: new Date().toISOString() });
      } else if (!checked && manual.done) {
        const log = logForTask(taskId);
        if (log) {
          const logSubject = state.subjects.find(s => s.id === log.subjectId);
          const logMetric = logSubject?.metrics.find(m => m.key === log.metricKey || m.unit.toLowerCase() === String(log.unit).toLowerCase());
          if (logMetric) applyMetricLogDelta(logSubject, logMetric, Number(log.quantity || 0), -1, log.date, log.id);
          state.logs = state.logs.filter(item => item.taskId !== taskId);
        }
        manual.done = false;
      }
    } else {
      const task = getAllDayTasks(selectedDate).find(item => item.id === taskId) || findTaskByIdAcrossDates(taskId);
      if (!task) return;
      const existing = logForTask(taskId);
      const actualTaskDate = task.date || taskId.split(':')[1];
      if (checked && !existing) {
        const requested = quantityOverride === null ? task.quantity : Math.max(0, Number(quantityOverride) || 0);
        const remaining = task.metric ? Math.max(0, Number(task.metric.end) - Number(task.metric.next) + 1) : 600;
        const quantity = task.metric ? Math.min(requested, remaining) : Math.min(requested, 600);
        const subject = task.subject;
        if (task.metric && quantity > 0) applyMetricLogDelta(subject, task.metric, quantity, 1, actualTaskDate);
        state.logs.push({ id: makeId('log'), taskId, date: actualTaskDate, subjectId: subject.id, metricKey: task.metric?.key || '', subjectName: subject.name, label: task.label, rangeLabel: task.rangeLabel || task.label, quantity, unit: task.unit, minutes: String(task.unit).toLowerCase().includes('min') ? quantity : 0, note: '', source: 'scheduled', createdAt: new Date().toISOString() });
      } else if (!checked && existing) {
        const subject = state.subjects.find(s => s.id === existing.subjectId);
        const metricItem = subject?.metrics.find(m => m.key === existing.metricKey);
        if (metricItem) applyMetricLogDelta(subject, metricItem, Number(existing.quantity || 0), -1, existing.date, existing.id);
        state.logs = state.logs.filter(item => item.taskId !== taskId);
      }
    }
    saveState(); renderAll();
  }
  function findTaskByIdAcrossDates(taskId) {
    const movedTask = getMovedTaskById(taskId);
    if (movedTask) return movedTask;
    const match = taskId.match(/^scheduled:(\d{4}-\d{2}-\d{2}):([^:]+):(.+)$/);
    if (!match) return null;
    const [, key, subjectId, metricKey] = match;
    const subject = state.subjects.find(s => s.id === subjectId);
    if (!subject) return null;
    const target = getAllDayTasks(key).find(item => item.id === taskId);
    if (target) return target;
    const log = state.logs.find(item => item.taskId === taskId);
    if (!log) return null;
    const metricItem = subject.metrics.find(m => m.key === metricKey) || null;
    return { id: taskId, date: log.date || key, subject, metric: metricItem, label: log.label, rangeLabel: log.rangeLabel || log.label, unit: log.unit, quantity: log.quantity, done: true, doneLog: log };
  }

  function renderAll() {
    applyAppearance();
    refreshPlanSnapshots();
    if (!storageAvailable) $('.sidebar-footer').innerHTML = '<span class="status-dot" style="background:#c39b5d"></span> Browser storage unavailable';
    renderTopLabels(); renderOverview(); renderCalendar(); renderSubjects(); renderProgress();
    renderSettings();
  }
  function renderTopLabels() {
    $('#topDateLabel').textContent = formatDate(today, { year: undefined });
    $('#subjectCount').textContent = state.subjects.length;
    $('#subjectCountLabel').textContent = `${state.subjects.length} subject${state.subjects.length === 1 ? '' : 's'}`;
    const start = parseDate(state.settings.schoolStart), end = parseDate(state.settings.schoolEnd), now = parseDate(today);
    if (start && end) {
      const span = Math.max(1, end - start), elapsed = clamp((now - start) / span, 0, 1);
      $('#miniYearLabel').textContent = `${start.getFullYear()}–${end.getFullYear()}`;
      $('#miniYearDates').textContent = `${formatDate(state.settings.schoolStart)} – ${formatDate(state.settings.schoolEnd)}`;
      $('#miniYearProgress').style.width = `${elapsed * 100}%`;
    } else {
      $('#miniYearLabel').textContent = 'Set your dates'; $('#miniYearDates').textContent = 'Choose a start and end date'; $('#miniYearProgress').style.width = '0%';
    }
  }
  function renderOverview() {
    $('#greetingEyebrow').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(parseDate(today)).toUpperCase();
    $('#greetingTitle').textContent = 'A little progress, every day.';
    $('#todayLongDate').textContent = formatLongDay(today);
    $('#todayStudyLabel').textContent = isStudyDay(today) ? 'Study day' : (state.settings.holidays.find(h => h.date === today)?.label || 'Day off');
    renderTaskList($('#todayTasks'), getAllDayTasks(today), true);
    const upcoming = [];
    for (let d = parseDate(today); upcoming.length < 5; d = addDays(d, 1)) {
      if (isStudyDay(dateKey(d))) upcoming.push(dateKey(d));
    }
    $('#upcomingStrip').innerHTML = upcoming.map(key => {
      const d = parseDate(key), tasks = getAllDayTasks(key), activeSubjects = [...new Set(tasks.map(t => t.subject?.id).filter(Boolean))];
      return `<button class="upcoming-day ${key === today ? 'today' : ''}" data-open-date="${key}"><span class="day-name">${DAY_SHORT[d.getDay()]}</span><strong class="day-num">${d.getDate()}</strong><span class="day-dots">${activeSubjects.slice(0, 4).map(id => { const sub = state.subjects.find(s => s.id === id); return `<i style="--dot-color:${escapeHtml(sub?.color || '#8a9a8c')}"></i>`; }).join('')}</span></button>`;
    }).join('');
    const start = parseDate(state.settings.schoolStart), end = parseDate(state.settings.schoolEnd), now = parseDate(today);
    const percent = start && end ? Math.round(clamp((now - start) / Math.max(1, end - start), 0, 1) * 100) : 0;
    $('#yearPercent').textContent = `${percent}%`;
    $('#yearRing').style.setProperty('--ring-angle', `${percent * 3.6}deg`);
    $('#yearProgressTitle').textContent = start && end ? 'Your school year' : 'Set your school year';
    $('#yearProgressText').textContent = start && end ? `${formatDate(state.settings.schoolStart)} through ${formatDate(state.settings.schoolEnd)}.` : 'Add your dates in Settings to see your year at a glance.';
    $('#overviewSubjectTotal').textContent = state.subjects.length;
    const onTrack = state.subjects.filter(s => subjectProgress(s).percent !== null && subjectProgress(s).percent >= expectedProgress(s)).length;
    $('#overviewOnTrack').textContent = state.subjects.some(s => subjectProgress(s).percent !== null) ? `${onTrack} / ${state.subjects.filter(s => subjectProgress(s).percent !== null).length}` : '—';
    $('#subjectSnapshot').innerHTML = state.subjects.length ? state.subjects.map(subject => {
      const p = subjectProgress(subject), percent = p.percent === null ? 0 : Math.round(p.percent);
      return `<div class="snapshot-item"><div class="snapshot-top"><div class="snapshot-name"><i class="subject-color-dot" style="--subject-color:${escapeHtml(subject.color)}"></i><span>${escapeHtml(subject.name)}</span></div><span class="snapshot-percent">${p.percent === null ? '—' : `${percent}%`}</span></div><div class="progress-track"><span style="--subject-color:${escapeHtml(subject.color)};width:${percent}%"></span></div></div>`;
    }).join('') : emptyState('No subjects yet', 'Add a subject to start planning.', 'Add subject');
    $('#overviewGrid')?.setAttribute('data-focus', state.settings.dashboard || 'calendar');
  }
  function renderTaskList(container, tasks, compact = false) {
    if (!tasks.length) {
      container.innerHTML = `<div class="empty-state"><strong>Nothing scheduled here yet</strong><p>Set subject targets and a finish date, or add a task manually.</p><button class="primary-button" data-go="subjects">Set up a subject</button></div>`;
      return;
    }
    container.innerHTML = tasks.map(task => taskMarkup(task, compact)).join('');
  }
  function taskMarkup(task, compact = false) {
    const subjectColor = task.subject?.color || '#9ba59b';
    return `<div class="task-row ${task.done ? 'done' : ''}">
      <button class="task-check" data-toggle-task="${escapeHtml(task.id)}" data-task-date="${escapeHtml(task.date || today)}" data-checked="${task.done}" aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}">${task.done ? '✓' : ''}</button>
      <span class="task-color" style="--subject-color:${escapeHtml(subjectColor)}"></span>
      <div class="task-main"><strong>${escapeHtml(task.subject?.name || task.label)}</strong><small>${escapeHtml(task.subject ? (task.rangeLabel || task.label) : (task.description || 'Personal task'))}${task.custom ? ' · Custom task' : ''}</small></div>
      <span class="task-amount">${formatNumber(task.quantity)} ${escapeHtml(task.unit)}</span>
    </div>`;
  }

  function renderCalendar() {
    if (!calendarCursor) calendarCursor = parseDate(today);
    $('#calendarViewToggle').querySelectorAll('button').forEach(button => button.classList.toggle('selected', button.dataset.calendarView === calendarView));
    if (calendarView === 'week') {
      const allDays = weekDateKeys(selectedDate);
      const visible = allDays.filter(key => state.settings.weekdays.includes(parseDate(key).getDay()) || key === selectedDate || getAllDayTasks(key).length > 0);
      const dates = visible.length ? visible : allDays;
      $('#calendarTitle').textContent = `${formatDate(dates[0], { year: undefined })} – ${formatDate(dates[dates.length - 1])}`;
      $('#calendarGrid').className = 'weekly-grid-wrapper';
      $('#calendarGrid').innerHTML = renderWeeklySchedule(dates);
      renderDayDetail();
      renderCalendarUnscheduled();
      return;
    }
    const start = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1, 12);
    const gridStart = addDays(start, -start.getDay());
    const dates = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    $('#calendarTitle').textContent = monthLabel(calendarCursor);
    $('#calendarGrid').className = 'calendar-grid month-grid';
    const headings = DAY_SHORT.map(day => `<div class="calendar-weekday">${day}</div>`).join('');
    const cells = dates.map(d => {
      const key = dateKey(d), inMonth = d.getMonth() === calendarCursor.getMonth(), tasks = getAllDayTasks(key);
      const holiday = state.settings.holidays.find(h => h.date === key);
      const classes = ['calendar-cell', key === today ? 'today' : '', key === selectedDate ? 'selected' : '', !inMonth ? 'outside' : '', holiday ? 'day-off' : ''].filter(Boolean).join(' ');
      const events = tasks.slice(0, 3).map(task => {
        const color = task.subject?.color || '#a1aaa0', style = state.settings.calendarStyle;
        const bg = style === 'blocks' ? hexToRgba(color, .15) : 'transparent';
        return `<div class="calendar-event ${style === 'labels' ? 'label-style' : style === 'text' ? 'text-style' : ''}" style="--event-bg:${bg};--event-text:${escapeHtml(color)}">${escapeHtml(task.subject?.name || task.label)}${style === 'blocks' ? ` · ${formatNumber(task.quantity)} ${escapeHtml(task.unit)}` : ''}${task.done ? ' ✓' : ''}</div>`;
      }).join('');
      return `<button class="calendar-cell ${classes}" data-calendar-date="${key}"><span class="calendar-day-number">${d.getDate()}</span><div class="calendar-events">${events}</div>${tasks.length > 3 ? `<div class="calendar-more">+${tasks.length - 3} more</div>` : ''}${holiday ? `<div class="cell-day-off">${escapeHtml(holiday.label || 'Day off')}</div>` : ''}</button>`;
    }).join('');
    $('#calendarGrid').innerHTML = headings + cells;
    renderDayDetail();
    renderCalendarUnscheduled();
  }
  function renderCalendarUnscheduled() {
    const container = $('#calendarUnscheduledSubjects');
    if (!container) return;
    if (calendarView !== 'month') { container.innerHTML = ''; return; }
    const monthStart = dateKey(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1, 12));
    const monthEnd = dateKey(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0, 12));
    const scheduledIds = new Set();
    for (const key of getDatesInRange(monthStart, monthEnd)) {
      for (const task of getAllDayTasks(key)) if (task.subject?.id) scheduledIds.add(task.subject.id);
    }
    const unscheduled = state.subjects.filter(subject => !scheduledIds.has(subject.id));
    if (!unscheduled.length) { container.innerHTML = ''; return; }
    const suggestedStart = selectedDate >= monthStart && selectedDate <= monthEnd ? selectedDate : (monthEnd < today ? today : (monthStart > today ? monthStart : today));
    const suggestedDate = nextStudyDate(suggestedStart);
    container.innerHTML = `<section class="calendar-unscheduled-panel"><div class="calendar-unscheduled-heading"><div><strong>Subjects without assignments this month</strong><p>They are saved in your curriculum, but don't have dated work on this calendar yet.</p></div><span>${unscheduled.length}</span></div><div class="calendar-unscheduled-list">${unscheduled.map(subject => `<div class="calendar-unscheduled-item"><span class="calendar-unscheduled-dot" style="--subject-color:${escapeHtml(subject.color)}"></span><div><strong>${escapeHtml(subject.name)}</strong><small>${escapeHtml(subject.curriculum || 'Curriculum not specified')}</small></div><button class="outline-button" data-schedule-subject="${escapeHtml(subject.id)}" data-calendar-date="${escapeHtml(suggestedDate)}">Schedule task</button></div>`).join('')}</div></section>`;
  }
  function renderWeeklySchedule(dateKeys) {
    const rows = state.subjects.map(subject => ({ id: subject.id, label: subject.name, subject }));
    const hasPersonal = dateKeys.some(key => getAllDayTasks(key).some(task => !task.subject));
    if (hasPersonal) rows.push({ id: 'personal', label: 'Personal / Other', subject: null });
    const headers = dateKeys.map(key => {
      const date = parseDate(key), off = !isStudyDay(key);
      return `<th class="${off ? 'off-day' : ''}"><span>${DAY_SHORT[date.getDay()]}</span><strong>${date.getDate()}</strong></th>`;
    }).join('');
    const body = rows.map(row => `<tr><th scope="row"><span class="week-subject-name">${escapeHtml(row.label)}</span>${row.subject ? `<small>${escapeHtml(priorityLabel(row.subject.priority))} priority</small>` : '<small>Other activities</small>'}</th>${dateKeys.map(key => {
      const tasks = getAllDayTasks(key).filter(task => row.subject ? task.subject?.id === row.id : !task.subject);
      const taskHtml = tasks.map(task => `<div class="week-assignment ${task.done ? 'done' : ''} ${task.moved ? 'moved-assignment' : ''}" ${task.done ? '' : `draggable="true" data-drag-task="${escapeHtml(task.id)}" data-drag-date="${key}"`} title="${task.done ? 'Completed assignment' : 'Drag to another day or use Move'}"><button class="week-assignment-open" data-calendar-date="${key}" aria-label="Open ${escapeHtml(task.subject?.name || task.label)} on ${key}"><span>${escapeHtml(task.rangeLabel || task.label)}</span><small>${formatNumber(task.quantity)} ${escapeHtml(task.unit)}</small></button>${task.done ? '<span class="week-done-mark" title="Completed">✓</span>' : `<button class="week-move-button" data-move-task="${escapeHtml(task.id)}" data-move-date="${key}" title="Move assignment to another date" aria-label="Move assignment">↗</button>`}${task.done ? '' : (task.custom || task.curriculum) ? '<span class="week-manual-mark">•</span>' : key < today ? '<span class="week-history-mark">Past</span>' : `<button class="week-lock-button ${task.locked ? 'locked' : ''}" data-lock-task="${escapeHtml(task.id)}" title="${task.locked ? 'Unlock assignment' : 'Lock assignment'}" aria-label="${task.locked ? 'Unlock' : 'Lock'} assignment">${task.locked ? '🔒' : '◇'}</button>`}</div>`).join('');
      const emptyCellButton = row.subject
        ? `<button class="week-empty-cell" data-schedule-subject="${escapeHtml(row.id)}" data-calendar-date="${key}" aria-label="Add ${escapeHtml(row.label)} work on ${key}">＋</button>`
        : `<button class="week-empty-cell" data-calendar-date="${key}" aria-label="Open ${key}">＋</button>`;
      return `<td class="${!isStudyDay(key) ? 'off-day' : ''}" data-drop-date="${key}"><div class="week-cell-content">${taskHtml || emptyCellButton}</div></td>`;
    }).join('')}</tr>`).join('');
    if (!rows.length) return `<div class="empty-state"><strong>Add a subject to build your weekly table</strong><p>Your subjects will appear as rows, with each day across the top.</p></div>`;
    return `<div class="weekly-table-scroll"><table class="weekly-schedule-table"><thead><tr><th scope="col">SUBJECT</th>${headers}</tr></thead><tbody>${body}</tbody></table></div><div class="weekly-table-note">Drag an assignment into another day to reschedule it, or use ↗ Move. Use ◇ to lock an amount against automatic changes.</div>`;
  }
  function hexToRgba(hex, alpha) {
    const clean = String(hex).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return `rgba(110,130,115,${alpha})`;
    const n = parseInt(clean, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  function renderDayDetail() {
    const day = $('#calendarDetail');
    if (!day) return;
    const tasks = getAllDayTasks(selectedDate), holiday = state.settings.holidays.find(h => h.date === selectedDate), warning = workloadWarning(selectedDate);
    day.innerHTML = `<div class="detail-header"><div><div class="eyebrow">${isStudyDay(selectedDate) ? 'DAILY WORKLOAD' : 'DAY PLAN'}</div><h2>${escapeHtml(formatLongDay(selectedDate))}</h2></div><div class="detail-actions"><button class="outline-button" id="detailAddTask">＋ Add task</button><button class="outline-button" id="detailPrint">Print day</button></div></div>
      ${warning ? `<div class="workload-warning"><strong>Above your preferred daily limit</strong><span>${warning.total} estimated minutes planned against a ${warning.limit}-minute limit. Adjust priorities or assignment amounts to shape the day.</span></div>` : ''}
      ${holiday ? `<div class="day-modal-note">${escapeHtml(holiday.label || 'This date is marked as a day off')}. Assignments are not moved automatically.</div>` : ''}
      <div class="detail-task-list">${tasks.length ? tasks.map(task => detailTaskMarkup(task)).join('') : `<div class="empty-state"><strong>No assignments for this date</strong><p>You can leave it open, or add a task yourself.</p></div>`}</div>
      <form class="manual-task-form" id="manualTaskForm"><label class="field"><span>Task or activity</span><input name="title" required placeholder="e.g. Read and take notes" /></label><label class="field"><span>Subject</span><select name="subjectId"><option value="">Personal / other</option>${state.subjects.map(subject => `<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}</option>`).join('')}</select></label><label class="field"><span>Amount</span><input name="quantity" type="number" min="0" step="0.5" placeholder="Optional" /></label><label class="field"><span>Unit</span><input name="unit" value="tasks" placeholder="pages, minutes…" /></label><button class="primary-button" type="submit">Add to day</button></form>
      <section class="day-notes-panel"><label class="field"><span>Notes for this day</span><textarea id="dayNotesInput" rows="3" placeholder="What did you learn? Any questions or notes for your records?">${escapeHtml(state.dayNotes?.[selectedDate] || '')}</textarea></label><button class="outline-button" id="saveDayNotes">Save daily notes</button></section>`;
  }
  function detailTaskMarkup(task) {
    const color = task.subject?.color || '#9ba59b', oldDate = selectedDate < today;
    const editableManual = task.custom && !task.done;
    return `<div class="detail-task ${task.done ? 'done' : ''}">
      <button class="task-check" data-toggle-task="${escapeHtml(task.id)}" data-task-date="${escapeHtml(selectedDate)}" data-checked="${task.done}" aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}">${task.done ? '✓' : ''}</button>
      <span class="task-color" style="--subject-color:${escapeHtml(color)}"></span>
      <div class="task-main"><strong>${escapeHtml(task.subject?.name || task.label)} — ${escapeHtml(task.rangeLabel || task.label)}</strong><small>${escapeHtml(task.description || 'Personal task')}${task.done ? ' · Completed' : ''}${task.custom ? ' · Manual task' : ''}</small></div>
      <div><input type="number" min="${task.custom ? '0' : '1'}" step="${task.custom ? '0.5' : '1'}" value="${escapeHtml(task.quantity)}" data-task-quantity="${escapeHtml(task.id)}" aria-label="Planned amount" ${task.done || oldDate || task.custom ? 'disabled' : ''}/><span class="unit-label">${escapeHtml(task.unit)}</span></div>
      ${task.done ? '<span class="unit-label">Done</span>' : task.curriculum ? `<span class="unit-label">${escapeHtml(ACTIVITY_LABELS[task.unit] || task.unit)}</span>` : editableManual ? `<div class="manual-task-actions"><button class="lock-task-button" data-edit-manual-task="${escapeHtml(task.id)}">Edit</button><button class="lock-task-button" data-delete-manual-task="${escapeHtml(task.id)}">Remove</button></div>` : task.custom ? '<span class="unit-label">Manual</span>' : oldDate ? '<span class="unit-label">Past assignment</span>' : `<button class="lock-task-button ${task.locked ? 'locked' : ''}" data-lock-task="${escapeHtml(task.id)}">${task.locked ? '🔒 Locked' : '◇ Lock'}</button>`}
    </div>`;
  }
  function renderSubjectCurriculum(subject) {
    const stats = curriculumStats(subject);
    const chapters = subject.chapters.map(chapter => {
      const activities = (chapter.activities || []).map(activity => `<label class="curriculum-activity-row ${activity.completed ? 'complete' : ''}">
        <input type="checkbox" data-toggle-curriculum="${escapeHtml(subject.id)}" data-chapter-id="${escapeHtml(chapter.id)}" data-activity-id="${escapeHtml(activity.id)}" ${activity.completed ? 'checked' : ''} />
        <span class="activity-type-tag activity-${escapeHtml(activity.type)}">${escapeHtml(ACTIVITY_LABELS[activity.type] || 'Other')}</span>
        <span class="curriculum-activity-title">${escapeHtml(activity.title)}</span>
        <small>${activity.completed ? `Done ${escapeHtml(activity.completedAt ? formatDate(activity.completedAt) : '')}` : activity.plannedDate ? `Planned ${escapeHtml(formatDate(activity.plannedDate))}` : 'Not scheduled'}</small>
      </label>`).join('');
      return `<section class="curriculum-chapter"><div class="curriculum-chapter-heading"><label class="chapter-completion-toggle"><input type="checkbox" data-toggle-curriculum-chapter="${escapeHtml(subject.id)}" data-chapter-id="${escapeHtml(chapter.id)}" ${chapter.completed ? 'checked' : ''} /><strong>${escapeHtml(subject.structureLabel || 'Chapter')} ${escapeHtml(chapter.number)}${chapter.title ? ` · ${escapeHtml(chapter.title)}` : ''}</strong></label><small>${chapter.completed ? `Section done ${escapeHtml(chapter.completedAt ? formatDate(chapter.completedAt) : '')}` : `${(chapter.activities || []).filter(item => item.completed).length}/${(chapter.activities || []).length} activities`}</small></div>${activities || '<p class="curriculum-empty">No activities added to this section yet.</p>'}</section>`;
    }).join('');
    const sectionLabel = (subject.structureLabel || 'Chapter').toLowerCase();
    const sectionPlural = sectionLabel.endsWith('s') ? sectionLabel : `${sectionLabel}s`;
    return `<details class="subject-curriculum-details"><summary><span>${escapeHtml(sectionPlural)} & activities</span><strong>${stats.chaptersCompleted}/${stats.chapters} sections · ${stats.completed}/${stats.total} activities</strong></summary><div class="curriculum-chapters-list">${chapters}</div><p class="curriculum-help">Check a section to log its completion separately from the activities inside it. Check individual items when you finish them. Daymark records each date in your activity log and printed reports.</p></details>`;
  }
  function renderSubjects() {
    const openCurriculumIds = new Set($$('.subject-card').filter(card => card.querySelector('.subject-curriculum-details[open]')).map(card => card.dataset.subjectCard));
    const query = ($('#subjectSearch')?.value || '').toLowerCase().trim();
    const items = state.subjects.filter(subject => `${subject.name} ${subject.curriculum}`.toLowerCase().includes(query));
    $('#subjectGrid').innerHTML = items.length ? items.map(subject => {
      const progress = subjectProgress(subject), percent = progress.percent === null ? 0 : Math.round(progress.percent);
      const deadline = getDeadline(subject), prediction = subjectPrediction(subject);
      const meta = subject.tracking === 'minutes' ? `${subject.dailyMinutes || 50} min per study day` : subject.metrics.map(item => item.unit).filter(Boolean).join(' + ') || 'Targets not set';
      const rangeInfo = subject.metrics.some(validMetric) ? subject.metrics.filter(validMetric).map(item => `${escapeHtml(item.label)}: ${formatNumber(item.next)} → ${formatNumber(item.end)}`).join(' · ') : 'Set a starting position and finish point to calculate daily targets';
      const completedMilestones = subject.milestones.filter(item => item.completed).length;
      const hasDatedCurriculum = (subject.chapters || []).some(chapter => chapter.plannedDate || (chapter.activities || []).some(activity => activity.plannedDate));
      const hasTrackerSchedule = !!getDeadline(subject) && getDeadline(subject) >= today && (subject.tracking === 'minutes' || subject.metrics.some(validMetric));
      const scheduleReady = hasDatedCurriculum || hasTrackerSchedule;
      return `<article class="subject-card" data-subject-card="${escapeHtml(subject.id)}"><div class="subject-card-top"><div class="subject-mark" style="--subject-color:${escapeHtml(subject.color)};--subject-soft:${hexToRgba(subject.color, .14)}">${escapeHtml(subject.name.slice(0, 1).toUpperCase())}</div><div class="subject-card-copy"><h3>${escapeHtml(subject.name)}</h3><p>${escapeHtml(subject.curriculum || 'Curriculum not specified')}</p></div><button class="subject-menu" data-edit-subject="${escapeHtml(subject.id)}" aria-label="Edit ${escapeHtml(subject.name)}">⋯</button></div>
      <div class="subject-meta"><span class="meta-chip">${escapeHtml(meta)}</span><span class="meta-chip">Finish: ${escapeHtml(deadline ? formatDate(deadline) : 'Not set')}</span><span class="meta-chip priority-chip">${escapeHtml(priorityLabel(subject.priority))} priority · ${priorityMultiplier(subject.priority).toFixed(2)}×</span><span class="meta-chip ${scheduleReady ? 'schedule-ready-chip' : 'schedule-needed-chip'}">${scheduleReady ? 'Calendar ready' : 'Needs scheduling'}</span></div>
      ${!scheduleReady ? `<div class="subject-schedule-hint">This subject is saved. Add a tracker range and finish date, date its chapter / lesson activities, or use <strong>Schedule task</strong> to put work on your calendar.</div>` : ''}
      <div class="subject-progress-head"><span>Progress</span><strong>${progress.percent === null ? (subject.tracking === 'minutes' ? progress.completedLabel : 'Not started') : `${percent}%`}</strong></div><div class="progress-track"><span style="--subject-color:${escapeHtml(subject.color)};width:${percent}%"></span></div>
      <div class="subject-stats"><div><span>Current position</span><strong>${escapeHtml(rangeInfo)}</strong></div><div><span>${subject.tracking === 'minutes' ? 'Time target' : 'Estimated finish'}</span><strong>${escapeHtml(subject.tracking === 'minutes' ? progress.remainingLabel : (prediction ? formatDate(prediction) : 'Add a range to predict'))}</strong></div></div>
      ${subject.milestones.length ? `<div class="subject-milestone-list"><div class="milestone-summary">Milestones · ${completedMilestones}/${subject.milestones.length}</div>${subject.milestones.map(item => `<label class="milestone-item ${item.completed ? 'complete' : ''}"><input type="checkbox" data-toggle-milestone="${escapeHtml(subject.id)}" data-milestone-id="${escapeHtml(item.id)}" ${item.completed ? 'checked' : ''}><span>${escapeHtml(item.title)}</span>${item.targetDate ? `<small>${escapeHtml(formatDate(item.targetDate))}</small>` : ''}</label>`).join('')}</div>` : ''}
      ${subject.chapters?.length ? renderSubjectCurriculum(subject) : ''}
      <div class="subject-card-actions"><button class="mini-action" data-log-subject="${escapeHtml(subject.id)}">Log work</button><button class="mini-action" data-schedule-subject="${escapeHtml(subject.id)}" data-calendar-date="${escapeHtml(nextStudyDate())}">Schedule task</button><button class="mini-action" data-edit-subject="${escapeHtml(subject.id)}">Edit subject</button></div></article>`;
    }).join('') : `<div class="empty-state empty-subjects"><strong>${query ? 'No matching subjects' : 'No subjects yet'}</strong><p>${query ? 'Try another search.' : 'Add a subject and enter the curriculum details to start planning.'}</p><button class="primary-button" id="emptyAddSubject">＋ Add subject</button></div>`;
    $$('.subject-card').forEach(card => { if (openCurriculumIds.has(card.dataset.subjectCard)) { const details = card.querySelector('.subject-curriculum-details'); if (details) details.open = true; } });
  }

  function renderProgress() {
    const totalLogs = state.logs.length;
    const minutes = state.logs.reduce((sum, log) => sum + (Number(log.minutes) || (String(log.unit).toLowerCase().includes('min') ? Number(log.quantity) || 0 : 0)), 0);
    const doneSubjects = state.subjects.filter(subject => subjectProgress(subject).percent !== null && subjectProgress(subject).percent >= 100).length;
    const progressValues = state.subjects.map(subjectProgress).filter(progress => progress.percent !== null);
    const average = progressValues.length ? Math.round(progressValues.reduce((sum, progress) => sum + progress.percent, 0) / progressValues.length) : null;
    $('#progressTopCards').innerHTML = [
      `<div class="progress-kpi"><span>ACTIVITY ENTRIES</span><strong>${totalLogs}</strong><small>Completed work logged</small></div>`,
      `<div class="progress-kpi"><span>TIME LOGGED</span><strong>${formatNumber(minutes)} min</strong><small>${(minutes / 60).toFixed(1)} hours in total</small></div>`,
      `<div class="progress-kpi"><span>AVERAGE SUBJECT PROGRESS</span><strong>${average === null ? '—' : `${average}%`}</strong><small>${doneSubjects} subject${doneSubjects === 1 ? '' : 's'} fully completed</small></div>`
    ].join('');
    $('#progressTableBody').innerHTML = state.subjects.length ? state.subjects.map(subject => {
      const progress = subjectProgress(subject), percent = progress.percent === null ? null : Math.round(progress.percent), deadline = getDeadline(subject), prediction = subjectPrediction(subject);
      const pace = percent === null ? 'Set targets' : percent >= expectedProgress(subject) ? 'On track' : 'Needs review';
      return `<tr><td><div class="table-subject"><i class="subject-color-dot" style="--subject-color:${escapeHtml(subject.color)}"></i>${escapeHtml(subject.name)}</div></td><td><div class="table-progress"><span style="--subject-color:${escapeHtml(subject.color)};width:${percent ?? 0}%"></span></div><small>${percent === null ? '—' : `${percent}%`}</small></td><td>${escapeHtml(progress.completedLabel)}</td><td>${escapeHtml(progress.remainingLabel)}</td><td>${escapeHtml(deadline ? formatDate(deadline) : 'Not set')}</td><td>${escapeHtml(prediction ? formatDate(prediction) : '—')}</td><td>${escapeHtml(priorityLabel(subject.priority))}</td><td><span class="pace-pill ${pace === 'Needs review' ? 'behind' : ''}">${escapeHtml(pace)}</span></td></tr>`;
    }).join('') : '<tr><td colspan="8">Add subjects to see your progress.</td></tr>';
    renderWeeklyReview();
  }
  function renderWeeklyReview() {
    const week = weekDateKeys(dateKey(reviewCursor || parseDate(today))), start = week[0], end = week[6];
    const tasks = week.flatMap(key => getAllDayTasksForPrint(key).map(task => ({ ...task, date: key })));
    const logs = state.logs.filter(log => log.date >= start && log.date <= end);
    const minutes = logs.reduce((sum, log) => sum + (Number(log.minutes) || (String(log.unit).toLowerCase().includes('min') ? Number(log.quantity) || 0 : 0)), 0);
    $('#weeklyReviewTitle').textContent = `${formatDate(start)} – ${formatDate(end)}`;
    const breakdown = state.subjects.map(subject => {
      const entries = logs.filter(log => log.subjectId === subject.id);
      const totals = new Map(); entries.forEach(log => totals.set(log.unit || 'items', (totals.get(log.unit || 'items') || 0) + (Number(log.quantity) || 0)));
      const amount = [...totals.entries()].map(([unit, count]) => `${formatNumber(count)} ${unit}`).join(' + ');
      return entries.length ? `<div class="review-subject-row"><span><i class="subject-color-dot" style="--subject-color:${escapeHtml(subject.color)}"></i>${escapeHtml(subject.name)}</span><strong>${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}${amount ? ` · ${escapeHtml(amount)}` : ''}</strong></div>` : '';
    }).join('');
    const completed = tasks.filter(task => task.done).length;
    $('#weeklyReviewContent').innerHTML = `<div class="weekly-review-stats"><div><span>Planned assignments</span><strong>${tasks.length}</strong></div><div><span>Completed</span><strong>${completed}</strong></div><div><span>Time logged</span><strong>${formatNumber(minutes)} min</strong></div><div><span>Manual tasks</span><strong>${state.manualTasks.filter(task => task.date >= start && task.date <= end).length}</strong></div></div><div class="review-subject-breakdown">${breakdown || '<p class="settings-help">No subject activity logged this week yet.</p>'}</div><div class="review-progress-note">${completed} of ${tasks.length} planned assignments marked complete. Missed assignments stay on their original dates until you decide what to do with them.</div>`;
  }

  function renderSettings() {
    const settings = state.settings;
    $('#schoolStart').value = settings.schoolStart || ''; $('#schoolEnd').value = settings.schoolEnd || '';
    $('#maxDailyMinutes').value = Number(settings.maxDailyMinutes ?? 180);
    $('#weekdayPicker').innerHTML = DAY_SHORT.map((day, index) => `<button type="button" class="weekday-choice ${settings.weekdays.includes(index) ? 'selected' : ''}" data-weekday="${index}">${day}<small>${settings.weekdays.includes(index) ? 'Study' : 'Off'}</small></button>`).join('');
    $('#holidayList').innerHTML = settings.holidays.length ? settings.holidays.slice().sort((a, b) => a.date.localeCompare(b.date)).map(holiday => `<div class="holiday-row"><span><strong>${escapeHtml(formatDate(holiday.date))}</strong> · ${escapeHtml(holiday.label || 'Day off')}</span><button data-remove-holiday="${escapeHtml(holiday.date)}" aria-label="Remove day off">×</button></div>`).join('') : '<p class="settings-help">No days off added yet.</p>';
    selectSetting('themeChoices', 'data-theme-choice', settings.theme); selectSetting('densityChoices', 'data-density', settings.density);
    selectSetting('calendarStyleChoices', 'data-calendar-style', settings.calendarStyle); selectSetting('defaultCalendarChoices', 'data-default-calendar', settings.defaultCalendar); selectSetting('dashboardChoices', 'data-dashboard', settings.dashboard);
    $('#accentColor').value = settings.accent || '#607d71'; $('#accentColorLabel').textContent = (settings.accent || '#607d71').toUpperCase();
    $('#sidebarWidth').value = settings.sidebarWidth || 250; $('#appScale').value = Number(settings.appScale || 100); $('#appScaleValue').textContent = `${Number(settings.appScale || 100)}%`;
    $('#fontSize').value = settings.fontSize || 'normal'; $('#dateFormat').value = settings.dateFormat || 'long'; $('#clockFormat').value = settings.clockFormat || '12';
    $('#subjectColorSettings').innerHTML = state.subjects.map(subject => `<label class="color-setting-item"><span>${escapeHtml(subject.name)}</span><input type="color" value="${escapeHtml(subject.color)}" data-subject-color="${escapeHtml(subject.id)}" /></label>`).join('') || '<p class="settings-help">Add a subject to choose its color.</p>';
  }
  function selectSetting(id, attr, value) {
    $(`#${id}`).querySelectorAll('button').forEach(button => button.classList.toggle('selected', button.getAttribute(attr) === value));
  }
  function applyAppearance() {
    const settings = state.settings;
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('theme-dark', !!dark);
    document.body.classList.toggle('density-compact', settings.density === 'compact');
    document.body.classList.toggle('density-comfortable', settings.density === 'comfortable');
    document.documentElement.style.setProperty('--accent', settings.accent || '#607d71');
    document.documentElement.style.setProperty('--accent-strong', settings.accent || '#607d71');
    document.documentElement.style.setProperty('--sidebar-width', `${clamp(Number(settings.sidebarWidth) || 250, 220, 300)}px`);
    document.documentElement.style.setProperty('--font-scale', settings.fontSize === 'small' ? '.92' : settings.fontSize === 'large' ? '1.1' : '1');
    const scale = clamp(Number(settings.appScale) || 100, 80, 150);
    document.body.style.zoom = `${scale / 100}`;
    document.documentElement.style.setProperty('--app-scale', `${scale / 100}`);
    $('#overviewGrid')?.setAttribute('data-focus', settings.dashboard || 'calendar');
  }

  function subjectForm(subject = null) {
    const existing = subject ? JSON.parse(JSON.stringify(subject)) : null;
    let tracking = existing?.tracking || 'metrics';
    let metrics = existing?.metrics?.length ? existing.metrics.map(item => ({ ...item })) : (tracking === 'minutes' ? [] : [metric('pages', 'Pages', 'pages')]);
    let milestones = Array.isArray(existing?.milestones) ? existing.milestones.map(item => ({ ...item })) : [];
    let chapters = Array.isArray(existing?.chapters) ? existing.chapters.map(chapter => ({ ...chapter, activities: (chapter.activities || []).map(activity => ({ ...activity })) })) : [];
    let structureLabel = existing?.structureLabel || (existing?.name === 'Writing' ? 'Lesson' : 'Chapter');
    if (!existing && !metrics.length) metrics = [metric('pages', 'Pages', 'pages')];
    const renderMetrics = () => {
      const box = $('#metricEditors');
      if (!box) return;
      box.innerHTML = metrics.map((m, index) => `<div class="metric-editor" data-metric-index="${index}"><div class="metric-editor-head"><strong>WORK TRACKER ${index + 1}</strong>${metrics.length > 1 ? `<button type="button" data-remove-metric="${index}" aria-label="Remove tracker">Remove ×</button>` : ''}</div><div class="metric-fields"><label class="field"><span>Label</span><input data-metric-field="label" value="${escapeHtml(m.label)}" placeholder="e.g. Pages" /></label><label class="field"><span>Unit</span><input data-metric-field="unit" value="${escapeHtml(m.unit)}" placeholder="pages" /></label><label class="field"><span>Starting item</span><input data-metric-field="start" type="number" step="1" value="${escapeHtml(m.start)}" placeholder="e.g. 1" /></label><label class="field"><span>Finish item</span><input data-metric-field="end" type="number" step="1" value="${escapeHtml(m.end)}" placeholder="e.g. 240" /></label><label class="field"><span>Next item to do</span><input data-metric-field="next" type="number" step="1" value="${escapeHtml(m.next)}" placeholder="e.g. 35" /></label></div></div>`).join('');
    };
    const renderMilestones = () => {
      const box = $('#milestoneEditors');
      if (!box) return;
      box.innerHTML = milestones.length ? milestones.map((item, index) => `<div class="milestone-editor" data-milestone-index="${index}"><label class="field"><span>Milestone ${index + 1}</span><input data-milestone-field="title" value="${escapeHtml(item.title)}" placeholder="e.g. Finish Chapter 3" /></label><label class="field"><span>Target date (optional)</span><input data-milestone-field="targetDate" type="date" value="${escapeHtml(item.targetDate || '')}" /></label><button type="button" class="lock-task-button" data-remove-milestone="${index}">Remove</button></div>`).join('') : '<p class="modal-help">No milestones added. You can add chapters, units, or other checkpoints.</p>';
    };
    const renderChapters = () => {
      const box = $('#chapterEditors');
      if (!box) return;
      box.innerHTML = chapters.length ? chapters.map((chapter, chapterIndex) => `<article class="chapter-editor" data-chapter-index="${chapterIndex}">
        <div class="chapter-editor-heading"><strong>${escapeHtml(structureLabel)} ${escapeHtml(chapter.number || chapterIndex + 1)}</strong><button type="button" class="lock-task-button" data-remove-chapter="${chapterIndex}">Remove section ×</button></div>
        <div class="chapter-editor-fields"><label class="field"><span>${escapeHtml(structureLabel)} number</span><input data-chapter-field="number" value="${escapeHtml(chapter.number)}" placeholder="1" /></label><label class="field"><span>Title / name</span><input data-chapter-field="title" value="${escapeHtml(chapter.title)}" placeholder="e.g. The Cell" /></label><label class="field"><span>Section completion date (optional)</span><input data-chapter-field="plannedDate" type="date" value="${escapeHtml(chapter.plannedDate || '')}" /></label></div>
        <div class="chapter-activity-list">${(chapter.activities || []).map((activity, activityIndex) => `<div class="chapter-activity-editor" data-activity-index="${activityIndex}">
          <label class="field"><span>Activity type</span><select data-activity-field="type">${ACTIVITY_TYPES.map(type => `<option value="${type.value}" ${activity.type === type.value ? 'selected' : ''}>${type.label}</option>`).join('')}</select></label>
          <label class="field activity-title-field"><span>Activity name</span><input data-activity-field="title" value="${escapeHtml(activity.title)}" placeholder="e.g. Video 1, Experiment 2, Chapter test" /></label>
          <label class="field"><span>Planned date (optional)</span><input data-activity-field="plannedDate" type="date" value="${escapeHtml(activity.plannedDate || '')}" /></label>
          <label class="field"><span>Est. minutes</span><input data-activity-field="estimatedMinutes" type="number" min="0" max="600" step="5" value="${escapeHtml(activity.estimatedMinutes || 0)}" /></label>
          <button type="button" class="lock-task-button remove-activity-button" data-remove-activity="${chapterIndex}:${activityIndex}">Remove ×</button>
          <label class="field activity-note-field"><span>Notes / result (optional)</span><input data-activity-field="note" value="${escapeHtml(activity.note || '')}" placeholder="e.g. test score, experiment observations, reading notes" /></label>
        </div>`).join('') || '<p class="curriculum-empty">No activities yet. Add videos, experiments, tests, readings, or other work.</p>'}</div>
        <button type="button" class="add-metric-button add-chapter-activity" data-add-activity="${chapterIndex}">＋ Add activity</button>
      </article>`).join('') : '<p class="modal-help">No chapters or sections yet. Add one, then add as many activities as needed.</p>';
    };
    const body = `<div class="subject-form-grid"><label class="field"><span>Subject name</span><input id="subjectName" required value="${escapeHtml(existing?.name || '')}" placeholder="e.g. Biology" /></label><label class="field"><span>Subject color</span><input id="subjectColor" type="color" value="${escapeHtml(existing?.color || COLORS[state.subjects.length % COLORS.length])}" /></label><label class="field full"><span>Curriculum / book</span><input id="subjectCurriculum" value="${escapeHtml(existing?.curriculum || '')}" placeholder="Book, course, or program name" /></label><label class="field"><span>Tracking method</span><select id="subjectTracking"><option value="metrics">Pages / lessons / videos</option><option value="minutes">Time per study day</option></select></label><label class="field"><span>Importance / priority</span><select id="subjectPriority"><option value="low">Low · 0.75×</option><option value="normal">Normal · 1.00×</option><option value="high">High · 1.25×</option><option value="very-high">Very high · 1.50×</option><option value="urgent">Urgent · 2.00×</option></select></label><label class="field" id="dailyMinutesField" style="${tracking === 'minutes' ? '' : 'display:none'}"><span>Target minutes per study day</span><input id="subjectDailyMinutes" type="number" min="1" max="600" value="${escapeHtml(existing?.dailyMinutes || 50)}" /></label><label class="field" id="estimatedMinutesField" style="${tracking === 'metrics' ? '' : 'display:none'}"><span>Estimated minutes per study day</span><input id="subjectEstimatedMinutes" type="number" min="0" max="600" step="5" value="${escapeHtml(existing?.estimatedMinutes || 0)}" /><small>Used for workload warnings. 0 means no estimate.</small></label><label class="field full"><span>Subject finish date (optional)</span><input id="subjectFinishDate" type="date" value="${escapeHtml(existing?.finishDate || '')}" /></label></div>
      <div id="metricArea" style="${tracking === 'minutes' ? 'display:none' : ''}"><p class="form-section-title" style="margin-top:19px">TRACK YOUR CURRICULUM</p><div id="metricEditors"></div><button type="button" class="add-metric-button" id="addMetric">＋ Add another tracker (for example, pages and videos)</button><p class="modal-help">“Next item to do” is the next page or lesson you have not completed. Daily targets use your selected study days. Higher priority increases the suggested daily amount and moves the projected finish earlier.</p></div>
      <div class="milestones-editor-section"><p class="form-section-title">CHAPTERS & MILESTONES</p><div id="milestoneEditors"></div><button type="button" class="add-metric-button" id="addMilestone">＋ Add milestone</button></div>
      <div class="curriculum-structure-editor"><p class="form-section-title">CURRICULUM STRUCTURE & ACTIVITIES</p><p class="modal-help">Use this for every subject. Organize work by chapter, unit, lesson, topic, or your own section name. Add as many activities as needed inside each section—videos, experiments, tests, quizzes, readings, exercises, projects, or other items. Set a planned date to put an activity on the calendar; check it on the subject card when completed to record it in your log.</p><label class="field structure-label-field"><span>Organize this subject by</span><input id="subjectStructureLabel" value="${escapeHtml(structureLabel)}" placeholder="Chapter, Lesson, Unit…" /></label><div id="chapterEditors"></div><button type="button" class="add-metric-button" id="addChapter">＋ Add ${escapeHtml(structureLabel.toLowerCase() || 'section')}</button></div>
      <div class="subject-calendar-help"><strong>How this subject gets onto your calendar</strong><p>Daily targets are generated when you enter a tracker starting point, finish point, and a subject or school-year finish date. Chapter / lesson activities appear on the dates you give them. You can also save the subject first, then use <strong>Schedule task</strong> to add a one-off assignment.</p></div>
      <p class="modal-help">Your priority is a planning preference, not a required pace. You can change it at any time, edit individual assignments, or lock a task so it stays as entered.</p>`;
    const footer = `<span class="form-error" id="subjectFormError"></span><div class="right-actions">${existing ? '<button class="danger-button" id="deleteSubject">Delete</button>' : ''}<button class="outline-button" id="cancelSubject">Cancel</button><button class="primary-button" id="saveSubject">Save subject</button></div>`;
    openModal(existing ? 'Edit subject' : 'Add a subject', 'SUBJECT SETUP', body, footer, null, true);
    renderMetrics(); renderMilestones(); renderChapters();
    $('#subjectTracking').value = tracking;
    $('#subjectPriority').value = existing?.priority || 'normal';
    $('#subjectTracking').addEventListener('change', event => {
      tracking = event.target.value;
      $('#metricArea').style.display = tracking === 'minutes' ? 'none' : '';
      $('#dailyMinutesField').style.display = tracking === 'minutes' ? '' : 'none';
      $('#estimatedMinutesField').style.display = tracking === 'metrics' ? '' : 'none';
      if (tracking !== 'minutes' && metrics.length === 0) { metrics = [metric('pages', 'Pages', 'pages')]; renderMetrics(); }
    });
    $('#addMetric').addEventListener('click', () => { metrics.push(metric(`metric-${Date.now()}`, 'Other work', 'items')); renderMetrics(); });
    $('#metricEditors').addEventListener('click', event => {
      const button = event.target.closest('[data-remove-metric]');
      if (button) { metrics.splice(Number(button.dataset.removeMetric), 1); renderMetrics(); }
    });
    $('#metricEditors').addEventListener('input', event => {
      const input = event.target.closest('[data-metric-field]'); if (!input) return;
      const editor = input.closest('[data-metric-index]'); metrics[Number(editor.dataset.metricIndex)][input.dataset.metricField] = input.value;
    });
    $('#addMilestone').addEventListener('click', () => { milestones.push({ id: makeId('milestone'), title: '', targetDate: '', completed: false }); renderMilestones(); });
    $('#milestoneEditors').addEventListener('click', event => {
      const button = event.target.closest('[data-remove-milestone]');
      if (button) { milestones.splice(Number(button.dataset.removeMilestone), 1); renderMilestones(); }
    });
    $('#milestoneEditors').addEventListener('input', event => {
      const input = event.target.closest('[data-milestone-field]'); if (!input) return;
      const editor = input.closest('[data-milestone-index]'); milestones[Number(editor.dataset.milestoneIndex)][input.dataset.milestoneField] = input.value;
    });
    $('#subjectStructureLabel').addEventListener('input', event => {
      structureLabel = event.target.value.trim() || 'Section';
      const addButton = $('#addChapter'); if (addButton) addButton.textContent = `＋ Add ${structureLabel.toLowerCase()}`;
      const headings = $$('.chapter-editor-heading strong', $('#chapterEditors'));
      headings.forEach((heading, index) => { heading.textContent = `${structureLabel} ${chapters[index]?.number || index + 1}`; });
    });
    $('#addChapter').addEventListener('click', () => {
      const number = String(chapters.length + 1);
      chapters.push({ id: makeId('chapter'), number, title: `${structureLabel} ${number}`, plannedDate: '', completed: false, completedAt: '', completedLogId: '', activities: [] });
      renderChapters();
    });
    $('#chapterEditors').addEventListener('click', event => {
      const removeChapter = event.target.closest('[data-remove-chapter]');
      if (removeChapter) { chapters.splice(Number(removeChapter.dataset.removeChapter), 1); renderChapters(); return; }
      const addActivity = event.target.closest('[data-add-activity]');
      if (addActivity) {
        const chapterIndex = Number(addActivity.dataset.addActivity), activities = chapters[chapterIndex].activities;
        const nextVideo = activities.filter(item => item.type === 'video').length + 1;
        activities.push({ id: makeId('activity'), type: 'video', title: `Video ${nextVideo}`, plannedDate: '', estimatedMinutes: 0, completed: false, completedAt: '', note: '', completedLogId: '' });
        renderChapters(); return;
      }
      const removeActivity = event.target.closest('[data-remove-activity]');
      if (removeActivity) {
        const [chapterIndex, activityIndex] = removeActivity.dataset.removeActivity.split(':').map(Number);
        chapters[chapterIndex].activities.splice(activityIndex, 1); renderChapters();
      }
    });
    $('#chapterEditors').addEventListener('input', event => {
      const chapterEditor = event.target.closest('[data-chapter-index]');
      const activityEditor = event.target.closest('[data-activity-index]');
      if (activityEditor && event.target.matches('[data-activity-field]')) {
        const chapterIndex = Number(chapterEditor.dataset.chapterIndex), activityIndex = Number(activityEditor.dataset.activityIndex);
        chapters[chapterIndex].activities[activityIndex][event.target.dataset.activityField] = event.target.value;
      } else if (chapterEditor && event.target.matches('[data-chapter-field]')) {
        chapters[Number(chapterEditor.dataset.chapterIndex)][event.target.dataset.chapterField] = event.target.value;
      }
    });
    $('#chapterEditors').addEventListener('change', event => {
      const activityEditor = event.target.closest('[data-activity-index]');
      const chapterEditor = event.target.closest('[data-chapter-index]');
      if (activityEditor && event.target.matches('[data-activity-field]')) {
        const ci = Number(chapterEditor.dataset.chapterIndex), ai = Number(activityEditor.dataset.activityIndex);
        chapters[ci].activities[ai][event.target.dataset.activityField] = event.target.value;
      }
    });
    $('#cancelSubject').addEventListener('click', closeModal);
    $('#saveSubject').addEventListener('click', () => {
      const name = $('#subjectName').value.trim();
      if (!name) { $('#subjectFormError').textContent = 'Please give this subject a name.'; return; }
      let cleanMetrics = metrics.map((m, index) => ({ ...m, key: m.key || `metric-${index + 1}`, label: String(m.label || 'Work').trim(), unit: String(m.unit || 'items').trim() })).filter(m => m.label && m.unit);
      for (const item of cleanMetrics) {
        const values = [item.start, item.end, item.next].filter(value => value !== '');
        if (values.some(value => !Number.isFinite(Number(value)))) { $('#subjectFormError').textContent = 'Tracker positions must be valid numbers.'; return; }
        if (item.start !== '' && item.end !== '' && Number(item.end) < Number(item.start)) { $('#subjectFormError').textContent = 'A tracker finish item cannot be before its starting item.'; return; }
        if (item.next !== '' && item.start !== '' && Number(item.next) < Number(item.start)) { $('#subjectFormError').textContent = 'The next item cannot be before the starting item.'; return; }
        if (item.next !== '' && item.end !== '' && Number(item.next) > Number(item.end) + 1) { $('#subjectFormError').textContent = 'The next item cannot be beyond the finish item.'; return; }
        if (item.next === '' && item.start !== '') item.next = item.start;
        // A subject edit sets a new baseline at the entered current position.
        item.baselineNext = item.next;
      }
      const cleanMilestones = milestones.map(item => ({ ...item, title: String(item.title || '').trim() })).filter(item => item.title);
      const cleanChapters = chapters.map((chapter, ci) => ({
        ...chapter, number: String(chapter.number || ci + 1).trim(), title: String(chapter.title || '').trim() || `${structureLabel} ${chapter.number || ci + 1}`,
        activities: (chapter.activities || []).map(activity => ({ ...activity, title: String(activity.title || '').trim(), plannedDate: activity.plannedDate || '', estimatedMinutes: clamp(Number(activity.estimatedMinutes) || 0, 0, 600) })).filter(activity => activity.title)
      })).filter(chapter => chapter.title || chapter.activities.length);
      const finishDate = $('#subjectFinishDate').value;
      let subjectId = existing?.id || makeId('subject');
      while (!existing && state.subjects.some(item => item.id === subjectId)) subjectId = makeId('subject');
      const nextSubject = normalizeSubject({
        id: subjectId, name, curriculum: $('#subjectCurriculum').value.trim(), tracking,
        dailyMinutes: Number($('#subjectDailyMinutes')?.value || 50), estimatedMinutes: Number($('#subjectEstimatedMinutes')?.value || 0),
        priority: $('#subjectPriority').value, finishDate, color: $('#subjectColor').value, metrics: cleanMetrics, milestones: cleanMilestones, structureLabel, chapters: cleanChapters
      }, state.subjects.length);
      if (existing) state.subjects = state.subjects.map(item => item.id === existing.id ? nextSubject : item);
      else state.subjects.push(nextSubject);
      if (!existing && $('#subjectSearch')) $('#subjectSearch').value = '';
      const persisted = saveState();
      closeModal(); renderAll();
      const hasDatedCurriculum = (nextSubject.chapters || []).some(chapter => chapter.plannedDate || (chapter.activities || []).some(activity => activity.plannedDate));
      const hasTrackerSchedule = !!getDeadline(nextSubject) && getDeadline(nextSubject) >= today && (nextSubject.tracking === 'minutes' || nextSubject.metrics.some(validMetric));
      if (!persisted) showToast('Subject added for this session, but browser saving failed. Export a backup before closing.');
      else if (existing) showToast('Subject updated.');
      else if (hasDatedCurriculum || hasTrackerSchedule) showToast('Subject added. Its work is available on the calendar.');
      else showToast('Subject added. Use Schedule task or add dated activities / tracker ranges to plan calendar work.');
    });
    if (existing) $('#deleteSubject').addEventListener('click', () => {
      if (!confirm(`Delete ${existing.name}? Its activity log will remain, but its subject setup will be removed.`)) return;
      state.subjects = state.subjects.filter(item => item.id !== existing.id);
      state.manualTasks = state.manualTasks.map(task => task.subjectId === existing.id ? { ...task, subjectId: '' } : task);
      saveState(); closeModal(); renderAll(); showToast('Subject deleted.');
    });
  }

  function moveTaskToDate(taskId, fromDate, toDate) {
    if (!toDate || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || !parseDate(toDate)) { showToast('Choose a valid destination date.'); return false; }
    if (fromDate === toDate) return false;
    const task = getAllDayTasks(fromDate).find(item => item.id === taskId) || findTaskByIdAcrossDates(taskId);
    if (!task) { showToast('That assignment could not be found. Refresh the calendar and try again.'); return false; }
    if (task.done) { showToast('Completed assignments stay in your history and cannot be moved.'); return false; }
    const chapterMatch = String(taskId).match(/^chapter:([^:]+):(.+)$/);
    const curriculumMatch = String(taskId).match(/^curriculum:([^:]+):([^:]+):(.+)$/);
    if (chapterMatch) {
      const subject = state.subjects.find(item => item.id === chapterMatch[1]);
      const chapter = subject?.chapters?.find(item => item.id === chapterMatch[2]);
      if (!chapter) return false;
      chapter.plannedDate = toDate;
    } else if (curriculumMatch) {
      const found = findCurriculumActivity(curriculumMatch[1], curriculumMatch[2], curriculumMatch[3]);
      if (!found) return false;
      found.activity.plannedDate = toDate;
    } else if (state.manualTasks.some(item => item.id === taskId)) {
      const manual = state.manualTasks.find(item => item.id === taskId);
      manual.date = toDate;
    } else if (String(taskId).startsWith('scheduled:')) {
      const match = String(taskId).match(/^scheduled:(\d{4}-\d{2}-\d{2}):([^:]+):(.+)$/);
      if (!match) return false;
      state.taskMoves[taskId] = {
        date: toDate, fromDate: state.taskMoves[taskId]?.fromDate || fromDate,
        subjectId: task.subject?.id || match[2], metricKey: task.metric?.key || match[3],
        label: task.label, rangeLabel: task.rangeLabel || task.label, quantity: Number(task.quantity) || 1,
        unit: task.unit || 'items', estimatedMinutes: Number(task.estimatedMinutes) || 0
      };
    } else {
      showToast('This assignment type cannot be moved yet.'); return false;
    }
    selectedDate = toDate; calendarCursor = parseDate(toDate);
    saveState(); renderAll(); showView('calendar');
    showToast(`Assignment moved to ${formatDate(toDate)}.`);
    return true;
  }
  function openMoveAssignment(taskId, fromDate) {
    const body = `<div class="subject-form-grid"><label class="field full"><span>Move this assignment to</span><input id="moveTaskDate" type="date" required value="${escapeHtml(fromDate)}" /></label></div><p class="modal-help">The assignment will keep its name, subject, and completion status. Its original day will no longer contain this assignment.</p>`;
    const footer = `<span class="form-error" id="moveTaskError"></span><div class="right-actions"><button class="outline-button" id="cancelMoveTask">Cancel</button><button class="primary-button" id="saveMoveTask">Move assignment</button></div>`;
    openModal('Move assignment', 'RESCHEDULE WORK', body, footer);
    $('#cancelMoveTask').addEventListener('click', closeModal);
    $('#saveMoveTask').addEventListener('click', () => {
      const date = $('#moveTaskDate').value;
      if (!date) { $('#moveTaskError').textContent = 'Choose a destination date.'; return; }
      closeModal(); moveTaskToDate(taskId, fromDate, date);
    });
  }

  function addManualTask(key, editingTask = null, presetSubjectId = '') {
    const task = editingTask ? { ...editingTask } : null;
    const selectedSubjectId = task?.subjectId || presetSubjectId || '';
    const selectedSubject = state.subjects.find(subject => subject.id === selectedSubjectId);
    const subjectOptions = state.subjects.map(subject => `<option value="${escapeHtml(subject.id)}" ${selectedSubjectId === subject.id ? 'selected' : ''}>${escapeHtml(subject.name)}</option>`).join('');
    const defaultTitle = selectedSubject ? `${selectedSubject.name} work` : '';
    const body = `<div class="subject-form-grid"><label class="field full"><span>Task name</span><input id="manualTitle" placeholder="e.g. Finish chapter questions" required value="${escapeHtml(task?.title || defaultTitle)}" /></label><label class="field"><span>Subject</span><select id="manualSubject"><option value="">Personal / other</option>${subjectOptions}</select></label><label class="field"><span>Amount</span><input id="manualQuantity" type="number" min="0" step="0.5" placeholder="Optional" value="${escapeHtml(task?.quantity ?? '')}" /></label><label class="field"><span>Unit</span><input id="manualUnit" value="${escapeHtml(task?.unit || 'tasks')}" placeholder="pages, minutes, exercises…" /></label><label class="field"><span>Date</span><input id="manualDate" type="date" value="${escapeHtml(task?.date || key)}" /></label></div><p class="modal-help">This task is placed only on the date you choose. Daymark will not move it automatically.</p>`;
    const footer = `<span class="form-error" id="manualTaskError"></span><div class="right-actions"><button class="outline-button" id="cancelManualTask">Cancel</button><button class="primary-button" id="saveManualTask">${task ? 'Save changes' : 'Add task'}</button></div>`;
    openModal(task ? 'Edit task' : 'Add a task', 'DAILY PLAN', body, footer);
    $('#cancelManualTask').addEventListener('click', closeModal);
    $('#saveManualTask').addEventListener('click', () => {
      const title = $('#manualTitle').value.trim(), date = $('#manualDate').value;
      if (!title || !date) { $('#manualTaskError').textContent = 'Enter a task name and date.'; return; }
      const values = { date, title, subjectId: $('#manualSubject').value, quantity: Math.max(0, Number($('#manualQuantity').value) || 0), unit: $('#manualUnit').value.trim() || 'tasks' };
      if (task) Object.assign(state.manualTasks.find(item => item.id === task.id), values);
      else state.manualTasks.push({ id: makeId('task'), ...values, done: false, note: '' });
      selectedDate = date; calendarCursor = parseDate(date); saveState(); closeModal(); renderAll(); showView('calendar'); showToast(task ? 'Task updated.' : 'Task added to your day.');
    });
  }
  function logSubjectWork(subjectId) {
    const subject = state.subjects.find(item => item.id === subjectId);
    if (!subject) return;
    const isMinutes = subject.tracking === 'minutes';
    const metricOptions = subject.metrics.map(item => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)} (${escapeHtml(item.unit)})</option>`).join('');
    const body = `<div class="subject-form-grid"><label class="field full"><span>What did you work on?</span><input id="logLabel" value="${escapeHtml(subject.name)} work" /></label><label class="field"><span>Tracker</span><select id="logMetric">${isMinutes ? '<option value="minutes">Study time</option>' : metricOptions || '<option value="custom">General activity</option>'}</select></label><label class="field"><span>Amount completed</span><input id="logQuantity" type="number" min="0" step="0.5" value="${isMinutes ? subject.dailyMinutes || 50 : 1}" /></label><label class="field"><span>Date</span><input id="logDate" type="date" value="${escapeHtml(today)}" /></label><label class="field full"><span>Notes (optional)</span><input id="logNote" placeholder="What did you cover?" /></label></div>`;
    const footer = `<span class="form-error" id="logError"></span><div class="right-actions"><button class="outline-button" id="cancelLog">Cancel</button><button class="primary-button" id="saveLog">Save activity</button></div>`;
    openModal(`Log ${subject.name}`, 'COMPLETED WORK', body, footer);
    $('#cancelLog').addEventListener('click', closeModal);
    $('#saveLog').addEventListener('click', () => {
      const quantity = Number($('#logQuantity').value), metricKey = $('#logMetric').value;
      const logDate = $('#logDate').value || today;
      if (!Number.isFinite(quantity) || quantity <= 0) { $('#logError').textContent = 'Enter an amount greater than zero.'; return; }
      const metricItem = subject.metrics.find(item => item.key === metricKey);
      let rangeLabel = '';
      if (metricItem && metricItem.next !== '') {
        const start = Number(metricItem.next);
        const actual = Math.min(quantity, metricItem.end === '' ? quantity : Math.max(0, Number(metricItem.end) - start + 1));
        if (actual <= 0) { $('#logError').textContent = 'That tracker is already complete. Adjust its current position to log more.'; return; }
        rangeLabel = `${metricItem.label} ${formatNumber(start)}–${formatNumber(start + actual - 1)}`;
        metricItem.next = start + actual;
      }
      state.logs.push({ id: makeId('log'), date: logDate, subjectId, subjectName: subject.name, metricKey: metricItem?.key || '', label: $('#logLabel').value.trim() || subject.name, rangeLabel, quantity, unit: metricItem?.unit || (isMinutes ? 'minutes' : 'activities'), minutes: isMinutes ? quantity : 0, note: $('#logNote').value.trim(), source: 'manual-log', createdAt: new Date().toISOString() });
      saveState(); closeModal(); renderAll(); showToast('Activity saved to your log.');
    });
  }

  function renderSettingsTab(tab) {
    $$('.settings-nav button').forEach(button => button.classList.toggle('selected', button.dataset.settingsTab === tab));
    $$('.settings-section').forEach(section => section.classList.toggle('active-settings', section.id === `settings-${tab}`));
  }
  function saveSchoolDates() {
    const start = $('#schoolStart').value, end = $('#schoolEnd').value;
    if (start && end && end < start) { $('#schoolSettingsFeedback').textContent = 'End date must be after the start date.'; return; }
    state.settings.schoolStart = start; state.settings.schoolEnd = end;
    saveState(); renderAll(); $('#schoolSettingsFeedback').textContent = 'Saved'; showToast('School dates saved.');
  }
  function saveStudyDays() {
    if (!state.settings.weekdays.length) { $('#scheduleFeedback').textContent = 'Choose at least one study day.'; return; }
    state.settings.maxDailyMinutes = clamp(Number($('#maxDailyMinutes').value) || 0, 0, 600);
    saveState(); renderAll(); $('#scheduleFeedback').textContent = 'Saved'; showToast('Study schedule saved.');
  }

  function getPeriodRange(range) {
    const selected = (range === 'month' && activeView === 'calendar' && calendarCursor) ? calendarCursor : (parseDate(selectedDate) || parseDate(today));
    if (range === 'week') {
      const start = startOfWeekMonday(selected);
      return { start: dateKey(start), end: dateKey(addDays(start, 6)), label: `Week of ${formatDate(dateKey(start))}` };
    }
    if (range === 'month') {
      const start = new Date(selected.getFullYear(), selected.getMonth(), 1, 12);
      const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 12);
      return { start: dateKey(start), end: dateKey(end), label: monthLabel(selected) };
    }
    const dates = state.logs.map(log => log.date).filter(Boolean).sort();
    return { start: dates[0] || today, end: dates[dates.length - 1] || today, label: 'All logged activity' };
  }
  function getDatesInRange(startKey, endKey) {
    const dates = [];
    for (let d = parseDate(startKey), end = parseDate(endKey); d && end && d <= end; d = addDays(d, 1)) dates.push(dateKey(d));
    return dates;
  }
  function printPlanner() {
    const mode = $('#printMode').value, rangeType = $('#printRange').value;
    // Explicitly set the active page size at print time. Named @page rules are
    // not honored consistently by every Chromium build or printer driver.
    let pageStyle = $('#daymarkPrintPageStyle');
    if (!pageStyle) { pageStyle = document.createElement('style'); pageStyle.id = 'daymarkPrintPageStyle'; document.head.appendChild(pageStyle); }
    pageStyle.textContent = rangeType === 'week'
      ? '@page { size: letter landscape; margin: .38in; }'
      : '@page { size: letter portrait; margin: .5in; }';
    const range = getPeriodRange(rangeType);
    const includeStats = $('#printStats').checked, includeNotes = $('#printNotes').checked, includeSubjects = $('#printSubjectSummary').checked, includeReview = $('#printWeeklyReview').checked;
    const dates = getDatesInRange(range.start, range.end);
    const columns = dates.filter(key => state.settings.weekdays.includes(parseDate(key).getDay()) || key === selectedDate || getAllDayTasksForPrint(key).length > 0);
    if (!columns.length) columns.push(...dates.slice(0, 5));
    let content = '';
    const heading = `<header class="print-heading"><div class="print-brand">DAYMARK <span>HOMESCHOOL PLANNER</span></div><h1>${mode === 'blank' ? 'Blank schedule' : mode === 'planned' ? 'Planned schedule' : 'Completed work log'}</h1><p>${escapeHtml(range.label)} · ${escapeHtml(formatDate(range.start))} – ${escapeHtml(formatDate(range.end))}</p><div class="print-meta">Printed ${escapeHtml(formatDate(today))}</div></header>`;
    const subjectSummary = includeSubjects ? renderPrintSubjectSummary() : '';
    if (mode === 'blank') {
      content = rangeType === 'week' ? renderBlankWeek(columns) : renderBlankMonth(dates, range);
      if (includeStats) content += `<div class="print-stats-grid"><div><strong>Weekly focus</strong><span>____________________________</span></div><div><strong>Notes</strong><span>____________________________</span></div><div><strong>Completed</strong><span>________ / ________</span></div></div>`;
    } else if (mode === 'planned') {
      const planned = dates.flatMap(key => getAllDayTasksForPrint(key).map(task => ({ ...task, date: key })));
      content = rangeType === 'week' ? renderPlannedWeek(columns, planned) : (planned.length ? `<table class="print-table"><thead><tr><th>Date</th><th>Subject</th><th>Assignment</th><th>Target</th><th>Done</th></tr></thead><tbody>${planned.map(task => `<tr><td>${escapeHtml(formatDate(task.date))}</td><td>${escapeHtml(task.subject?.name || 'Personal')}</td><td>${escapeHtml(task.rangeLabel || task.label)}</td><td>${formatNumber(task.quantity)} ${escapeHtml(task.unit)}</td><td>${task.done ? '✓' : '□'}</td></tr>`).join('')}</tbody></table>` : `<div class="print-empty">No planned assignments in this period. Add finish dates and curriculum ranges to generate daily targets.</div>`);
      if (includeStats) content += `<div class="print-stats-grid"><div><strong>Planned items</strong><span>${planned.length}</span></div><div><strong>Completed</strong><span>${planned.filter(task => task.done).length}</span></div><div><strong>Still open</strong><span>${planned.filter(task => !task.done).length}</span></div></div>`;
      if (includeNotes) content += renderPrintDayNotes(dates);
    } else {
      const logs = state.logs.filter(log => log.date >= range.start && log.date <= range.end).slice().sort((a, b) => a.date.localeCompare(b.date));
      content = logs.length ? `<table class="print-table"><thead><tr><th>Date</th><th>Subject</th><th>Type</th><th>Chapter / lesson</th><th>Work completed</th><th>Amount</th>${includeNotes ? '<th>Notes</th>' : ''}</tr></thead><tbody>${logs.map(log => `<tr><td>${escapeHtml(formatDate(log.date))}</td><td>${escapeHtml(log.subjectName || 'Personal work')}</td><td>${escapeHtml(log.activityType ? (ACTIVITY_LABELS[log.activityType] || log.activityType) : (log.unit || 'Work'))}</td><td>${escapeHtml([log.structureLabel, log.chapterNumber, log.chapterTitle].filter(Boolean).join(' ') || '—')}</td><td>${escapeHtml(log.rangeLabel || log.label || 'Activity')}</td><td>${formatNumber(log.quantity || log.minutes || 0)} ${escapeHtml(log.unit || 'items')}</td>${includeNotes ? `<td>${escapeHtml(log.note || '—')}</td>` : ''}</tr>`).join('')}</tbody></table>` : `<div class="print-empty">No completed work has been logged for this period yet.</div>`;
      if (includeStats) content += renderPrintStats(logs);
      if (includeNotes) content += renderPrintDayNotes(dates);
    }
    if (includeReview && rangeType === 'week' && mode !== 'blank') content += renderPrintWeeklyReview(range.start, range.end);
    $('#printOutput').innerHTML = `${heading}<main class="print-content">${content}${subjectSummary}</main><footer class="print-footer">Daymark · Your learning, at your pace</footer>`;
    $('#printOutput').classList.add('printing');
    $('#printOutput').classList.toggle('printing-week', rangeType === 'week');
    setTimeout(() => window.print(), 100);
  }
  function getAllDayTasksForPrint(key) {
    const live = getAllDayTasks(key);
    const liveIds = new Set(live.map(task => task.id));
    const completedPast = state.logs.filter(log => log.date === key && log.taskId && !liveIds.has(log.taskId)).map(log => {
      const subject = state.subjects.find(s => s.id === log.subjectId) || null;
      return { id: log.taskId, subject, label: log.label, rangeLabel: log.rangeLabel || log.label, quantity: log.quantity, unit: log.unit, done: true };
    });
    return [...live, ...completedPast];
  }
  function renderBlankWeek(dates) {
    const dateHeaders = dates.map(key => `<th>${DAY_SHORT[parseDate(key).getDay()]}<strong>${parseDate(key).getDate()}</strong></th>`).join('');
    const subjects = state.subjects.map(subject => subject.name);
    if (!subjects.length) subjects.push('Subject 1', 'Subject 2', 'Subject 3', 'Subject 4');
    const rows = subjects.map(name => `<tr><th>${escapeHtml(name)}</th>${dates.map(() => '<td><div class="blank-cell-lines"><i></i><i></i><i></i></div></td>').join('')}</tr>`).join('');
    return `<table class="print-table print-week-matrix blank-week-matrix"><thead><tr><th>SUBJECT</th>${dateHeaders}</tr></thead><tbody>${rows}<tr><th>Notes</th>${dates.map(() => '<td><div class="blank-cell-lines"><i></i><i></i></div></td>').join('')}</tr></tbody></table>`;
  }
  function renderPlannedWeek(dates, planned) {
    const rows = state.subjects.map(subject => ({ id: subject.id, name: subject.name }));
    if (planned.some(task => !task.subject)) rows.push({ id: '', name: 'Personal / Other' });
    const header = dates.map(key => `<th><span>${DAY_SHORT[parseDate(key).getDay()]}</span><strong>${parseDate(key).getDate()}</strong></th>`).join('');
    const body = rows.map(row => `<tr><th>${escapeHtml(row.name)}</th>${dates.map(key => {
      const items = planned.filter(task => task.date === key && (row.id ? task.subject?.id === row.id : !task.subject));
      return `<td>${items.length ? items.map(task => `<div class="print-week-item ${task.done ? 'done' : ''}"><strong>${escapeHtml(task.rangeLabel || task.label)}</strong><small>${formatNumber(task.quantity)} ${escapeHtml(task.unit)} ${task.done ? '✓' : '□'}</small></div>`).join('') : '<span class="print-week-empty">—</span>'}</td>`;
    }).join('')}</tr>`).join('');
    return `<table class="print-table print-week-matrix"><thead><tr><th>SUBJECT</th>${header}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function renderPrintDayNotes(dates) {
    const notes = dates.map(key => ({ key, note: String(state.dayNotes?.[key] || '').trim() })).filter(item => item.note);
    return notes.length ? `<div class="print-section-title">DAILY NOTES</div><div class="print-day-notes">${notes.map(item => `<section><strong>${escapeHtml(formatDate(item.key))}</strong><p>${escapeHtml(item.note)}</p></section>`).join('')}</div>` : '';
  }
  function renderPrintWeeklyReview(start, end) {
    const tasks = getDatesInRange(start, end).flatMap(key => getAllDayTasksForPrint(key));
    const logs = state.logs.filter(log => log.date >= start && log.date <= end);
    const mins = logs.reduce((sum, log) => sum + (Number(log.minutes) || (String(log.unit).toLowerCase().includes('min') ? Number(log.quantity) || 0 : 0)), 0);
    return `<div class="print-section-title">WEEKLY REVIEW</div><div class="print-stats-grid"><div><strong>Assignments planned</strong><span>${tasks.length}</span></div><div><strong>Assignments completed</strong><span>${tasks.filter(task => task.done).length}</span></div><div><strong>Time logged</strong><span>${formatNumber(mins)} min</span></div></div>`;
  }
  function renderBlankMonth(dates, range) {
    const first = parseDate(range.start), weekday = first.getDay();
    const leading = Array.from({ length: weekday }, () => '<div class="blank-month-day blank-placeholder"></div>').join('');
    const days = dates.map(key => `<section class="blank-month-day"><strong>${parseDate(key).getDate()}</strong><div class="blank-month-lines"><i></i><i></i><i></i></div></section>`).join('');
    const total = Math.ceil((weekday + dates.length) / 7) * 7;
    const trailing = Array.from({ length: total - weekday - dates.length }, () => '<div class="blank-month-day blank-placeholder"></div>').join('');
    return `<div class="blank-month-grid">${DAY_SHORT.map(day => `<div class="blank-month-heading">${day}</div>`).join('')}${leading}${days}${trailing}</div>`;
  }
  function renderPrintStats(logs) {
    const count = logs.length;
    const mins = logs.reduce((sum, log) => sum + (Number(log.minutes) || (log.unit === 'minutes' ? Number(log.quantity) || 0 : 0)), 0);
    const bySubject = new Map();
    logs.forEach(log => bySubject.set(log.subjectName || 'Personal work', (bySubject.get(log.subjectName || 'Personal work') || 0) + 1));
    return `<div class="print-section-title">ACTIVITY SUMMARY</div><div class="print-stats-grid"><div><strong>Activities logged</strong><span>${count}</span></div><div><strong>Time recorded</strong><span>${formatNumber(mins)} minutes</span></div><div><strong>Subjects worked on</strong><span>${bySubject.size}</span></div></div><ul class="print-subject-totals">${[...bySubject.entries()].map(([name, total]) => `<li><span>${escapeHtml(name)}</span><strong>${total} entr${total === 1 ? 'y' : 'ies'}</strong></li>`).join('')}</ul>`;
  }
  function renderPrintSubjectSummary() {
    if (!state.subjects.length) return '';
    return `<section class="print-subject-summary"><div class="print-section-title">SUBJECT PROGRESS</div><table class="print-table"><thead><tr><th>Subject</th><th>Curriculum</th><th>Progress</th><th>Finish date</th><th>Chapters / activities</th></tr></thead><tbody>${state.subjects.map(subject => {
      const p = subjectProgress(subject), structure = curriculumStats(subject);
      const curriculumLabel = structure.chapters ? `${structure.chaptersCompleted}/${structure.chapters} sections · ${structure.completed}/${structure.total} activities` : '—';
      return `<tr><td>${escapeHtml(subject.name)}</td><td>${escapeHtml(subject.curriculum || '—')}</td><td>${p.percent === null ? escapeHtml(p.completedLabel) : `${Math.round(p.percent)}%`}</td><td>${escapeHtml(getDeadline(subject) ? formatDate(getDeadline(subject)) : '—')}</td><td>${escapeHtml(curriculumLabel)}</td></tr>`;
    }).join('')}</tbody></table></section>`;
  }
  function openPrintModal() {
    $('#printBackdrop').hidden = false;
    updatePrintRangeOptions();
  }
  function closePrintModal() { $('#printBackdrop').hidden = true; }
  function updatePrintRangeOptions() {
    const mode = $('#printMode').value;
    const all = $('#printRange').querySelector('option[value="all"]');
    all.disabled = mode !== 'completed';
    if (mode !== 'completed' && $('#printRange').value === 'all') $('#printRange').value = 'week';
    $('#printRangeNote').textContent = $('#printRange').value === 'week' ? 'The week containing your selected calendar date will be printed.' : $('#printRange').value === 'month' ? 'The calendar month containing your selected date will be printed.' : 'Every activity entry in your log will be included.';
    $('#printSubjectSummary').checked = mode !== 'blank';
  }

  function exportBackup() {
    const payload = { app: 'Daymark', exportedAt: new Date().toISOString(), data: state };
    downloadFile(`daymark-backup-${today}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }
  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = parsed.data || parsed;
        if (!imported || !Array.isArray(imported.subjects) || !imported.settings) throw new Error('This does not look like a Daymark backup.');
        if (!confirm('Restore this backup? It will replace the planner currently saved in this browser.')) return;
        const defaults = defaultState();
      state = { ...defaults, ...imported, settings: { ...defaults.settings, ...imported.settings }, subjects: imported.subjects.map(normalizeSubject), logs: Array.isArray(imported.logs) ? imported.logs : [], manualTasks: Array.isArray(imported.manualTasks) ? imported.manualTasks : [], taskOverrides: imported.taskOverrides && typeof imported.taskOverrides === 'object' ? imported.taskOverrides : {}, lockedTasks: Array.isArray(imported.lockedTasks) ? imported.lockedTasks : [], planSnapshots: imported.planSnapshots && typeof imported.planSnapshots === 'object' ? imported.planSnapshots : {}, dayNotes: imported.dayNotes && typeof imported.dayNotes === 'object' ? imported.dayNotes : {} };
        saveState(); renderAll(); showToast('Backup restored.');
      } catch (error) { alert(`Could not restore this file: ${error.message}`); }
    };
    reader.readAsText(file);
  }
  function clearAllData() {
    if (!confirm('Clear all Daymark data from this browser? Export a backup first if you may need it later.')) return;
    state = { ...defaultState(), subjects: [] }; saveState(); renderAll(); showToast('Planner data cleared.');
  }
  function exportProgressSummary() {
    const lines = ['DAYMARK — HOMESCHOOL PROGRESS SUMMARY', `Generated: ${formatDate(today)}`, '', `School year: ${state.settings.schoolStart || 'Not set'} to ${state.settings.schoolEnd || 'Not set'}`, '', 'SUBJECTS'];
    state.subjects.forEach(subject => {
      const p = subjectProgress(subject);
      const structure = curriculumStats(subject);
      lines.push(`${subject.name} — ${subject.curriculum}`, `Progress: ${p.percent === null ? p.completedLabel : `${Math.round(p.percent)}%`}`, `Finish date: ${getDeadline(subject) || 'Not set'}`, `Chapters / sections: ${structure.chaptersCompleted}/${structure.chapters} completed`, `Curriculum activities: ${structure.completed}/${structure.total} completed`, '');
    });
    lines.push('ACTIVITY LOG');
    state.logs.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(log => lines.push(`${log.date} | ${log.subjectName} | ${log.label} | ${log.quantity} ${log.unit}${log.note ? ` | ${log.note}` : ''}`));
    downloadFile(`daymark-progress-${today}.txt`, lines.join('\n'));
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }
  function exportActivityCsv() {
    const headers = ['Date', 'Subject', 'Curriculum', 'Section type', 'Section number', 'Section name', 'Activity type', 'Activity', 'Range / description', 'Quantity', 'Unit', 'Minutes', 'Notes', 'Source'];
    const rows = state.logs.slice().sort((a, b) => a.date.localeCompare(b.date)).map(log => {
      const subject = state.subjects.find(item => item.id === log.subjectId);
      return [log.date, log.subjectName || subject?.name || 'Personal work', subject?.curriculum || log.curriculum || '', log.structureLabel || '', log.chapterNumber || '', log.chapterTitle || '', log.activityType ? (ACTIVITY_LABELS[log.activityType] || log.activityType) : '', log.label || '', log.rangeLabel || '', log.quantity ?? '', log.unit || '', log.minutes || '', log.note || '', log.source || ''];
    });
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    downloadFile(`daymark-activity-${today}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8');
    showToast('Activity CSV exported.');
  }

  // Curriculum import: local-first Ollama vision analysis, with local OCR/manual text as fallbacks.
  const IMPORT_ACTIVITY_TYPES = ['video', 'experiment', 'test', 'reading', 'exercise', 'quiz', 'project'];
  function loadExternalScript(src, globalName) {
    return new Promise((resolve, reject) => {
      if (window[globalName]) { resolve(window[globalName]); return; }
      const existing = [...document.scripts].find(script => script.src === src);
      if (existing) { existing.addEventListener('load', () => resolve(window[globalName])); existing.addEventListener('error', () => reject(new Error('Could not load ' + globalName))); return; }
      const script = document.createElement('script'); script.src = src; script.async = true;
      script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error(globalName + ' loaded without exposing its library.'));
      script.onerror = () => reject(new Error('Could not load ' + globalName + '. Check your internet connection.'));
      document.head.appendChild(script);
    });
  }
  function parseCurriculumText(text, requestedLabel = 'Chapter') {
    const lines = String(text || '').replace(/\r/g, '\n').split('\n')
      .map(line => line.replace(/[\u00a0\t]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const found = [], seen = new Set();
    const label = String(requestedLabel || 'Chapter').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labelPattern = new RegExp(`(?:${label}|chapter|unit|lesson|section|module|part|topic)\\s*([0-9]+[a-z]?|[ivxlcdm]+)?\\s*[:.)\\-–—]?\\s*(.*)`, 'i');
    for (const line of lines) {
      if (/^(table of contents|contents|index|appendix|bibliography|glossary|references|page|chapter|unit|lesson)$/i.test(line)) continue;
      let titlePart = '', page = '', hasLeader = false;
      let match = line.match(/^(.*?)(?:\.{2,}|…{2,}|·{2,})\s*(\d{1,4})\s*$/);
      if (match) { titlePart = match[1].trim(); page = match[2]; hasLeader = true; }
      else {
        match = line.match(/^(.*?)\s{2,}(\d{1,4})\s*$/);
        if (match) { titlePart = match[1].trim(); page = match[2]; }
        else {
          match = line.match(/^(.*\S)\s+(\d{1,4})\s*$/);
          if (!match) continue;
          titlePart = match[1].trim(); page = match[2];
          if (!/(chapter|unit|lesson|section|module|part|topic|^\d+[.)\s-])/i.test(titlePart)) continue;
        }
      }
      const pageNumber = Number(page);
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 10000) continue;
      let number = String(found.length + 1), title = titlePart;
      const explicit = titlePart.match(labelPattern);
      if (explicit) {
        number = explicit[1] || number;
        title = explicit[2] || `${requestedLabel || 'Section'} ${number}`;
      } else {
        const numbered = titlePart.match(/^(\d+[a-z]?)[.)\s:-]+(.+)$/i);
        if (numbered) { number = numbered[1]; title = numbered[2]; }
        else if (!hasLeader && !/(chapter|unit|lesson|section|module|part|topic)/i.test(titlePart)) continue;
      }
      title = title.replace(/[.·\s]+$/, '').trim();
      if (!title || title.length < 2) continue;
      const key = `${number.toLowerCase()}|${title.toLowerCase()}|${pageNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ number, title, startPage: pageNumber, endPage: '', plannedDate: '', completed: false, completedAt: '', completedLogId: '', activities: [], confidence: 'review', activityCounts: {} });
    }
    found.sort((a, b) => Number(a.startPage) - Number(b.startPage));
    for (let i = 0; i < found.length - 1; i++) {
      if (found[i + 1].startPage > found[i].startPage) found[i].endPage = found[i + 1].startPage - 1;
    }
    return found;
  }
  function builtinImportTemplates() {
    return [
      { id: 'none', name: 'Sections only', structureLabel: 'Chapter', counts: { video: 0, experiment: 0, test: 0, reading: 0, exercise: 0, quiz: 0, project: 0 } },
      { id: 'biology', name: 'Biology — 2 videos + test', structureLabel: 'Chapter', counts: { video: 2, experiment: 0, test: 1, reading: 0, exercise: 0, quiz: 0, project: 0 } },
      { id: 'lesson', name: 'Lesson — reading + exercises', structureLabel: 'Lesson', counts: { video: 0, experiment: 0, test: 0, reading: 1, exercise: 2, quiz: 0, project: 0 } },
      { id: 'history', name: 'History — reading + quiz', structureLabel: 'Unit', counts: { video: 0, experiment: 0, test: 0, reading: 1, exercise: 0, quiz: 1, project: 0 } },
      ...(state.curriculumTemplates || []).map(normalizeCurriculumTemplate)
    ].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index);
  }
  let importPdfPageImages = [];
  async function pdfPagesToTextAndImages(file, progress) {
    const pdfjs = await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const textParts = [], images = [];
    const totalPages = Math.min(pdf.numPages, 20);
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      progress(`Reading PDF page ${pageNumber} of ${totalPages}…`);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lineMap = new Map();
      for (const item of textContent.items) {
        const value = String(item.str || '').trim();
        if (!value) continue;
        const y = Math.round(Number(item.transform?.[5] || 0) / 3) * 3;
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y).push({ x: Number(item.transform?.[4] || 0), value });
      }
      const pageText = [...lineMap.entries()].sort((a, b) => b[0] - a[0])
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map(item => item.value).join(' ')).join('\n');
      if (pageText.trim()) textParts.push(pageText);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', .78));
    }
    return { text: textParts.join('\n'), images };
  }
  async function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }
  // AI-first import: send the original page images to the vision model directly.
  // PDF pages are rendered to images with PDF.js; Tesseract is not required.
  async function prepareCurriculumImagesForAi(files, progress) {
    const images = [], referenceText = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const result = await pdfPagesToTextAndImages(file, progress);
        if (result.text.trim()) referenceText.push(`Embedded text from ${file.name} (reference only):\n${result.text}`);
        images.push(...result.images);
      } else if (file.type.startsWith('image/')) {
        if (file.size > 24 * 1024 * 1024) throw new Error(`${file.name} is larger than 24 MB. Please resize it or export it at a lower resolution.`);
        progress(`Preparing image ${i + 1} of ${files.length} for AI…`);
        images.push(await readFileAsDataUrl(file));
      } else {
        throw new Error(`${file.name} is not a supported image or PDF.`);
      }
      if (images.length > 20) throw new Error('The selected files contain more than 20 pages. Split them into smaller imports.');
    }
    if (!images.length) throw new Error('No page images could be prepared.');
    return { images, text: referenceText.join('\n\n') };
  }
  async function runLocalOcr(files, progress) {
    const textParts = [], images = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const result = await pdfPagesToTextAndImages(file, progress);
        if (result.text.trim().length > 30) textParts.push(result.text);
        else {
          const tesseract = await loadExternalScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'Tesseract');
          for (let p = 0; p < result.images.length; p++) {
            progress(`OCR on PDF ${i + 1}, page ${p + 1}…`);
            const resultOcr = await tesseract.recognize(result.images[p], 'eng');
            textParts.push(resultOcr.data.text || '');
          }
        }
        images.push(...result.images);
      } else {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 18 * 1024 * 1024) throw new Error(`${file.name} is larger than 18 MB. Please resize it or use a PDF.`);
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file); });
        images.push(dataUrl);
        progress(`Recognizing text in image ${i + 1} of ${files.length}…`);
        const tesseract = await loadExternalScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'Tesseract');
        const result = await tesseract.recognize(dataUrl, 'eng');
        textParts.push(result.data.text || '');
      }
    }
    return { text: textParts.join('\n'), images };
  }
  async function optimizeImageForAi(dataUrl, maxSide = 3600, quality = .88) {
    const image = new Image();
    image.src = dataUrl;
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('A page image could not be prepared for AI interpretation.')); });
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }
  function parseAiCurriculumResponse(data) {
    const candidate = data?.curriculum || data?.result || data;
    const list = Array.isArray(candidate?.sections) ? candidate.sections : (Array.isArray(candidate?.chapters) ? candidate.chapters : []);
    return list.map((item, index) => {
      const detectedActivities = Array.isArray(item.activities) ? item.activities.map(activity => ({
        type: ACTIVITY_TYPES.some(type => type.value === activity.type) ? activity.type : 'other',
        title: String(activity.title || 'Activity').trim(),
        confidence: activity.confidence || 'medium'
      })).filter(activity => activity.title) : [];
      const detectedExperiments = detectedActivities.filter(activity => activity.type === 'experiment').length;
      return {
        number: String(item.number ?? index + 1), title: String(item.title || item.name || `Section ${index + 1}`),
        startPage: item.startPage == null ? '' : String(item.startPage), endPage: item.endPage == null ? '' : String(item.endPage),
        plannedDate: '', completed: false, completedAt: '', completedLogId: '', activities: [],
        detectedActivities, activityCounts: detectedExperiments ? { experiment: detectedExperiments } : {}, confidence: item.confidence || 'review'
      };
    }).filter(item => item.title.trim());
  }
  function importStatus(message, kind = 'info') {
    const node = $('#curriculumImportStatus');
    if (node) { node.textContent = message; node.className = `import-status ${kind}`; }
  }
  function renderImportSectionPreview(sections) {
    const target = $('#curriculumSectionPreview');
    if (!target) return;
    if (!sections.length) { target.innerHTML = '<p class="curriculum-help">No sections detected yet. Analyze uploaded images with AI, use local OCR, or paste text above.</p>'; return; }
    const defaultExperiments = Number($('#importCount-experiment')?.value) || 0;
    const warningMarkup = detectedWarnings.length
      ? `<div class="import-status warning"><strong>AI review notes</strong><br>${detectedWarnings.map(escapeHtml).join('<br>')}</div>`
      : '';
    target.innerHTML = warningMarkup + `<div class="import-preview-heading"><strong>${sections.length} sections detected</strong><span>Edit titles, page ranges, and experiment counts before importing.</span></div>` + sections.map((item, index) => `
      <div class="import-section-row" data-import-section="${index}">
        <label class="field"><span>Number</span><input data-import-field="number" value="${escapeHtml(item.number)}" /></label>
        <label class="field import-section-title"><span>Title</span><input data-import-field="title" value="${escapeHtml(item.title)}" /></label>
        <label class="field"><span>Start page</span><input data-import-field="startPage" type="number" min="1" value="${escapeHtml(item.startPage)}" /></label>
        <label class="field"><span>End page</span><input data-import-field="endPage" type="number" min="1" value="${escapeHtml(item.endPage)}" /></label>
        <label class="field"><span>Experiments total</span><input data-import-field="experimentCount" type="number" min="0" max="30" value="${escapeHtml(item.activityCounts?.experiment ?? defaultExperiments)}" /></label>
        <button class="quiet-button import-remove-section" data-remove-import-section="${index}" title="Remove section">×</button>
        ${item.detectedActivities?.length ? `<div class="import-detected-activities"><strong>Found in the contents:</strong> ${item.detectedActivities.map(activity => `<span class="import-detected-chip">${escapeHtml(ACTIVITY_LABELS[activity.type] || 'Other')}: ${escapeHtml(activity.title)}</span>`).join('')}</div>` : '<div class="import-detected-activities muted">No individual activities were clearly listed under this section. The selected template will supply its default activities.</div>'}
      </div>`).join('') + `<button class="outline-button" id="addImportSection">＋ Add section</button>`;
    target.querySelectorAll('[data-import-section] input').forEach(input => input.addEventListener('input', event => {
      const row = event.target.closest('[data-import-section]'), index = Number(row.dataset.importSection);
      const field = event.target.dataset.importField;
      if (field === 'experimentCount') {
        sections[index].activityCounts ||= {};
        const requested = clamp(Number(event.target.value) || 0, 0, 30);
        sections[index].activityCounts.experiment = requested;
        const detected = Array.isArray(sections[index].detectedActivities) ? sections[index].detectedActivities : [];
        const namedExperiments = detected.filter(activity => activity.type === 'experiment');
        if (requested < namedExperiments.length) {
          let remove = namedExperiments.length - requested;
          for (let i = detected.length - 1; i >= 0 && remove > 0; i--) {
            if (detected[i].type === 'experiment') { detected.splice(i, 1); remove--; }
          }
          sections[index].detectedActivities = detected;
          renderImportSectionPreview(sections);
        }
      } else sections[index][field] = event.target.value;
    }));
    target.querySelectorAll('[data-remove-import-section]').forEach(button => button.addEventListener('click', () => {
      sections.splice(Number(button.dataset.removeImportSection), 1); renderImportSectionPreview(sections);
    }));
    $('#addImportSection')?.addEventListener('click', () => {
      sections.push({ number: String(sections.length + 1), title: `New section ${sections.length + 1}`, startPage: '', endPage: '', plannedDate: '', completed: false, completedAt: '', completedLogId: '', activities: [], detectedActivities: [], activityCounts: {} });
      renderImportSectionPreview(sections);
    });
  }
  function openCurriculumImportWizard() {
    let files = [], detectedSections = [], detectedImages = [], detectedText = '', detectedWarnings = [];
    const templates = builtinImportTemplates();
    const templateOptions = templates.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    const targetOptions = `<option value="new">Create a new subject</option>` + state.subjects.map(subject => `<option value="${escapeHtml(subject.id)}">Add to ${escapeHtml(subject.name)}</option>`).join('');
    const body = `
      <div class="curriculum-import-wizard">
        <section class="import-step"><div class="import-step-title"><span>1</span><div><strong>Upload your table of contents</strong><small>Images and PDF files are supported. You can select multiple files.</small></div></div>
          <label class="import-upload-zone" for="curriculumFiles"><span class="upload-symbol">⇧</span><strong>Choose images or PDFs</strong><small>PNG, JPG, WebP, or PDF · up to 20 PDF pages</small><input id="curriculumFiles" type="file" accept="image/*,.pdf,application/pdf" multiple /></label>
          <div id="curriculumFileList" class="import-file-list">No files selected.</div>
          <div class="import-action-row"><button class="primary-button" id="interpretCurriculumAI">Analyze with local AI</button><button class="outline-button" id="readCurriculumFiles">Use local OCR fallback</button></div>
          <div id="curriculumImportStatus" class="import-status">AI vision runs locally through Ollama. Start Daymark with Start-Daymark.bat and select an installed vision model below. OCR is only a fallback.</div>
        </section>
        <section class="import-step"><div class="import-step-title"><span>2</span><div><strong>Review the detected structure</strong><small>AI results appear in the section preview. You can also paste text manually as a fallback.</small></div></div>
          <label class="field full"><span>Optional reference text / manual table-of-contents text</span><textarea id="curriculumRawText" rows="5" placeholder="Optional: paste table-of-contents text here if you want to build a preview manually…"></textarea></label>
          <div class="import-action-row"><button class="outline-button" id="parseCurriculumText">Build section preview</button><button class="quiet-button" id="clearCurriculumText">Clear text</button></div>
        </section>
        <section class="import-step"><div class="import-step-title"><span>3</span><div><strong>Choose the subject and activity template</strong><small>Templates create the repeated videos, experiments, tests, readings, or other activities.</small></div></div>
          <div class="field-grid two"><label class="field"><span>Import into</span><select id="curriculumTarget">${targetOptions}</select></label><label class="field"><span>New subject name</span><input id="curriculumSubjectName" placeholder="e.g. Biology" /></label><label class="field"><span>Curriculum / book title</span><input id="curriculumBookName" placeholder="Optional" /></label><label class="field"><span>Section type</span><input id="curriculumStructureLabel" value="Chapter" /></label><label class="field full"><span>Activity template</span><select id="curriculumTemplate">${templateOptions}<option value="custom">Custom activity counts</option></select></label></div>
          <div class="import-count-grid">
            ${[['video','Videos'],['experiment','Experiments'],['test','Tests'],['reading','Readings'],['exercise','Exercises'],['quiz','Quizzes'],['project','Projects']].map(([key,label])=>`<label class="field"><span>${label} per section</span><input id="importCount-${key}" data-import-count="${key}" type="number" min="0" max="30" value="0" /></label>`).join('')}
          </div>
          <label class="print-check import-check"><input id="importCreateReading" type="checkbox" checked><span><strong>Create a reading activity for sections with page ranges</strong><small>Uses the detected start and end pages.</small></span></label>
          <label class="print-check import-check"><input id="importSaveTemplate" type="checkbox"><span><strong>Save these activity counts as a reusable template</strong><small>You can reuse this setup for future books.</small></span></label>
          <label class="field" id="importTemplateNameField" hidden><span>Template name</span><input id="importTemplateName" placeholder="e.g. My science chapters" /></label>
        </section>
        <section class="import-step"><div class="import-step-title"><span>4</span><div><strong>Review sections and scheduling</strong><small>Dates are optional. Unscheduled activities remain in your curriculum until you place them.</small></div></div>
          <div id="curriculumSectionPreview"><p class="curriculum-help">No sections detected yet.</p></div>
          <div class="field-grid two import-date-grid"><label class="field"><span>Schedule from</span><input id="importStartDate" type="date" value="${escapeHtml(nextStudyDate(today))}" /></label><label class="field"><span>Schedule through</span><input id="importEndDate" type="date" value="${escapeHtml(state.settings.schoolEnd || '')}" /></label></div>
          <label class="print-check import-check"><input id="importAutoSchedule" type="checkbox" ${state.settings.schoolEnd ? 'checked' : ''}><span><strong>Spread activities across my study days</strong><small>Places activities in order over the selected date range. This does not move other assignments.</small></span></label>
        </section>
        <details class="import-ai-settings" open><summary>Local AI connection — Ollama</summary>
          <p class="modal-help">Daymark connects to Ollama running on this computer. Your images are sent to your selected local model, not to a paid cloud API. Start Daymark with <strong>Start-Daymark.bat</strong> so the local Python bridge is available.</p>
          <div class="ollama-connection-row"><div id="ollamaConnectionStatus" class="import-status">Checking local Ollama connection…</div><button class="quiet-button" id="checkOllamaConnection" type="button">Test connection</button></div>
          <label class="field full"><span>Installed vision model</span><select id="curriculumOllamaModel"><option value="">Checking installed models…</option></select></label>
          <div class="import-action-row"><button class="outline-button" id="refreshOllamaModels" type="button">Refresh model list</button><button class="quiet-button" id="saveOllamaSettings" type="button">Save model choice</button></div>
          <label class="print-check import-check"><input id="curriculumAiConsent" type="checkbox"><span><strong>I approve processing these images with my local AI model</strong><small>Images remain on this computer and are sent to your local Ollama service. They are not sent to an online AI provider by this feature.</small></span></label>
          <p class="curriculum-help" id="ollamaModelHelp">Only models that advertise vision capability can analyze images. A text-only Qwen 27B model will not work for image input; Daymark checks the capabilities reported by Ollama.</p>
        </details>
      </div>`;
    const footer = `<span class="form-error" id="curriculumImportError"></span><div class="right-actions"><button class="outline-button" id="cancelCurriculumImport">Cancel</button><button class="primary-button" id="applyCurriculumImport">Import curriculum</button></div>`;
    openModal('Import curriculum', 'CURRICULUM SCAN', body, footer, null, true);
    const readFiles = async () => {
      files = [...($('#curriculumFiles')?.files || [])];
      if (!files.length) { importStatus('Choose at least one image or PDF first.', 'warning'); return; }
      if (files.length > 20) { importStatus('Please choose 20 files or fewer per import.', 'warning'); return; }
      try {
        importStatus('Starting local recognition…');
        const result = await runLocalOcr(files, importStatus);
        detectedText = result.text || '';
        detectedWarnings = [];
        detectedImages = result.images || [];
        $('#curriculumRawText').value = detectedText;
        detectedSections = parseCurriculumText(detectedText, $('#curriculumStructureLabel').value);
        if (detectedSections.length) {
          detectedSections.forEach((item, index) => { if (detectedSections[index + 1]?.startPage && !item.endPage) item.endPage = Number(detectedSections[index + 1].startPage) - 1; });
          renderImportSectionPreview(detectedSections);
          importStatus(`Recognized ${detectedSections.length} sections. Review their titles and page ranges below.`, 'success');
        } else {
          renderImportSectionPreview(detectedSections);
          importStatus('Text was read, but section headings were not confidently detected. Edit the text and choose Build section preview, or add sections manually.', 'warning');
        }
      } catch (error) {
        console.error(error);
        importStatus(`${error.message} You can still paste the table-of-contents text manually below.`, 'error');
      }
    };
    $('#curriculumFiles').addEventListener('change', () => {
      files = [...$('#curriculumFiles').files];
      $('#curriculumFileList').textContent = files.length ? files.map(file => `${file.name} (${Math.round(file.size / 1024)} KB)`).join(' · ') : 'No files selected.';
    });
    $('#readCurriculumFiles').addEventListener('click', readFiles);
    $('#parseCurriculumText').addEventListener('click', () => {
      detectedText = $('#curriculumRawText').value;
      detectedWarnings = [];
      detectedSections = parseCurriculumText(detectedText, $('#curriculumStructureLabel').value);
      renderImportSectionPreview(detectedSections);
      importStatus(detectedSections.length ? `Detected ${detectedSections.length} possible sections. Check all page numbers.` : 'No likely section entries found. Add sections manually below.', detectedSections.length ? 'success' : 'warning');
    });
    $('#clearCurriculumText').addEventListener('click', () => { $('#curriculumRawText').value = ''; detectedText = ''; detectedSections = []; detectedWarnings = []; renderImportSectionPreview(detectedSections); });
    $('#curriculumTemplate').addEventListener('change', () => {
      const template = templates.find(item => item.id === $('#curriculumTemplate').value);
      if (!template) return;
      $('#curriculumStructureLabel').value = template.structureLabel || 'Chapter';
      IMPORT_ACTIVITY_TYPES.forEach(type => { const input = $(`#importCount-${type}`); if (input) input.value = Number(template.counts?.[type]) || 0; });
      renderImportSectionPreview(detectedSections);
    });
    // Keep the per-section experiment preview in sync with its default count.
    // Explicit per-section overrides remain intact when this default changes.
    $('#importCount-experiment')?.addEventListener('input', () => renderImportSectionPreview(detectedSections));
    $('#importSaveTemplate').addEventListener('change', () => { $('#importTemplateNameField').hidden = !$('#importSaveTemplate').checked; });
    async function refreshOllamaConnection(showToastOnSuccess = false) {
      const statusNode = $('#ollamaConnectionStatus');
      const modelSelect = $('#curriculumOllamaModel');
      const helpNode = $('#ollamaModelHelp');
      if (!statusNode || !modelSelect) return;
      statusNode.textContent = 'Checking Ollama…';
      statusNode.className = 'import-status';
      modelSelect.innerHTML = '<option value="">Loading installed models…</option>';
      try {
        const response = await fetch('/api/models', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Local helper returned HTTP ${response.status}.`);
        const allModels = Array.isArray(payload.models) ? payload.models : [];
        const visionModels = allModels.filter(item => item.vision);
        const savedModel = state.settings.curriculumOllamaModel || '';
        modelSelect.innerHTML = '';
        if (!visionModels.length) {
          modelSelect.innerHTML = '<option value="">No vision-capable models detected</option>';
          const installed = allModels.map(item => item.name).join(', ');
          statusNode.textContent = `Ollama is running (version ${payload.version || 'unknown'}), but no installed model advertises vision capability.`;
          statusNode.className = 'import-status warning';
          if (helpNode) helpNode.textContent = `Installed models: ${installed || 'none found'}. A model named Qwen 27B may be text-only. To analyze textbook images, choose a local Qwen-VL or another vision-capable model and then refresh this list.`;
          return;
        }
        visionModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model.name;
          const detail = [model.parameterSize, 'vision'].filter(Boolean).join(' · ');
          option.textContent = detail ? `${model.name} (${detail})` : `${model.name} (vision)`;
          modelSelect.appendChild(option);
        });
        const preferred = visionModels.find(item => item.name === savedModel)
          || visionModels.find(item => /qwen.*vl|qwen2\.5vl|qwen3-vl/i.test(item.name))
          || visionModels[0];
        modelSelect.value = preferred.name;
        statusNode.textContent = `Ollama connected · ${visionModels.length} vision model${visionModels.length === 1 ? '' : 's'} available.`;
        statusNode.className = 'import-status success';
        if (helpNode) helpNode.textContent = `Detected ${allModels.length} installed model${allModels.length === 1 ? '' : 's'}. Only the ${visionModels.length} model${visionModels.length === 1 ? '' : 's'} above advertise image capability. Your images remain on this computer.`;
        if (showToastOnSuccess) showToast('Ollama connection is working.');
      } catch (error) {
        modelSelect.innerHTML = '<option value="">Ollama unavailable</option>';
        statusNode.textContent = error.message.includes('Failed to fetch') || error.message.includes('NetworkError')
          ? 'Daymark local helper is not running. Close this tab and launch Start-Daymark.bat from the project folder.'
          : error.message;
        statusNode.className = 'import-status error';
        if (helpNode) helpNode.textContent = 'Start Daymark with Start-Daymark.bat. Ollama must also be running on this computer. The helper uses only Python standard-library modules.';
      }
    }
    $('#refreshOllamaModels').addEventListener('click', () => refreshOllamaConnection(false));
    $('#checkOllamaConnection').addEventListener('click', () => refreshOllamaConnection(true));
    $('#curriculumOllamaModel').addEventListener('change', () => {
      state.settings.curriculumOllamaModel = $('#curriculumOllamaModel').value || '';
      saveState();
    });
    $('#saveOllamaSettings').addEventListener('click', () => {
      state.settings.curriculumOllamaModel = $('#curriculumOllamaModel').value || '';
      saveState(); showToast(state.settings.curriculumOllamaModel ? `Saved local model: ${state.settings.curriculumOllamaModel}` : 'Model choice cleared.');
    });
    refreshOllamaConnection(false);
    $('#interpretCurriculumAI').addEventListener('click', async () => {
      const model = $('#curriculumOllamaModel').value || state.settings.curriculumOllamaModel || '';
      if (window.location.protocol === 'file:') {
        importStatus('Start Daymark using Start-Daymark.bat. Opening index.html directly bypasses the local Python-to-Ollama bridge.', 'warning');
        return;
      }
      if (!model) { importStatus('No vision-capable Ollama model is selected. Refresh the model list and choose a model marked vision.', 'warning'); return; }
      if (!$('#curriculumAiConsent').checked) { importStatus('Please confirm that you want the selected images processed by your local AI model.', 'warning'); return; }
      if (!files.length) files = [...($('#curriculumFiles')?.files || [])];
      if (!files.length) { importStatus('Choose one or more images or PDFs first.', 'warning'); return; }
      const button = $('#interpretCurriculumAI');
      try {
        button.disabled = true;
        importStatus('Preparing uploaded page images for local AI…');
        const extracted = await prepareCurriculumImagesForAi(files, importStatus);
        importStatus('Optimizing page images while preserving small printed text…');
        const images = [];
        for (let index = 0; index < extracted.images.length; index++) {
          let optimized = await optimizeImageForAi(extracted.images[index], 3600, .88);
          if (optimized.length > 10 * 1024 * 1024) optimized = await optimizeImageForAi(extracted.images[index], 2800, .80);
          if (optimized.length > 12 * 1024 * 1024) throw new Error(`Page ${index + 1} is still too large. Try a smaller or clearer scan.`);
          images.push(optimized);
        }
        const estimatedPayload = images.reduce((sum, image) => sum + image.length, 0);
        if (estimatedPayload > 24 * 1024 * 1024) throw new Error('The selected pages are too large to send together. Try fewer pages per import.');
        importStatus(`Sending ${images.length} page image${images.length === 1 ? '' : 's'} to ${model} on this computer. Large models may take several minutes on the first request…`);
        const response = await fetch('/api/curriculum/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, images, ocrText: extracted.text || $('#curriculumRawText').value || '', structureLabel: $('#curriculumStructureLabel').value || 'Chapter' })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Local AI helper returned HTTP ${response.status}.`);
        const parsed = parseAiCurriculumResponse(payload);
        if (!parsed.length) throw new Error('The vision model returned no recognizable sections. Check that the uploaded pages contain a table of contents.');
        detectedImages = extracted.images;
        detectedText = extracted.text || '';
        detectedWarnings = Array.isArray(payload.warnings) ? payload.warnings.map(item => String(item).slice(0, 300)).slice(0, 10) : [];
        detectedSections = parsed;
        if (!$('#curriculumSubjectName').value.trim() && payload.subjectName) $('#curriculumSubjectName').value = String(payload.subjectName).slice(0, 120);
        if (payload.structureLabel && $('#curriculumStructureLabel').value.trim() === 'Chapter') $('#curriculumStructureLabel').value = String(payload.structureLabel).slice(0, 60);
        if (extracted.text) $('#curriculumRawText').value = extracted.text;
        renderImportSectionPreview(detectedSections);
        const duration = payload.stats?.totalDurationSeconds ? ` Model time: ${payload.stats.totalDurationSeconds}s.` : '';
        importStatus(`${model} identified ${detectedSections.length} sections from ${images.length} page image${images.length === 1 ? '' : 's'}.${duration}${detectedWarnings.length ? ` ${detectedWarnings.length} review note(s) are shown above the preview.` : ''} Check titles and page ranges before importing.`, detectedWarnings.length ? 'warning' : 'success');
      } catch (error) {
        console.error(error);
        importStatus(`Local AI interpretation failed: ${error.message} You can retry with fewer/clearer pages or use local OCR/manual text as a fallback.`, 'error');
      } finally {
        button.disabled = false;
      }
    });
    $('#curriculumTarget').addEventListener('change', () => {
      const existing = state.subjects.find(item => item.id === $('#curriculumTarget').value);
      $('#curriculumSubjectName').disabled = !!existing;
      if (existing) { $('#curriculumSubjectName').value = existing.name; $('#curriculumBookName').value = existing.curriculum || ''; $('#curriculumStructureLabel').value = existing.structureLabel || 'Chapter'; }
      else $('#curriculumSubjectName').value = '';
    });
    $('#cancelCurriculumImport').addEventListener('click', closeModal);
    $('#applyCurriculumImport').addEventListener('click', () => {
      const targetId = $('#curriculumTarget').value;
      const existing = targetId !== 'new' ? state.subjects.find(item => item.id === targetId) : null;
      const subjectName = existing?.name || $('#curriculumSubjectName').value.trim();
      if (!subjectName) { $('#curriculumImportError').textContent = 'Enter a subject name or choose an existing subject.'; return; }
      if (!detectedSections.length) { $('#curriculumImportError').textContent = 'Analyze images with AI, build a text preview, or manually add at least one section first.'; return; }
      const structureLabel = ($('#curriculumStructureLabel').value.trim() || 'Chapter');
      const counts = Object.fromEntries(IMPORT_ACTIVITY_TYPES.map(type => [type, clamp(Number($(`#importCount-${type}`)?.value) || 0, 0, 30)]));
      const templateName = $('#importSaveTemplate').checked ? $('#importTemplateName').value.trim() : '';
      if ($('#importSaveTemplate').checked && !templateName) { $('#curriculumImportError').textContent = 'Enter a name for the reusable template.'; return; }
      const sections = detectedSections.map((section, index) => ({
        ...section, id: makeId('chapter'), number: String(section.number || index + 1), title: String(section.title || `${structureLabel} ${index + 1}`).trim(),
        startPage: section.startPage === '' ? '' : String(section.startPage), endPage: section.endPage === '' ? '' : String(section.endPage),
        plannedDate: '', completed: false, completedAt: '', completedLogId: '',
        activities: (Array.isArray(section.detectedActivities) ? section.detectedActivities : []).map(activity => ({
          id: makeId('activity'), type: activity.type, title: activity.title, plannedDate: '', estimatedMinutes: 0,
          completed: false, completedAt: '', note: '', completedLogId: ''
        }))
      }));
      const includeReading = $('#importCreateReading').checked;
      for (const section of sections) {
        const detectedReading = section.activities.some(activity => activity.type === 'reading');
        if (includeReading && !detectedReading && section.startPage && section.endPage && Number(section.endPage) >= Number(section.startPage)) {
          section.activities.push({ id: makeId('activity'), type: 'reading', title: `Read pages ${section.startPage}–${section.endPage}`, plannedDate: '', estimatedMinutes: 0, completed: false, completedAt: '', note: '', completedLogId: '' });
        }
        for (const type of IMPORT_ACTIVITY_TYPES) {
          const requestedCount = type === 'experiment' ? clamp(Number(section.activityCounts?.experiment ?? counts.experiment) || 0, 0, 30) : counts[type];
          const detectedCount = section.activities.filter(activity => activity.type === type).length;
          const countToCreate = Math.max(0, requestedCount - detectedCount);
          for (let i = detectedCount + 1; i <= detectedCount + countToCreate; i++) {
            const label = ACTIVITY_LABELS[type] || type;
            const title = type === 'test' ? `${section.number} ${label}` : `${label} ${i}`;
            section.activities.push({ id: makeId('activity'), type, title, plannedDate: '', estimatedMinutes: 0, completed: false, completedAt: '', note: '', completedLogId: '' });
          }
        }
      }
      const schedule = $('#importAutoSchedule').checked;
      const from = $('#importStartDate').value, through = $('#importEndDate').value;
      if (schedule && (!from || !through || through < from)) { $('#curriculumImportError').textContent = 'Choose a valid start and end date, or turn off automatic scheduling.'; return; }
      if (schedule) {
        const dates = [];
        for (let date = parseDate(from); date && dateKey(date) <= through; date = addDays(date, 1)) if (isStudyDay(dateKey(date))) dates.push(dateKey(date));
        if (!dates.length) { $('#curriculumImportError').textContent = 'There are no selected study days in that date range.'; return; }
        const entries = sections.flatMap(section => section.activities.map(activity => ({ section, activity })));
        entries.forEach((entry, index) => {
          const dayIndex = Math.min(dates.length - 1, Math.floor(index * dates.length / Math.max(1, entries.length)));
          entry.activity.plannedDate = dates[dayIndex];
          entry.section.plannedDate = dates[dayIndex];
        });
        sections.filter(section => !section.plannedDate).forEach((section, index) => { section.plannedDate = dates[Math.min(dates.length - 1, Math.floor(index * dates.length / Math.max(1, sections.length)))]; });
      }
      let subject = existing;
      if (!subject) {
        subject = normalizeSubject({ id: makeId('subject'), name: subjectName, curriculum: $('#curriculumBookName').value.trim(), tracking: 'metrics', dailyMinutes: 50, finishDate: $('#importEndDate').value || '', priority: 'normal', color: COLORS[state.subjects.length % COLORS.length], metrics: [], milestones: [], structureLabel, chapters: [] }, state.subjects.length);
        state.subjects.push(subject);
      }
      const existingTitles = new Set((subject.chapters || []).map(item => `${String(item.title).trim().toLowerCase()}|${String(item.startPage || '')}`));
      const uniqueSections = sections.filter(section => !existingTitles.has(`${section.title.trim().toLowerCase()}|${String(section.startPage || '')}`));
      if (uniqueSections.length !== sections.length) importStatus(`${sections.length - uniqueSections.length} duplicate section(s) were skipped.`, 'warning');
      subject.structureLabel = structureLabel;
      subject.chapters = [...(subject.chapters || []), ...uniqueSections];
      if (!subject.curriculum && $('#curriculumBookName').value.trim()) subject.curriculum = $('#curriculumBookName').value.trim();
      if (!subject.finishDate && through) subject.finishDate = through;
      if ($('#importSaveTemplate').checked) {
        state.curriculumTemplates.push(normalizeCurriculumTemplate({ id: makeId('template'), name: templateName, structureLabel, counts }));
      }
      saveState(); closeModal(); renderAll();
      showView('subjects');
      showToast(`Imported ${uniqueSections.length} ${structureLabel.toLowerCase()}${uniqueSections.length === 1 ? '' : 's'} into ${subject.name}.`);
    });
  }

  // Weekly matrix drag-and-drop: assignments can be moved between date cells.
  let draggingAssignment = null;
  document.addEventListener('dragstart', event => {
    const item = event.target.closest('[data-drag-task]');
    if (!item) return;
    draggingAssignment = { id: item.dataset.dragTask, fromDate: item.dataset.dragDate };
    item.classList.add('is-dragging');
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', JSON.stringify(draggingAssignment)); }
  });
  document.addEventListener('dragend', event => {
    event.target.closest('[data-drag-task]')?.classList.remove('is-dragging');
    $$('.weekly-schedule-table td.drop-ready').forEach(cell => cell.classList.remove('drop-ready'));
    draggingAssignment = null;
  });
  document.addEventListener('dragover', event => {
    const cell = event.target.closest('.weekly-schedule-table td[data-drop-date]');
    if (!cell || !draggingAssignment) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    $$('.weekly-schedule-table td.drop-ready').forEach(item => { if (item !== cell) item.classList.remove('drop-ready'); });
    cell.classList.add('drop-ready');
  });
  document.addEventListener('dragleave', event => {
    const cell = event.target.closest('.weekly-schedule-table td[data-drop-date]');
    if (cell && !cell.contains(event.relatedTarget)) cell.classList.remove('drop-ready');
  });
  document.addEventListener('drop', event => {
    const cell = event.target.closest('.weekly-schedule-table td[data-drop-date]');
    if (!cell || !draggingAssignment) return;
    event.preventDefault();
    const payload = draggingAssignment;
    cell.classList.remove('drop-ready');
    moveTaskToDate(payload.id, payload.fromDate, cell.dataset.dropDate);
    draggingAssignment = null;
  });

  // Event delegation keeps the interface responsive as content changes.
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-view]');
    if (nav) { showView(nav.dataset.view); return; }
    const go = event.target.closest('[data-go]');
    if (go) { showView(go.dataset.go); return; }
    const openDate = event.target.closest('[data-open-date]');
    if (openDate) { selectedDate = openDate.dataset.openDate; calendarCursor = parseDate(selectedDate); showView('calendar'); return; }
    const scheduleSubject = event.target.closest('[data-schedule-subject]');
    if (scheduleSubject) {
      const date = scheduleSubject.dataset.calendarDate || nextStudyDate();
      selectedDate = date; calendarCursor = parseDate(date);
      addManualTask(date, null, scheduleSubject.dataset.scheduleSubject);
      return;
    }
    const calendarDate = event.target.closest('[data-calendar-date]');
    if (calendarDate) { selectedDate = calendarDate.dataset.calendarDate; calendarCursor = parseDate(selectedDate); renderCalendar(); return; }
    const moveTaskButton = event.target.closest('[data-move-task]');
    if (moveTaskButton) { openMoveAssignment(moveTaskButton.dataset.moveTask, moveTaskButton.dataset.moveDate); return; }
    if (event.target.closest('#importCurriculumButton')) { openCurriculumImportWizard(); return; }
    const lockTask = event.target.closest('[data-lock-task]');
    if (lockTask) { toggleAssignmentLock(lockTask.dataset.lockTask); return; }
    const editManual = event.target.closest('[data-edit-manual-task]');
    if (editManual) { const task = state.manualTasks.find(item => item.id === editManual.dataset.editManualTask); if (task && !task.done) addManualTask(task.date, task); return; }
    const deleteManual = event.target.closest('[data-delete-manual-task]');
    if (deleteManual) {
      const task = state.manualTasks.find(item => item.id === deleteManual.dataset.deleteManualTask);
      if (task && !task.done && confirm(`Remove “${task.title}” from this date?`)) { state.manualTasks = state.manualTasks.filter(item => item.id !== task.id); saveState(); renderAll(); showToast('Manual task removed.'); }
      return;
    }
    if (event.target.closest('#saveDayNotes')) {
      state.dayNotes[selectedDate] = $('#dayNotesInput')?.value || '';
      saveState(); showToast('Daily notes saved.'); return;
    }
    const taskToggle = event.target.closest('[data-toggle-task]');
    if (taskToggle) {
      const id = taskToggle.dataset.toggleTask;
      const checked = taskToggle.dataset.checked !== 'true';
      const qtyInput = $(`[data-task-quantity="${CSS.escape(id)}"]`);
      toggleTask(id, checked, qtyInput ? Number(qtyInput.value) : null, taskToggle.dataset.taskDate || selectedDate); return;
    }
    const edit = event.target.closest('[data-edit-subject]');
    if (edit) { const sub = state.subjects.find(s => s.id === edit.dataset.editSubject); if (sub) subjectForm(sub); return; }
    const log = event.target.closest('[data-log-subject]');
    if (log) { logSubjectWork(log.dataset.logSubject); return; }
    const holidayRemove = event.target.closest('[data-remove-holiday]');
    if (holidayRemove) { state.settings.holidays = state.settings.holidays.filter(h => h.date !== holidayRemove.dataset.removeHoliday); saveState(); renderSettings(); renderAll(); return; }
    const weekday = event.target.closest('[data-weekday]');
    if (weekday) {
      const day = Number(weekday.dataset.weekday);
      state.settings.weekdays = state.settings.weekdays.includes(day) ? state.settings.weekdays.filter(d => d !== day) : [...state.settings.weekdays, day].sort();
      renderSettings(); return;
    }
    const settingsTab = event.target.closest('[data-settings-tab]');
    if (settingsTab) { renderSettingsTab(settingsTab.dataset.settingsTab); return; }
    const theme = event.target.closest('[data-theme-choice]');
    if (theme) { state.settings.theme = theme.dataset.themeChoice; saveState(); renderAll(); return; }
    const density = event.target.closest('[data-density]');
    if (density) { state.settings.density = density.dataset.density; saveState(); renderAll(); return; }
    const calendarStyle = event.target.closest('[data-calendar-style]');
    if (calendarStyle) { state.settings.calendarStyle = calendarStyle.dataset.calendarStyle; saveState(); renderAll(); return; }
    const defaultCalendar = event.target.closest('[data-default-calendar]');
    if (defaultCalendar) { state.settings.defaultCalendar = defaultCalendar.dataset.defaultCalendar; saveState(); renderSettings(); return; }
    const dashboard = event.target.closest('[data-dashboard]');
    if (dashboard) { state.settings.dashboard = dashboard.dataset.dashboard; saveState(); renderAll(); return; }
    if (event.target.closest('#reviewPrevWeek')) { reviewCursor = addDays(reviewCursor || parseDate(today), -7); renderWeeklyReview(); return; }
    if (event.target.closest('#reviewNextWeek')) { reviewCursor = addDays(reviewCursor || parseDate(today), 7); renderWeeklyReview(); return; }
    if (event.target.closest('#reviewCurrentWeek')) { reviewCursor = parseDate(today); renderWeeklyReview(); return; }
    const prev = event.target.closest('#prevPeriod');
    if (prev) {
      if (calendarView === 'month') calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1, 12);
      else selectedDate = dateKey(addDays(parseDate(selectedDate), -7));
      renderCalendar(); return;
    }
    const next = event.target.closest('#nextPeriod');
    if (next) {
      if (calendarView === 'month') calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1, 12);
      else selectedDate = dateKey(addDays(parseDate(selectedDate), 7));
      renderCalendar(); return;
    }
    if (event.target.closest('#calendarToday')) { selectedDate = today; calendarCursor = parseDate(today); renderCalendar(); return; }
    const viewSwitch = event.target.closest('[data-calendar-view]');
    if (viewSwitch) { calendarView = viewSwitch.dataset.calendarView; renderCalendar(); return; }
    if (event.target.closest('#subjectsAdd, #topAddSubject, #quickAddSubject, #emptyAddSubject')) { subjectForm(); return; }
    if (event.target.closest('#calendarAddTask, #detailAddTask')) { addManualTask(selectedDate); return; }
    if (event.target.closest('#detailPrint')) { openPrintModal(); $('#printMode').value = 'planned'; updatePrintRangeOptions(); $('#printRange').value = 'week'; return; }
    if (event.target.closest('#openPrint')) { openPrintModal(); return; }
    if (event.target.closest('#openToday, #jumpToday')) { selectedDate = today; calendarCursor = parseDate(today); showView('calendar'); return; }
    if (event.target.closest('#saveSchoolDates')) { saveSchoolDates(); return; }
    if (event.target.closest('#saveSchedule')) { saveStudyDays(); return; }
    if (event.target.closest('#addHoliday')) {
      const date = $('#holidayDate').value;
      if (!date) { $('#scheduleFeedback').textContent = 'Choose a date first.'; return; }
      state.settings.holidays = state.settings.holidays.filter(h => h.date !== date);
      state.settings.holidays.push({ date, label: $('#holidayLabel').value.trim() });
      $('#holidayDate').value = ''; $('#holidayLabel').value = ''; saveState(); renderSettings(); renderCalendar(); showToast('Day off added.'); return;
    }
    if (event.target.closest('#resetAppearance')) {
      Object.assign(state.settings, { theme: 'light', density: 'balanced', accent: '#607d71', calendarStyle: 'blocks', defaultCalendar: 'month', dashboard: 'calendar', sidebarWidth: 250, fontSize: 'normal', dateFormat: 'long', clockFormat: '12', appScale: 100 });
      saveState(); renderAll(); showToast('Appearance settings reset.'); return;
    }
    if (event.target.closest('#exportBackup')) { exportBackup(); return; }
    if (event.target.closest('#clearData')) { clearAllData(); return; }
    if (event.target.closest('#progressExport')) { exportProgressSummary(); return; }
    if (event.target.closest('#progressCsvExport')) { exportActivityCsv(); return; }
    if (event.target.closest('#modalClose, #cancelSubject')) { closeModal(); return; }
    if (event.target.closest('#printClose, #printCancel')) { closePrintModal(); return; }
    if (event.target.closest('#printNow')) { closePrintModal(); printPlanner(); return; }
  });

  document.addEventListener('submit', event => {
    if (event.target.id !== 'manualTaskForm') return;
    event.preventDefault();
    const form = new FormData(event.target);
    state.manualTasks.push({ id: makeId('task'), date: selectedDate, title: String(form.get('title') || '').trim(), subjectId: String(form.get('subjectId') || ''), quantity: Number(form.get('quantity')) || 0, unit: String(form.get('unit') || 'tasks').trim(), done: false, note: '' });
    saveState(); renderAll(); showToast('Task added.');
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'subjectSearch') renderSubjects();
    if (event.target.id === 'accentColor') { state.settings.accent = event.target.value; $('#accentColorLabel').textContent = event.target.value.toUpperCase(); saveState(); applyAppearance(); }
    if (event.target.id === 'sidebarWidth') { state.settings.sidebarWidth = Number(event.target.value); saveState(); applyAppearance(); }
    if (event.target.id === 'appScale') { state.settings.appScale = clamp(Number(event.target.value) || 100, 80, 150); $('#appScaleValue').textContent = `${state.settings.appScale}%`; saveState(); applyAppearance(); }
    if (event.target.matches('[data-task-quantity]')) return;
    if (event.target.id === 'fontSize') { state.settings.fontSize = event.target.value; saveState(); applyAppearance(); }
    if (event.target.id === 'dateFormat') { state.settings.dateFormat = event.target.value; saveState(); renderAll(); }
    if (event.target.id === 'clockFormat') { state.settings.clockFormat = event.target.value; saveState(); }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-task-quantity]')) { saveAssignmentQuantity(event.target.dataset.taskQuantity, event.target.value); return; }
    if (event.target.matches('[data-toggle-milestone]')) { const subject = state.subjects.find(item => item.id === event.target.dataset.toggleMilestone); const milestone = subject?.milestones.find(item => item.id === event.target.dataset.milestoneId); if (milestone) { milestone.completed = event.target.checked; saveState(); renderAll(); showToast('Milestone updated.'); } return; }
    if (event.target.matches('[data-toggle-curriculum-chapter]')) { setCurriculumChapterComplete(event.target.dataset.toggleCurriculumChapter, event.target.dataset.chapterId, event.target.checked, today); return; }
    if (event.target.matches('[data-toggle-curriculum]')) { setCurriculumActivityComplete(event.target.dataset.toggleCurriculum, event.target.dataset.chapterId, event.target.dataset.activityId, event.target.checked, today); return; }
    if (event.target.id === 'importBackup') { importBackup(event.target.files?.[0]); event.target.value = ''; }
    if (event.target.id === 'maxDailyMinutes') { state.settings.maxDailyMinutes = clamp(Number(event.target.value) || 0, 0, 600); saveState(); renderAll(); return; }
    if (event.target.id === 'fontSize' || event.target.id === 'dateFormat' || event.target.id === 'clockFormat') {
      const key = { fontSize: 'fontSize', dateFormat: 'dateFormat', clockFormat: 'clockFormat' }[event.target.id];
      state.settings[key] = event.target.value; saveState(); renderAll();
    }
    if (event.target.matches('[data-subject-color]')) {
      const subject = state.subjects.find(s => s.id === event.target.dataset.subjectColor);
      if (subject) { subject.color = event.target.value; saveState(); renderAll(); }
    }
    if (event.target.id === 'printMode' || event.target.id === 'printRange') updatePrintRangeOptions();
  });

  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', event => { if (event.target.id === 'modalBackdrop') closeModal(); });
  $('#printBackdrop').addEventListener('click', event => { if (event.target.id === 'printBackdrop') closePrintModal(); });
  $('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('mobile-open'));
  window.addEventListener('afterprint', () => $('#printOutput').classList.remove('printing', 'printing-week'));
  window.addEventListener('beforeprint', () => $('#printOutput').classList.add('printing'));
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY && event.newValue) { state = loadState(); renderAll(); } });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.settings.theme === 'system') applyAppearance(); });

  // Initialize defaults and initial view.
  calendarView = state.settings.defaultCalendar || 'month';
  renderAll();
  renderSettingsTab('school');
  showView('overview');
})();
