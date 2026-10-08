// Pure date logic: no `obsidian` or `moment` import, so tests/ runs it under plain Node.
// Dates are calendar days (no time of day, no time zone), written as year/month/day.

export interface Ymd {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
}

/** Day the week starts on: used by "next week". */
export type WeekStart = 'monday' | 'sunday';

const MS = 86_400_000;

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function isValidYmd(d: Ymd): boolean {
  return Number.isInteger(d.year) && Number.isInteger(d.month) && Number.isInteger(d.day) && d.year >= 1000 && d.year <= 9999 && d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= daysInMonth(d.year, d.month);
}

function utc(d: Ymd): number {
  const t = new Date(0);
  t.setUTCFullYear(d.year, d.month - 1, d.day);
  t.setUTCHours(0, 0, 0, 0);
  return t.getTime();
}

function fromUtc(ms: number): Ymd {
  const t = new Date(ms);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** Days since 1970-01-01. */
export function dayNumber(d: Ymd): number {
  return Math.round(utc(d) / MS);
}

export function addDays(d: Ymd, n: number): Ymd {
  return fromUtc(utc(d) + n * MS);
}

/** Adds months and clamps the day: Jan 31 + 1 month is Feb 28 (or 29). */
export function addMonths(d: Ymd, n: number): Ymd {
  const index = d.year * 12 + (d.month - 1) + n;
  const year = Math.floor(index / 12);
  const month = (index - year * 12) + 1;
  return { year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}

/** 0 is Sunday. */
export function weekday(d: Ymd): number {
  return new Date(utc(d)).getUTCDay();
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function sameDay(a: Ymd, b: Ymd): boolean {
  return compareYmd(a, b) === 0;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function toIso(d: Ymd): string {
  return `${pad(d.year, 4)}-${pad(d.month)}-${pad(d.day)}`;
}

/** "Mon 12 Oct 2026". */
export function describe(d: Ymd): string {
  return `${WEEKDAYS[weekday(d)].slice(0, 3)} ${d.day} ${MONTHS[d.month - 1].slice(0, 3)} ${d.year}`;
}

/** First day of the week after the one `d` is in. */
export function startOfNextWeek(d: Ymd, weekStart: WeekStart): Ymd {
  const first = weekStart === 'sunday' ? 0 : 1;
  const since = (weekday(d) - first + 7) % 7;
  return addDays(d, 7 - since);
}

/** The next time `target` (0 is Sunday) comes up, strictly after `from`: a Monday asking for "monday" gets the next Monday. */
export function nextWeekday(from: Ymd, target: number): Ymd {
  const ahead = (target - weekday(from) + 7) % 7;
  return addDays(from, ahead === 0 ? 7 : ahead);
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const WEEKDAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

const MONTH_NAMES: Record<string, number> = {};
MONTHS.forEach((name, i) => {
  const lower = name.toLowerCase();
  MONTH_NAMES[lower] = i + 1;
  MONTH_NAMES[lower.slice(0, 3)] = i + 1;
});
MONTH_NAMES.sept = 9;

const NUMBER = `\\d+|${Object.keys(WORD_NUMBERS).join('|')}`;
const UNIT = '(day|week|month|year)s?';
const RELATIVE = new RegExp(`^(in )?(${NUMBER}) ${UNIT}(?: (ago|from now))?$`);
const MONTH_NAME = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|');
const MONTH_DAY = new RegExp(`^(${MONTH_NAME}) (\\d{1,2})(?: (\\d{4}))?$`);
const DAY_MONTH = new RegExp(`^(\\d{1,2}) (${MONTH_NAME})(?: (\\d{4}))?$`);
const ISO = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[,]/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function inRange(d: Ymd): Ymd | null {
  return isValidYmd(d) ? d : null;
}

/** A month and day with no year: the next one on or after today. */
function nextOccurrence(month: number, day: number, today: Ymd): Ymd | null {
  // Up to 8 years ahead, so Feb 29 finds its leap year.
  for (let year = today.year; year <= today.year + 8; year++) {
    const d = { year, month, day };
    if (isValidYmd(d) && compareYmd(d, today) >= 0) return d;
  }
  return null;
}

/**
 * Reads a date typed in plain English, relative to `today`. Returns null when
 * the text is not a date (or names one that does not exist, like 2026-02-30).
 *
 * "next week" and "next month" mean the first day of that week or month, so a
 * review lands at the start of the period, and "monday" or "next monday" is
 * the next Monday after today (a Monday means the one a week away).
 */
export function parseDate(input: string, today: Ymd, weekStart: WeekStart = 'monday'): Ymd | null {
  const text = normalize(input);
  if (!text) return null;

  if (text === 'today') return today;
  if (text === 'tomorrow' || text === 'tmrw') return addDays(today, 1);
  if (text === 'yesterday') return addDays(today, -1);

  if (text === 'next week') return startOfNextWeek(today, weekStart);
  if (text === 'next month') return { year: addMonths(today, 1).year, month: addMonths(today, 1).month, day: 1 };
  if (text === 'next year') return { year: today.year + 1, month: 1, day: 1 };

  const wd = /^(?:next )?([a-z]+)$/.exec(text);
  if (wd && wd[1] in WEEKDAY_NAMES) return nextWeekday(today, WEEKDAY_NAMES[wd[1]]);

  const rel = RELATIVE.exec(text);
  if (rel) {
    const [, inWord, count, unit, direction] = rel;
    if (inWord && direction) return null;
    const n = /^\d+$/.test(count) ? Number(count) : WORD_NUMBERS[count];
    if (!Number.isFinite(n) || n > 100_000) return null;
    const signed = direction === 'ago' ? -n : n;
    if (unit === 'day') return inRange(addDays(today, signed));
    if (unit === 'week') return inRange(addDays(today, signed * 7));
    if (unit === 'month') return inRange(addMonths(today, signed));
    return inRange(addMonths(today, signed * 12));
  }

  const iso = ISO.exec(text);
  if (iso) return inRange({ year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) });

  const md = MONTH_DAY.exec(text);
  const dm = DAY_MONTH.exec(text);
  const named = md ? { month: md[1], day: md[2], year: md[3] } : dm ? { month: dm[2], day: dm[1], year: dm[3] } : null;
  if (named) {
    const month = MONTH_NAMES[named.month];
    const day = Number(named.day);
    if (named.year) return inRange({ year: Number(named.year), month, day });
    return nextOccurrence(month, day, today);
  }
  return null;
}

export interface QuickPick {
  label: string;
  /** What to feed `parseDate`. */
  input: string;
  date: Ymd;
}

export function quickPicks(today: Ymd, weekStart: WeekStart): QuickPick[] {
  return [
    { label: 'Tomorrow', input: 'tomorrow' },
    { label: 'Next week', input: 'next week' },
    { label: 'Next month', input: 'next month' },
  ].map((p) => ({ ...p, date: parseDate(p.input, today, weekStart) as Ymd }));
}

/** "next monday | check the numbers" splits into the date text and the note. */
export function splitNote(query: string): { dateText: string; note: string } {
  const bar = query.indexOf('|');
  if (bar === -1) return { dateText: query.trim(), note: '' };
  return { dateText: query.slice(0, bar).trim(), note: query.slice(bar + 1).trim() };
}
