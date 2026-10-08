import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPath, dailyNotePath, formatDate, parentFolder, weekOfYear } from '../src/format.ts';
import { renderTemplate } from '../src/template.ts';
import type { Ymd } from '../src/dates.ts';

const D: Ymd = { year: 2026, month: 10, day: 8 }; // Thursday

test('common daily note formats', () => {
  assert.equal(formatDate(D, 'YYYY-MM-DD'), '2026-10-08');
  assert.equal(formatDate(D, 'YYYY/MM/YYYY-MM-DD'), '2026/10/2026-10-08');
  assert.equal(formatDate(D, 'dddd, MMMM Do, YYYY'), 'Thursday, October 8th, 2026');
  assert.equal(formatDate(D, 'ddd D MMM YY'), 'Thu 8 Oct 26');
  assert.equal(formatDate(D, 'DD.MM.YYYY'), '08.10.2026');
  assert.equal(formatDate(D, 'M/D/YY'), '10/8/26');
  assert.equal(formatDate(D, 'dd'), 'Th');
  assert.equal(formatDate(D, 'YYYYMMDD'), '20261008');
});

test('square brackets escape text', () => {
  assert.equal(formatDate(D, '[Daily] YYYY-MM-DD'), 'Daily 2026-10-08');
  assert.equal(formatDate(D, 'YYYY-[W]WW'), '2026-W41');
  assert.equal(formatDate(D, '[YYYY]'), 'YYYY');
});

test('ordinals', () => {
  const day = (n: number) => formatDate({ year: 2026, month: 1, day: n }, 'Do');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(day), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st']);
});

test('day of year, quarter and weekday numbers', () => {
  assert.equal(formatDate(D, 'DDD'), '281');
  assert.equal(formatDate({ year: 2026, month: 1, day: 5 }, 'DDDD'), '005');
  assert.equal(formatDate({ year: 2028, month: 12, day: 31 }, 'DDD'), '366');
  assert.equal(formatDate(D, 'Q'), '4');
  assert.equal(formatDate(D, 'd E'), '4 4');
  assert.equal(formatDate({ year: 2026, month: 10, day: 11 }, 'd E'), '0 7');
});

test('ISO weeks at year boundaries', () => {
  assert.deepEqual(weekOfYear({ year: 2026, month: 1, day: 1 }, 1, 4), { week: 1, year: 2026 });
  assert.deepEqual(weekOfYear({ year: 2024, month: 12, day: 30 }, 1, 4), { week: 1, year: 2025 });
  assert.deepEqual(weekOfYear({ year: 2021, month: 1, day: 3 }, 1, 4), { week: 53, year: 2020 });
  assert.deepEqual(weekOfYear({ year: 2026, month: 12, day: 31 }, 1, 4), { week: 53, year: 2026 });
  assert.equal(formatDate({ year: 2021, month: 1, day: 3 }, 'GGGG-[W]WW'), '2020-W53');
});

test('locale weeks follow the week rules passed in', () => {
  // English rules (Sunday start, week 1 holds Jan 1): Jan 1 2026 is week 1, Sunday Jan 4 starts week 2.
  assert.equal(formatDate({ year: 2026, month: 1, day: 1 }, 'gggg-ww'), '2026-01');
  assert.equal(formatDate({ year: 2026, month: 1, day: 3 }, 'gggg-ww'), '2026-01');
  assert.equal(formatDate({ year: 2026, month: 1, day: 4 }, 'gggg-ww'), '2026-02');
  assert.equal(formatDate({ year: 2026, month: 1, day: 4 }, 'gggg-ww', { dow: 1, doy: 4 }), '2026-01');
  assert.equal(formatDate({ year: 2026, month: 1, day: 5 }, 'gggg-ww', { dow: 1, doy: 4 }), '2026-02');
  assert.equal(formatDate({ year: 2026, month: 12, day: 31 }, 'gggg-ww'), '2027-01');
  assert.equal(formatDate({ year: 2027, month: 1, day: 1 }, 'gggg-ww'), '2027-01');
});

test('localised names', () => {
  const es = { months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], weekdays: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] };
  assert.equal(formatDate(D, 'dddd D [de] MMMM', es), 'jueves 8 de octubre');
  assert.equal(formatDate(D, 'MMM ddd', es), 'oct jue');
});

test('time tokens', () => {
  const time = { hour: 15, minute: 4, second: 9 };
  assert.equal(formatDate(D, 'HH:mm:ss', { time }), '15:04:09');
  assert.equal(formatDate(D, 'h:mm A', { time }), '3:04 PM');
  assert.equal(formatDate(D, 'hh a', { time: { hour: 0, minute: 0, second: 0 } }), '12 am');
  assert.equal(formatDate(D, 'H m s', { time }), '15 4 9');
});

test('daily note path', () => {
  assert.equal(dailyNotePath(D, '', 'YYYY-MM-DD'), '2026-10-08.md');
  assert.equal(dailyNotePath(D, 'Daily', 'YYYY-MM-DD'), 'Daily/2026-10-08.md');
  assert.equal(dailyNotePath(D, '/Daily/Notes/', 'YYYY-MM-DD'), 'Daily/Notes/2026-10-08.md');
  assert.equal(dailyNotePath(D, 'Journal', 'YYYY/MMMM/DD'), 'Journal/2026/October/08.md');
  assert.equal(dailyNotePath(D, '', ''), '2026-10-08.md');
  assert.equal(dailyNotePath(D, '', '  '), '2026-10-08.md');
  assert.equal(dailyNotePath(D, 'a//b', 'YYYY-MM-DD[.md]'), 'a/b/2026-10-08.md');
  assert.equal(dailyNotePath(D, '/', 'YYYY-MM-DD'), '2026-10-08.md');
});

test('path helpers', () => {
  assert.equal(cleanPath('//a\\b//c/'), 'a/b/c');
  assert.equal(parentFolder('a/b/c.md'), 'a/b');
  assert.equal(parentFolder('c.md'), '');
});

test('template variables', () => {
  const ctx = { title: '2026-10-08', date: (f: string) => formatDate(D, f), time: (f: string) => formatDate(D, f, { time: { hour: 9, minute: 30, second: 0 } }) };
  assert.equal(renderTemplate('# {{title}}\n{{date}} {{ time }}', ctx), '# 2026-10-08\n2026-10-08 09:30');
  assert.equal(renderTemplate('{{date:dddd, MMMM Do}} / {{time:h:mm a}}', ctx), 'Thursday, October 8th / 9:30 am');
  assert.equal(renderTemplate('{{DATE}} {{unknown}}', ctx), '2026-10-08 {{unknown}}');
  assert.equal(renderTemplate('no variables', ctx), 'no variables');
  assert.equal(renderTemplate('{{title}}{{title}}', ctx), '2026-10-082026-10-08');
});

test('dailyNotePath prefers the given formatter (the app moment) over the built-in one', () => {
  assert.equal(dailyNotePath(D, 'Daily', 'LL', {}, () => 'October 8, 2026'), 'Daily/October 8, 2026.md');
  assert.equal(dailyNotePath(D, 'Daily', 'YYYY-MM-DD', {}, () => null), 'Daily/2026-10-08.md');
});
