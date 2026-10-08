// Reads the core Daily notes settings from whatever Obsidian hands over. The
// object is internal and undocumented, so every field is checked and has a fallback.

export interface DailyOptions {
  /** Vault folder, "" for the root. */
  folder: string;
  /** moment format of the file name, "YYYY-MM-DD" by default. */
  format: string;
  /** Vault path of the template note, "" for none. */
  template: string;
}

export const DAILY_DEFAULTS: DailyOptions = { folder: '', format: 'YYYY-MM-DD', template: '' };

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** `raw` is the `options` object of the internal daily-notes plugin, or anything else. */
export function readDailyOptions(raw: unknown): DailyOptions {
  if (typeof raw !== 'object' || raw === null) return { ...DAILY_DEFAULTS };
  const o = raw as Record<string, unknown>;
  return {
    folder: text(o.folder),
    format: text(o.format) || DAILY_DEFAULTS.format,
    template: text(o.template),
  };
}

/** Candidate vault paths for the template setting, which may or may not carry ".md". */
export function templatePaths(template: string): string[] {
  const t = template.replace(/[\\/]+/g, '/').replace(/^\/+|\/+$/g, '');
  if (!t) return [];
  return t.toLowerCase().endsWith('.md') ? [t] : [`${t}.md`, t];
}

/** The part of a note's path that the date format describes: without the folder and the extension. Null when the note is outside the folder. */
export function relativeName(path: string, folder: string): string | null {
  const f = folder.replace(/[\\/]+/g, '/').replace(/^\/+|\/+$/g, '');
  let rest = path;
  if (f) {
    if (!path.startsWith(`${f}/`)) return null;
    rest = path.slice(f.length + 1);
  }
  return rest.toLowerCase().endsWith('.md') ? rest.slice(0, -3) : null;
}
