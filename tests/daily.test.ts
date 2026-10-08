import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDailyOptions, relativeName, templatePaths } from '../src/daily.ts';

test('reads the core options', () => {
  assert.deepEqual(readDailyOptions({ folder: 'Daily', format: 'YYYY/MM/DD', template: 'Templates/Daily' }), { folder: 'Daily', format: 'YYYY/MM/DD', template: 'Templates/Daily' });
  assert.deepEqual(readDailyOptions({ folder: ' Daily ', format: ' ', template: '' }), { folder: 'Daily', format: 'YYYY-MM-DD', template: '' });
});

test('falls back when the options are missing or odd', () => {
  const defaults = { folder: '', format: 'YYYY-MM-DD', template: '' };
  for (const raw of [undefined, null, 42, 'x', [], {}, { folder: 3, format: null, template: {} }]) assert.deepEqual(readDailyOptions(raw), defaults);
});

test('template paths', () => {
  assert.deepEqual(templatePaths('Templates/Daily'), ['Templates/Daily.md', 'Templates/Daily']);
  assert.deepEqual(templatePaths('/Templates/Daily.md'), ['Templates/Daily.md']);
  assert.deepEqual(templatePaths(''), []);
  assert.deepEqual(templatePaths('  '.trim()), []);
});

test('relative name inside the daily folder', () => {
  assert.equal(relativeName('Daily/2026-10-08.md', 'Daily'), '2026-10-08');
  assert.equal(relativeName('Daily/2026/10/08.md', '/Daily/'), '2026/10/08');
  assert.equal(relativeName('2026-10-08.md', ''), '2026-10-08');
  assert.equal(relativeName('Other/2026-10-08.md', 'Daily'), null);
  assert.equal(relativeName('DailyX/2026-10-08.md', 'Daily'), null);
  assert.equal(relativeName('Daily/image.png', 'Daily'), null);
});
