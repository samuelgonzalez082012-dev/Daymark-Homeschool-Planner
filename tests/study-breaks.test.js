const test = require('node:test');
const assert = require('node:assert/strict');
const breaks = require('../study-breaks');

function record(overrides = {}) {
  return breaks.normalize({
    id: 'biology-revision',
    subjectId: 'biology',
    name: 'Biology revision',
    startDate: '2026-11-13',
    durationDays: 3,
    dailyMinutes: 45,
    ...overrides
  });
}

test('calculates inclusive consecutive calendar-day ranges', () => {
  assert.equal(breaks.endDate('2026-11-13', 3), '2026-11-15');
  assert.equal(breaks.endDate('2026-12-31', 2), '2027-01-01');
});

test('normalizes and validates study-break settings', () => {
  assert.equal(record().endDate, '2026-11-15');
  assert.equal(record({ durationDays: 0 }), null);
  assert.equal(record({ dailyMinutes: 601 }), null);
  assert.equal(record({ startDate: '2026-02-30' }), null);
});

test('break remains active on every consecutive day, including weekends', () => {
  const item = record();
  assert.equal(breaks.isActive(item, '2026-11-13'), true);
  assert.equal(breaks.isActive(item, '2026-11-14'), true);
  assert.equal(breaks.isActive(item, '2026-11-15'), true);
  assert.equal(breaks.isActive(item, '2026-11-16'), false);
});

test('replaces all work for the selected subject and preserves other subjects', () => {
  const biology = { id: 'biology', name: 'Biology' };
  const math = { id: 'math', name: 'Math' };
  const tasks = [
    { id: 'target', subject: biology, label: 'Daily target' },
    { id: 'chapter', subject: biology, label: 'Chapter 2' },
    { id: 'manual', subject: biology, label: 'Custom task' },
    { id: 'math-task', subject: math, label: 'Math work' },
    { id: 'personal', subject: null, label: 'Personal task' }
  ];
  const result = breaks.applyToTasks(tasks, [record()], '2026-11-14', [biology, math]);
  assert.deepEqual(result.map(task => task.id), ['math-task', 'personal', 'study-break:biology-revision:2026-11-14']);
  const entry = result.at(-1);
  assert.equal(entry.rangeLabel, 'Biology revision: 45 minutes');
  assert.equal(entry.quantity, 45);
  assert.equal(entry.unit, 'minutes');
  assert.equal(entry.studyBreak, true);
});

test('does not replace tasks before or after the configured period', () => {
  const biology = { id: 'biology', name: 'Biology' };
  const task = { id: 'original', subject: biology };
  assert.deepEqual(breaks.applyToTasks([task], [record()], '2026-11-12', [biology]), [task]);
  assert.deepEqual(breaks.applyToTasks([task], [record()], '2026-11-16', [biology]), [task]);
});

test('cancelled breaks never replace the original schedule', () => {
  const biology = { id: 'biology', name: 'Biology' };
  const task = { id: 'original', subject: biology };
  const cancelled = record({ cancelled: true });
  assert.deepEqual(breaks.applyToTasks([task], [cancelled], '2026-11-14', [biology]), [task]);
});

test('uses the most recently configured active break for a subject', () => {
  const first = record({ id: 'first', name: 'First', createdAt: '2026-11-01' });
  const second = record({ id: 'second', name: 'Second', createdAt: '2026-11-02' });
  assert.equal(breaks.findForSubject([first, second], 'biology', '2026-11-14').id, 'second');
});
