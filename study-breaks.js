/* Pure study-break scheduling helpers shared by Daymark and the Node test suite. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DaymarkStudyBreaks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function validDateKey(value) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value || ''))) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function addDays(key, amount) {
    if (!validDateKey(key)) return '';
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + Number(amount || 0)));
    return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
  }

  function endDate(startDate, durationDays) {
    const days = Math.floor(Number(durationDays));
    if (!validDateKey(startDate) || !Number.isFinite(days) || days < 1) return '';
    return addDays(startDate, days - 1);
  }

  function normalize(record) {
    if (!record || typeof record !== 'object') return null;
    const startDate = String(record.startDate || '');
    const durationDays = Math.floor(Number(record.durationDays));
    const dailyMinutes = Math.floor(Number(record.dailyMinutes));
    if (!record.subjectId || !validDateKey(startDate) || !Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365 || !Number.isFinite(dailyMinutes) || dailyMinutes < 1 || dailyMinutes > 600) return null;
    const name = String(record.name || 'Study Break').trim().slice(0, 80) || 'Study Break';
    return {
      id: String(record.id || `study-break:${record.subjectId}:${startDate}`),
      subjectId: String(record.subjectId),
      name,
      startDate,
      durationDays,
      endDate: endDate(startDate, durationDays),
      dailyMinutes,
      cancelled: !!record.cancelled,
      createdAt: String(record.createdAt || '')
    };
  }

  function normalizeAll(records) {
    return Array.isArray(records) ? records.map(normalize).filter(Boolean) : [];
  }

  function isActive(record, key) {
    return !!record && !record.cancelled && validDateKey(key) && record.startDate <= key && key <= record.endDate;
  }

  function findForSubject(records, subjectId, key) {
    const list = Array.isArray(records) ? records : [];
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const record = list[index];
      if (record.subjectId === subjectId && isActive(record, key)) return record;
    }
    return null;
  }

  function applyToTasks(tasks, records, key, subjects) {
    let result = Array.isArray(tasks) ? tasks.slice() : [];
    for (const subject of subjects || []) {
      const record = findForSubject(records, subject.id, key);
      if (!record) continue;
      result = result.filter(task => task.subject?.id !== subject.id);
      result.push({
        id: `study-break:${record.id}:${key}`,
        date: key,
        subject,
        label: record.name,
        rangeLabel: `${record.name}: ${record.dailyMinutes} minutes`,
        description: `${subject.name} · Temporary study break`,
        quantity: record.dailyMinutes,
        unit: 'minutes',
        estimatedMinutes: record.dailyMinutes,
        done: false,
        custom: true,
        studyBreak: true,
        breakName: record.name
      });
    }
    return result;
  }

  return Object.freeze({ validDateKey, addDays, endDate, normalize, normalizeAll, isActive, findForSubject, applyToTasks });
});
