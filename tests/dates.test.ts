import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, describe as describeDate, daysInMonth, nextWeekday, parseDate, quickPicks, splitNote, startOfNextWeek, toIso, weekday } from '../src/dates.ts';
import type { Ymd, WeekStart } from '../src/dates.ts';

// 2026-10-08 is a Thursday.
const THU: Ymd = { year: 2026, month: 10, day: 8 };
const iso = (input: string, today: Ymd = THU, ws: WeekStart = 'monday') => {
  const d = parseDate(input, today, ws);
  return d ? toIso(d) : null;
};

test('the fixture day is a Thursday', () => assert.equal(weekday(THU), 4));

test('today, tomorrow, yesterday', () => {
  assert.equal(iso('today'), '2026-10-08');
  assert.equal(iso('Tomorrow'), '2026-10-09');
  assert.equal(iso('  TOMORROW  '), '2026-10-09');
  assert.equal(iso('tmrw'), '2026-10-09');
  assert.equal(iso('yesterday'), '2026-10-07');
});

test('"in N units" with digits and words', () => {
  assert.equal(iso('in 3 days'), '2026-10-11');
  assert.equal(iso('in 1 day'), '2026-10-09');
  assert.equal(iso('in 2 weeks'), '2026-10-22');
  assert.equal(iso('in two weeks'), '2026-10-22');
  assert.equal(iso('in a week'), '2026-10-15');
  assert.equal(iso('in an hour'), null);
  assert.equal(iso('3 days'), '2026-10-11');
  assert.equal(iso('in 2 months'), '2026-12-08');
  assert.equal(iso('in 1 year'), '2027-10-08');
  assert.equal(iso('2 days ago'), '2026-10-06');
  assert.equal(iso('3 days from now'), '2026-10-11');
  assert.equal(iso('in 3 days ago'), null);
  assert.equal(iso('in 0 days'), '2026-10-08');
});

test('months clamp at the end of shorter months', () => {
  const jan31: Ymd = { year: 2026, month: 1, day: 31 };
  assert.equal(iso('in 1 month', jan31), '2026-02-28');
  assert.equal(iso('in 1 month', { year: 2028, month: 1, day: 31 }), '2028-02-29');
  assert.equal(iso('in 1 month', { year: 2026, month: 3, day: 31 }), '2026-04-30');
  assert.equal(iso('in 12 months', { year: 2028, month: 2, day: 29 }), '2029-02-28');
  assert.equal(iso('in 1 year', { year: 2028, month: 2, day: 29 }), '2029-02-28');
  assert.equal(iso('1 month ago', { year: 2026, month: 3, day: 31 }), '2026-02-28');
  assert.equal(toIso(addMonths({ year: 2026, month: 12, day: 15 }, 1)), '2027-01-15');
  assert.equal(toIso(addMonths({ year: 2026, month: 1, day: 15 }, -2)), '2025-11-15');
});

