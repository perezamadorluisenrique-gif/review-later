// Finds the review section of a daily note and appends a line at its end.
// Everything here works on plain text and returns a range edit, so the caller
// can apply it through `vault.process` or one editor transaction.

export interface Change {
  from: number;
  to: number;
  insert: string;
}

export interface HeadingSpec {
  level: number;
  title: string;
}

/** "## Review" or "Review" (level 2 then). */
export function parseHeading(setting: string, fallbackLevel = 2): HeadingSpec {
  const m = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(setting);
  const title = (m ? m[2] : setting).trim();
  return { level: m ? m[1].length : fallbackLevel, title: title || 'Review' };
}

export function headingText(h: HeadingSpec): string {
  return `${'#'.repeat(h.level)} ${h.title}`;
}

interface Line {
  text: string;
  /** Offset of the first character. */
  start: number;
  /** Offset just after the last character, before the line break. */
  end: number;
  /** True for lines in a code fence or in front matter, which never count as headings. */
  verbatim: boolean;
}

function scan(text: string): Line[] {
  const lines: Line[] = [];
  let offset = 0;
  let fence: string | null = null;
  let frontmatter = text.startsWith('---') && /^---[ \t]*(\r?\n|$)/.test(text);
  text.split('\n').forEach((raw, i) => {
    const content = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    let verbatim = false;
    if (frontmatter) {
      verbatim = true;
      if (i > 0 && /^(---|\.\.\.)[ \t]*$/.test(content)) frontmatter = false;
    } else if (fence) {
      verbatim = true;
      const close = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(content);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
    } else {
      const open = /^\s{0,3}(`{3,}|~{3,})/.exec(content);
      if (open) {
        fence = open[1];
        verbatim = true;
      }
    }
    lines.push({ text: content, start: offset, end: offset + content.length, verbatim });
    offset += raw.length + 1;
  });
  return lines;
}

function headingOf(line: Line): { level: number; title: string } | null {
  if (line.verbatim) return null;
  const m = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line.text);
  return m ? { level: m[1].length, title: m[2].trim() } : null;
}

interface Section {
  /** Index of the heading line. */
  heading: number;
  /** Index of the last line of the section that holds text (the heading itself when the section is empty). */
  last: number;
  /** Index after the section's final line. */
  stop: number;
}

function findSection(lines: Line[], spec: HeadingSpec): Section | null {
  const want = spec.title.toLowerCase();
  let at = -1;
  let fallback = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = headingOf(lines[i]);
    if (!h || h.title.toLowerCase() !== want) continue;
    if (h.level === spec.level) {
      at = i;
      break;
    }
    if (fallback === -1) fallback = i;
  }
  if (at === -1) at = fallback;
  if (at === -1) return null;
  const level = headingOf(lines[at])!.level;
  let stop = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    const h = headingOf(lines[i]);
    if (h && h.level <= level) {
      stop = i;
      break;
    }
  }
  let last = at;
  for (let i = stop - 1; i > at; i--) {
    if (lines[i].text.trim() !== '') {
      last = i;
      break;
    }
  }
  return { heading: at, last, stop };
}

/** The lines of the section, without the heading. Empty when there is none. */
export function sectionLines(text: string, spec: HeadingSpec): string[] {
  const lines = scan(text);
  const s = findSection(lines, spec);
  return s ? lines.slice(s.heading + 1, s.stop).map((l) => l.text) : [];
}

/**
 * The edit that appends `entry` (one or more lines) at the end of the section,
 * creating the heading at the end of the note when it is missing. Null when the
 * entry's first line is already in the section.
 */
export function planAppend(text: string, spec: HeadingSpec, entry: string): Change | null {
  const lines = scan(text);
  const section = findSection(lines, spec);
  if (!section) {
    const block = `${headingText(spec)}\n${entry}`;
    if (text.trim() === '') return { from: 0, to: text.length, insert: `${block}\n` };
    const trailing = /\n*$/.exec(text)![0].length;
    const body = text.length - trailing;
    // Keep one blank line before the heading and end the note with a line break.
    return { from: body, to: text.length, insert: `\n\n${block}\n` };
  }
  const first = entry.split('\n')[0].trim();
  for (let i = section.heading + 1; i < section.stop; i++) {
    if (lines[i].text.trim() === first) return null;
  }
  const at = lines[section.last].end;
  return { from: at, to: at, insert: `\n${entry}` };
}

export function applyChange(text: string, change: Change): string {
  return text.slice(0, change.from) + change.insert + text.slice(change.to);
}

/** Spaces that keep a continuation line (a quote) inside the list item that `prefix` starts. */
export function continuationIndent(prefix: string): string {
  const m = /^(\s*(?:[-*+]|\d+[.)])\s+)/.exec(prefix);
  return m ? ' '.repeat(m[1].length) : '';
}

export interface EntryParts {
  /** Start of the line, such as "- " or "- [ ] ". */
  prefix: string;
  /** The link, already in the user's link format. */
  link: string;
  /** A short note typed in the prompt. */
  note?: string;
  /** Selected text, kept as a block quote under the line. */
  quote?: string;
}

export function formatEntry(p: EntryParts): string {
  const note = p.note?.replace(/\s+/g, ' ').trim();
  let out = `${p.prefix}${p.link}${note ? `: ${note}` : ''}`;
  const quote = p.quote?.replace(/\r\n?/g, '\n').replace(/^\n+|\s+$/g, '');
  if (quote) {
    const indent = continuationIndent(p.prefix);
    out += quote
      .split('\n')
      .map((l) => `\n${indent}> ${l}`.replace(/\s+$/, ''))
      .join('');
  }
  return out;
}

/** The top-level lines of the section (the entries, without their quotes), for the "scheduled" list. */
export function entries(text: string, spec: HeadingSpec): string[] {
  return sectionLines(text, spec).filter((l) => l.trim() !== '' && !/^\s/.test(l) && !/^\s*>/.test(l));
}
