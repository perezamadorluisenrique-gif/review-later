// Renders a date with a moment-style format ("YYYY-MM-DD", "gggg-[W]ww"), and
// builds the path of a daily note from the core Daily notes settings.
import { MONTHS, WEEKDAYS, daysInMonth, isLeap, weekday } from './dates.ts';
import type { Ymd } from './dates.ts';

export interface FormatOptions {
  /** Localised names, when the app's locale is not English. */
  months?: string[];
  monthsShort?: string[];
  weekdays?: string[];
  weekdaysShort?: string[];
  weekdaysMin?: string[];
  /** Locale week rules for w/ww/gggg/e: first day of the week (0 Sunday) and the day-of-year that decides week 1. moment's English: 0 and 6. */
  dow?: number;
  doy?: number;
  /** Time of day for HH, mm and so on. */
  time?: { hour: number; minute: number; second: number };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

function dayOfYear(d: Ymd): number {
  let n = d.day;
  for (let m = 1; m < d.month; m++) n += daysInMonth(d.year, m);
  return n;
}

const daysInYear = (year: number) => (isLeap(year) ? 366 : 365);

// The week arithmetic is moment's: week 1 is the week that holds day `doy` of the year.
function firstWeekOffset(year: number, dow: number, doy: number): number {
  const fwd = 7 + dow - doy;
  const fwdlw = (7 + new Date(Date.UTC(year, 0, fwd)).getUTCDay() - dow) % 7;
  return -fwdlw + fwd - 1;
}

function weeksInYear(year: number, dow: number, doy: number): number {
  return (daysInYear(year) - firstWeekOffset(year, dow, doy) + firstWeekOffset(year + 1, dow, doy)) / 7;
}

export function weekOfYear(d: Ymd, dow: number, doy: number): { week: number; year: number } {
  let week = Math.floor((dayOfYear(d) - firstWeekOffset(d.year, dow, doy) - 1) / 7) + 1;
  let year = d.year;
  if (week < 1) {
    year = d.year - 1;
    week += weeksInYear(year, dow, doy);
  } else if (week > weeksInYear(d.year, dow, doy)) {
    week -= weeksInYear(d.year, dow, doy);
    year = d.year + 1;
  }
  return { week, year };
}

const TOKENS = /\[[^\]]*\]|YYYY|YY|MMMM|MMM|MM|Mo|M|DDDD|DDD|DD|Do|D|dddd|ddd|dd|do|d|E|e|GGGG|GG|gggg|gg|WW|Wo|W|ww|wo|w|Qo|Q|HH|H|hh|h|mm|m|ss|s|A|a/g;

/** Formats `d`. Text in [square brackets] is kept as is; letters that are not tokens pass through. */
export function formatDate(d: Ymd, format: string, opts: FormatOptions = {}): string {
  const months = opts.months ?? MONTHS;
  const monthsShort = opts.monthsShort ?? months.map((m) => m.slice(0, 3));
  const weekdays = opts.weekdays ?? WEEKDAYS;
  const weekdaysShort = opts.weekdaysShort ?? weekdays.map((w) => w.slice(0, 3));
  const weekdaysMin = opts.weekdaysMin ?? weekdays.map((w) => w.slice(0, 2));
  const dow = opts.dow ?? 0;
  const doy = opts.doy ?? 6;
  const t = opts.time ?? { hour: 0, minute: 0, second: 0 };
  const wd = weekday(d);
  const iso = weekOfYear(d, 1, 4);
  const local = weekOfYear(d, dow, doy);
  const hour12 = t.hour % 12 === 0 ? 12 : t.hour % 12;

  return format.replace(TOKENS, (token) => {
    if (token.startsWith('[')) return token.slice(1, -1);
    switch (token) {
      case 'YYYY': return pad(d.year, 4);
      case 'YY': return pad(d.year % 100);
      case 'MMMM': return months[d.month - 1];
      case 'MMM': return monthsShort[d.month - 1];
      case 'MM': return pad(d.month);
      case 'Mo': return ordinal(d.month);
      case 'M': return String(d.month);
      case 'DDDD': return pad(dayOfYear(d), 3);
      case 'DDD': return String(dayOfYear(d));
      case 'DD': return pad(d.day);
      case 'Do': return ordinal(d.day);
      case 'D': return String(d.day);
      case 'dddd': return weekdays[wd];
      case 'ddd': return weekdaysShort[wd];
      case 'dd': return weekdaysMin[wd];
      case 'do': return ordinal(wd);
      case 'd': return String(wd);
      case 'E': return String(wd === 0 ? 7 : wd);
      case 'e': return String((wd - dow + 7) % 7);
      case 'GGGG': return pad(iso.year, 4);
      case 'GG': return pad(iso.year % 100);
      case 'gggg': return pad(local.year, 4);
      case 'gg': return pad(local.year % 100);
      case 'WW': return pad(iso.week);
      case 'Wo': return ordinal(iso.week);
      case 'W': return String(iso.week);
      case 'ww': return pad(local.week);
      case 'wo': return ordinal(local.week);
      case 'w': return String(local.week);
      case 'Qo': return ordinal(Math.ceil(d.month / 3));
      case 'Q': return String(Math.ceil(d.month / 3));
      case 'HH': return pad(t.hour);
      case 'H': return String(t.hour);
      case 'hh': return pad(hour12);
      case 'h': return String(hour12);
      case 'mm': return pad(t.minute);
      case 'm': return String(t.minute);
      case 'ss': return pad(t.second);
      case 's': return String(t.second);
      case 'A': return t.hour < 12 ? 'AM' : 'PM';
      case 'a': return t.hour < 12 ? 'am' : 'pm';
      default: return token;
    }
  });
}

/** Collapses slashes and strips leading and trailing ones, as Obsidian's `normalizePath` does. */
export function cleanPath(path: string): string {
  return path.replace(/[\\/]+/g, '/').replace(/^\/+|\/+$/g, '');
}

/** The vault path of the daily note for `d`: the folder, then the formatted name (which may hold slashes), then ".md". */
export function dailyNotePath(d: Ymd, folder: string, format: string, opts: FormatOptions = {}): string {
  const name = formatDate(d, format.trim() || 'YYYY-MM-DD', opts).trim();
  const path = cleanPath(`${cleanPath(folder)}/${name}`);
  return path.toLowerCase().endsWith('.md') ? path : `${path}.md`;
}

/** The part of the path before the last slash, "" at the root. */
export function parentFolder(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}