test('day arithmetic crosses month and year ends', () => {
  assert.equal(iso('tomorrow', { year: 2026, month: 12, day: 31 }), '2027-01-01');
  assert.equal(iso('tomorrow', { year: 2028, month: 2, day: 28 }), '2028-02-29');
  assert.equal(iso('tomorrow', { year: 2026, month: 2, day: 28 }), '2026-03-01');
  assert.equal(iso('yesterday', { year: 2026, month: 1, day: 1 }), '2025-12-31');
  assert.equal(iso('in 1 day', { year: 2026, month: 4, day: 30 }), '2026-05-01');
  assert.equal(daysInMonth(1900, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
});

test('next week is the first day of the next week, by the week start', () => {
  assert.equal(iso('next week'), '2026-10-12'); // Thursday -> Monday
  assert.equal(iso('next week', THU, 'sunday'), '2026-10-11');
  assert.equal(iso('next week', { year: 2026, month: 10, day: 12 }), '2026-10-19'); // on a Monday
  assert.equal(iso('next week', { year: 2026, month: 10, day: 11 }), '2026-10-12'); // on a Sunday, Monday start
  assert.equal(iso('next week', { year: 2026, month: 10, day: 11 }, 'sunday'), '2026-10-18'); // on a Sunday, Sunday start
  assert.equal(iso('next week', { year: 2026, month: 12, day: 30 }), '2027-01-04');
  assert.equal(toIso(startOfNextWeek({ year: 2026, month: 10, day: 10 }, 'sunday')), '2026-10-11'); // Saturday
});

test('next month and next year are the first day', () => {
  assert.equal(iso('next month'), '2026-11-01');
  assert.equal(iso('next month', { year: 2026, month: 12, day: 31 }), '2027-01-01');
  assert.equal(iso('next month', { year: 2026, month: 1, day: 31 }), '2026-02-01');
  assert.equal(iso('next year'), '2027-01-01');
});

test('weekday names are the next one strictly after today', () => {
  assert.equal(iso('friday'), '2026-10-09');
  assert.equal(iso('next friday'), '2026-10-09');
  assert.equal(iso('monday'), '2026-10-12');
  assert.equal(iso('next monday'), '2026-10-12');
  assert.equal(iso('thursday'), '2026-10-15'); // today is a Thursday: a week away
  assert.equal(iso('sun'), '2026-10-11');
  assert.equal(iso('Wed'), '2026-10-14');
  assert.equal(iso('thurs'), '2026-10-15');
  const monday: Ymd = { year: 2026, month: 10, day: 12 };
  assert.equal(iso('next monday', monday), '2026-10-19');
  assert.equal(iso('monday', monday), '2026-10-19');
  assert.equal(iso('tuesday', monday), '2026-10-13');
  assert.equal(toIso(nextWeekday({ year: 2026, month: 12, day: 28 }, 5)), '2027-01-01');
});

test('ISO dates, with other separators', () => {
  assert.equal(iso('2026-11-01'), '2026-11-01');
  assert.equal(iso('2026/11/1'), '2026-11-01');
  assert.equal(iso('2026.1.9'), '2026-01-09');
  assert.equal(iso('2020-02-29'), '2020-02-29');
  assert.equal(iso('2025-10-01'), '2025-10-01'); // the past is allowed
});

test('impossible dates are invalid', () => {
  assert.equal(iso('2026-02-29'), null);
  assert.equal(iso('2026-02-30'), null);
  assert.equal(iso('2026-13-01'), null);
  assert.equal(iso('2026-00-10'), null);
  assert.equal(iso('2026-04-31'), null);
  assert.equal(iso('feb 30'), null);
  assert.equal(iso('nov 0'), null);
  assert.equal(iso('32 oct'), null);
  assert.equal(iso('nov 1 2026-'), null);
});

test('month and day, with and without year', () => {
  assert.equal(iso('nov 1'), '2026-11-01');
  assert.equal(iso('November 1'), '2026-11-01');
  assert.equal(iso('1 nov'), '2026-11-01');
  assert.equal(iso('1st of november'), null);
  assert.equal(iso('nov 1st'), '2026-11-01');
  assert.equal(iso('Nov 2nd'), '2026-11-02');
  assert.equal(iso('sept 3'), '2026-09-03'.replace('2026', '2027'));
  assert.equal(iso('nov 1, 2027'), '2027-11-01');
  assert.equal(iso('1 November 2027'), '2027-11-01');
  assert.equal(iso('dec 25'), '2026-12-25');
  assert.equal(iso('oct 8'), '2026-10-08'); // today itself
  assert.equal(iso('oct 7'), '2027-10-07'); // already past: next year
  assert.equal(iso('jan 1'), '2027-01-01');
  assert.equal(iso('jan 1 2020'), '2020-01-01');
});

test('feb 29 without a year finds the next leap year', () => {
  assert.equal(iso('feb 29'), '2028-02-29');
  assert.equal(iso('feb 29', { year: 2028, month: 2, day: 29 }), '2028-02-29');
  assert.equal(iso('feb 29', { year: 2028, month: 3, day: 1 }), '2032-02-29');
  assert.equal(iso('feb 29 2027'), null);
});

test('invalid input', () => {
  for (const bad of ['', '   ', 'soon', 'someday', 'next', 'in', 'in days', 'monday next', 'next blursday', 'nov', '12', 'in -3 days', 'in 3', 'tomorow', '2026-11', '99999999 days', 'in 1000000 days', 'next next week']) {
    assert.equal(iso(bad), null, `"${bad}"`);
  }
});

test('results stay in a sane range', () => {
  assert.equal(iso('in 99999 years'), null);
  assert.equal(iso('in 8000 years'), null);
  assert.equal(iso('99999 years ago'), null);
});

test('addDays is exact over a leap year', () => {
  assert.equal(toIso(addDays({ year: 2027, month: 2, day: 28 }, 366)), '2028-02-29');
  assert.equal(toIso(addDays({ year: 2026, month: 3, day: 1 }, -1)), '2026-02-28');
});

test('quick picks resolve their date', () => {
  const picks = quickPicks(THU, 'monday');
  assert.deepEqual(picks.map((p) => [p.label, toIso(p.date)]), [
    ['Tomorrow', '2026-10-09'],
    ['Next week', '2026-10-12'],
    ['Next month', '2026-11-01'],
  ]);
  assert.equal(toIso(quickPicks(THU, 'sunday')[1].date), '2026-10-11');
});

test('splitNote separates the note after a bar', () => {
  assert.deepEqual(splitNote('next monday'), { dateText: 'next monday', note: '' });
  assert.deepEqual(splitNote('tomorrow | check the numbers'), { dateText: 'tomorrow', note: 'check the numbers' });
  assert.deepEqual(splitNote('| only a note'), { dateText: '', note: 'only a note' });
  assert.deepEqual(splitNote('nov 1|a | b'), { dateText: 'nov 1', note: 'a | b' });
});

test('describe', () => assert.equal(describeDate(THU), 'Thu 8 Oct 2026'));
