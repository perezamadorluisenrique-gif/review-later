import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, SuggestModal, TFile, moment } from 'obsidian';
import type { Editor, SettingDefinitionItem } from 'obsidian';

import { describe, parseDate, quickPicks, splitNote, toIso } from './src/dates.ts';
import type { WeekStart, Ymd } from './src/dates.ts';
import { DAILY_DEFAULTS, readDailyOptions, relativeName, templatePaths } from './src/daily.ts';
import type { DailyOptions } from './src/daily.ts';
import { dailyNotePath, formatDate, parentFolder } from './src/format.ts';
import type { FormatOptions } from './src/format.ts';
import { applyChange, entries, formatEntry, parseHeading, planAppend } from './src/insert.ts';
import { renderTemplate } from './src/template.ts';

/** The parts of moment this plugin uses, typed here: the directory's review has no types for `moment`. */
interface Moment {
  year(): number;
  month(): number;
  date(): number;
  hour(): number;
  minute(): number;
  second(): number;
  isValid(): boolean;
  format(format: string): string;
}
interface MomentStatic {
  (): Moment;
  (input: string, format: string, strict: boolean): Moment;
  (input: number[]): Moment;
  months(): string[];
  monthsShort(): string[];
  weekdays(): string[];
  weekdaysShort(): string[];
  weekdaysMin(): string[];
  localeData(): { firstDayOfWeek(): number; firstDayOfYear(): number };
}
const m = moment as unknown as MomentStatic;

interface ReviewLaterSettings {
  /** Heading of the section in the daily note, "## Review" or "Review". */
  heading: string;
  /** Start of each line: "- ", "- [ ] ", or empty. */
  linePrefix: string;
  /** What an empty prompt means. */
  defaultDate: string;
  weekStart: WeekStart;
  /** Keep the selected text as a quote under the link. */
  includeSelection: boolean;
  ribbon: boolean;
}

const DEFAULT_SETTINGS: ReviewLaterSettings = {
  heading: '## Review',
  linePrefix: '- ',
  defaultDate: 'tomorrow',
  weekStart: 'monday',
  includeSelection: true,
  ribbon: false,
};

/** Names and descriptions shared by the 1.13+ declarative tab and the older `display()`. */
const TEXT = {
  heading: { name: 'Review heading', desc: 'The section of the daily note that gets the links. Created at the end of the note if missing. Write it with its hashes ("## Review") or without (level 2).' },
  linePrefix: { name: 'Line prefix', desc: 'How each line starts: "- " for a bullet, "- [ ] " for a task. Keep the trailing space.' },
  defaultDate: { name: 'Default date', desc: 'Used when you press Enter on an empty prompt. Any date the prompt understands, such as "tomorrow" or "in 3 days".' },
  weekStart: { name: 'Week starts on', desc: 'Where “next week” lands: the first day of the following week.' },
  includeSelection: { name: 'Keep selected text', desc: 'With text selected, add it under the link as a block quote.' },
  ribbon: { name: 'Ribbon icon', desc: 'Show an icon in the left ribbon that opens the prompt.' },
};

const WEEK_STARTS = { monday: 'Monday', sunday: 'Sunday' };

type Key = keyof ReviewLaterSettings;

interface Extra {
  note: string;
  quote: string;
}

export default class ReviewLaterPlugin extends Plugin {
  settings: ReviewLaterSettings = { ...DEFAULT_SETTINGS };
  private ribbonEl: HTMLElement | null = null;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<ReviewLaterSettings> | null);
    this.addSettingTab(new ReviewLaterSettingTab(this.app, this));

    this.addCommand({
      id: 'review-on',
      name: 'Review this note on...',
      icon: 'calendar-clock',
      checkCallback: (checking) => this.ifNote(checking, (file, editor) => this.ask(file, editor)),
    });
    const picks: Array<[string, string, string, string]> = [
      ['review-tomorrow', 'Review this note tomorrow', 'calendar-plus', 'tomorrow'],
      ['review-next-week', 'Review this note next week', 'calendar-range', 'next week'],
      ['review-next-month', 'Review this note next month', 'calendar-days', 'next month'],
    ];
    for (const [id, name, icon, input] of picks) {
      this.addCommand({
        id,
        name,
        icon,
        checkCallback: (checking) =>
          this.ifNote(checking, (file, editor) => {
            const date = parseDate(input, this.today(), this.settings.weekStart);
            if (date) void this.schedule(file, date, { note: '', quote: this.selection(editor) });
          }),
      });
    }
    this.addCommand({
      id: 'show-scheduled',
      name: 'Show notes scheduled for review',
      icon: 'list-checks',
      callback: () => void this.showScheduled(),
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        menu.addItem((item) => item.setTitle('Review on...').setIcon('calendar-clock').onClick(() => this.ask(file, null)));
      }),
    );

    this.applyRibbon();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  applyRibbon() {
    this.ribbonEl?.remove();
    this.ribbonEl = null;
    if (!this.settings.ribbon) return;
    this.ribbonEl = this.addRibbonIcon('calendar-clock', 'Review this note on...', () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view?.file) this.ask(view.file, view.editor);
      else new Notice('Open a note first.');
    });
  }

  /** Runs `run` with the open note, or tells `checkCallback` whether there is one. */
  private ifNote(checking: boolean, run: (file: TFile, editor: Editor | null) => void): boolean {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) return false;
    if (!checking) run(view.file, view.getMode() === 'source' ? view.editor : null);
    return true;
  }

  private selection(editor: Editor | null): string {
    return this.settings.includeSelection && editor ? editor.getSelection() : '';
  }

  today(): Ymd {
    const now = m();
    return { year: now.year(), month: now.month() + 1, day: now.date() };
  }

  /** Locale names and week rules, so “dddd” in a daily note format matches what the core plugin writes. */
  private formatOptions(withTime = false): FormatOptions {
    const opts: FormatOptions = {};
    try {
      const data = m.localeData();
      Object.assign(opts, {
        months: m.months(),
        monthsShort: m.monthsShort(),
        weekdays: m.weekdays(),
        weekdaysShort: m.weekdaysShort(),
        weekdaysMin: m.weekdaysMin(),
        dow: data.firstDayOfWeek(),
        doy: data.firstDayOfYear(),
      });
    } catch {
      // English names and week rules.
    }
    if (withTime) {
      const now = m();
      opts.time = { hour: now.hour(), minute: now.minute(), second: now.second() };
    }
    return opts;
  }

  /**
   * Formats with the app's own moment, as the core Daily notes plugin does, so
   * every token and locale (including "LL" and friends) gives the same file
   * name. Null when moment is unavailable; callers then use `formatDate`.
   */
  private momentFormat(d: Ymd, format: string, withTime = false): string | null {
    try {
      const now = m();
      const t = withTime ? [now.hour(), now.minute(), now.second()] : [0, 0, 0];
      const value = m([d.year, d.month - 1, d.day, ...t]);
      return value.isValid() ? value.format(format) : null;
    } catch {
      return null;
    }
  }

  /** The core Daily notes settings, read defensively: the plugin object is internal. */
  dailyOptions(): DailyOptions {
    try {
      const internal = (this.app as unknown as { internalPlugins?: { getPluginById?: (id: string) => unknown; plugins?: Record<string, unknown> } }).internalPlugins;
      const plugin = (internal?.getPluginById?.('daily-notes') ?? internal?.plugins?.['daily-notes']) as { instance?: { options?: unknown } } | undefined;
      return readDailyOptions(plugin?.instance?.options);
    } catch {
      return { ...DAILY_DEFAULTS };
    }
  }

  private ask(file: TFile, editor: Editor | null) {
    new ReviewDateModal(this.app, this, (date, note) => void this.schedule(file, date, { note, quote: this.selection(editor) })).open();
  }

  async schedule(file: TFile, date: Ymd, extra: Extra): Promise<void> {
    try {
      const options = this.dailyOptions();
      const path = dailyNotePath(date, options.folder, options.format, this.formatOptions(), (d, f) => this.momentFormat(d, f));
      const link = this.app.fileManager.generateMarkdownLink(file, path);
      const entry = formatEntry({ prefix: this.settings.linePrefix, link, note: extra.note, quote: extra.quote });

      let added = true;
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) added = await this.append(existing, entry);
      else if (existing) throw new Error(`${path} is a folder`);
      else added = await this.createWith(path, date, entry, options);

      const name = file.basename;
      new Notice(added ? `“${name}” will come back on ${describe(date)}.` : `“${name}” is already scheduled for ${describe(date)}.`);
    } catch (e) {
      console.error('plugin:review-later', e);
      new Notice('Could not add the note to the daily note. Nothing was changed.');
    }
  }

  /** Appends through the open editor when the daily note is open (one transaction, one undo), otherwise through the vault. Returns false when the line was already there. */
  private async append(file: TFile, entry: string): Promise<boolean> {
    const spec = parseHeading(this.settings.heading);
    const editor = this.openEditor(file);
    if (editor) {
      const text = editor.getValue();
      const change = planAppend(text, spec, entry);
      if (!change) return false;
      editor.transaction({ changes: [{ from: editor.offsetToPos(change.from), to: editor.offsetToPos(change.to), text: change.insert }] });
      return true;
    }
    let added = true;
    await this.app.vault.process(file, (data) => {
      const change = planAppend(data, spec, entry);
      if (!change) {
        added = false;
        return data;
      }
      return applyChange(data, change);
    });
    return added;
  }

  private openEditor(file: TFile): Editor | null {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === file.path) return view.editor;
    }
    return null;
  }

  /** Creates the daily note (from the core template when one is set) with the section already in it. */
  private async createWith(path: string, date: Ymd, entry: string, options: DailyOptions): Promise<boolean> {
    const spec = parseHeading(this.settings.heading);
    const base = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
    const template = await this.readTemplate(options.template);
    const content = renderTemplate(template, {
      title: base,
      date: (f) => this.momentFormat(date, f) ?? formatDate(date, f, this.formatOptions()),
      time: (f) => this.momentFormat(date, f, true) ?? formatDate(date, f, this.formatOptions(true)),
    });
    const change = planAppend(content, spec, entry);
    const text = change ? applyChange(content, change) : content;

    const folder = parentFolder(path);
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    try {
      await this.app.vault.create(path, text);
    } catch (e) {
      // Another process made it between the check and now: add to that one.
      const made = this.app.vault.getAbstractFileByPath(path);
      if (made instanceof TFile) return this.append(made, entry);
      throw e;
    }
    return true;
  }

  private async readTemplate(setting: string): Promise<string> {
    for (const candidate of templatePaths(setting)) {
      const file = this.app.metadataCache.getFirstLinkpathDest(candidate.replace(/\.md$/i, ''), '') ?? this.app.vault.getAbstractFileByPath(candidate);
      if (file instanceof TFile) {
        try {
          return await this.app.vault.cachedRead(file);
        } catch {
          // Unreadable: fall through to an empty note.
        }
      }
    }
    return '';
  }

  private async showScheduled() {
    const options = this.dailyOptions();
    const spec = parseHeading(this.settings.heading);
    const today = toIso(this.today());
    const found: Scheduled[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const name = relativeName(file.path, options.folder);
      if (name === null) continue;
      const parsed = m(name, options.format, true);
      if (!parsed.isValid()) continue;
      const day = toIso({ year: parsed.year(), month: parsed.month() + 1, day: parsed.date() });
      if (day < today) continue;
      for (const line of entries(await this.app.vault.cachedRead(file), spec)) found.push({ day, file, line });
    }
    if (found.length === 0) {
      new Notice('Nothing is scheduled for review.');
      return;
    }
    found.sort((a, b) => a.day.localeCompare(b.day));
    new ScheduledModal(this.app, found).open();
  }
}

interface Suggestion {
  label: string;
  date: Ymd;
  note: string;
}

class ReviewDateModal extends SuggestModal<Suggestion> {
  constructor(
    app: App,
    private plugin: ReviewLaterPlugin,
    private onSchedule: (date: Ymd, note: string) => void,
  ) {
    super(app);
    this.setPlaceholder('Review on… tomorrow, next monday, in 2 weeks, 2026-11-01, nov 1');
    this.emptyStateText = 'Not a date yet. Try “friday”, “in 3 days” or “nov 1”.';
    this.setInstructions([
      { command: '| text', purpose: 'add a short note' },
      { command: '↵', purpose: 'schedule' },
      { command: 'esc', purpose: 'cancel' },
    ]);
  }

  getSuggestions(query: string): Suggestion[] {
    const { settings } = this.plugin;
    const today = this.plugin.today();
    const { dateText, note } = splitNote(query);
    const picks = quickPicks(today, settings.weekStart).map((p) => ({ label: p.label, date: p.date, note, input: p.input }));
    if (dateText === '') {
      const fallback = parseDate(settings.defaultDate, today, settings.weekStart);
      const first = fallback ? [{ label: `Default: ${settings.defaultDate}`, date: fallback, note }] : [];
      return [...first, ...picks.map(({ label, date }) => ({ label, date, note }))];
    }
    const parsed = parseDate(dateText, today, settings.weekStart);
    if (parsed) return [{ label: dateText, date: parsed, note }];
    const needle = dateText.toLowerCase();
    return picks.filter((p) => p.label.toLowerCase().startsWith(needle) || p.input.startsWith(needle)).map(({ label, date }) => ({ label, date, note }));
  }

  renderSuggestion(s: Suggestion, el: HTMLElement) {
    el.createDiv({ cls: 'suggestion-title', text: s.label });
    el.createDiv({ cls: 'suggestion-note', text: s.note ? `${describe(s.date)} · ${s.note}` : describe(s.date) });
  }

  onChooseSuggestion(s: Suggestion) {
    this.onSchedule(s.date, s.note);
  }
}

interface Scheduled {
  day: string;
  file: TFile;
  line: string;
}

class ScheduledModal extends SuggestModal<Scheduled> {
  constructor(
    app: App,
    private items: Scheduled[],
  ) {
    super(app);
    this.setPlaceholder('Notes scheduled for review');
    this.emptyStateText = 'No match.';
  }

  getSuggestions(query: string): Scheduled[] {
    const q = query.toLowerCase();
    return this.items.filter((i) => `${i.day} ${i.line}`.toLowerCase().includes(q));
  }

  renderSuggestion(s: Scheduled, el: HTMLElement) {
    el.createDiv({ cls: 'suggestion-title', text: s.line.replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?/, '') });
    el.createDiv({ cls: 'suggestion-note', text: s.day });
  }

  onChooseSuggestion(s: Scheduled) {
    void this.app.workspace.getLeaf(false).openFile(s.file);
  }
}

class ReviewLaterSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: ReviewLaterPlugin,
  ) {
    super(app, plugin);
  }

  /**
   * The settings, described rather than drawn. Obsidian 1.13 and later
   * renders this itself and indexes it for the settings search. Older
   * versions ignore it and call `display()`.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const d = DEFAULT_SETTINGS;
    return [
      {
        type: 'group',
        heading: 'Daily note',
        items: [
          { ...TEXT.heading, control: { type: 'text', key: 'heading', placeholder: d.heading, defaultValue: d.heading } },
          { ...TEXT.linePrefix, control: { type: 'text', key: 'linePrefix', placeholder: d.linePrefix, defaultValue: d.linePrefix } },
          { ...TEXT.includeSelection, control: { type: 'toggle', key: 'includeSelection', defaultValue: d.includeSelection } },
        ],
      },
      {
        type: 'group',
        heading: 'Dates',
        items: [
          { ...TEXT.defaultDate, control: { type: 'text', key: 'defaultDate', placeholder: d.defaultDate, defaultValue: d.defaultDate } },
          { ...TEXT.weekStart, control: { type: 'dropdown', key: 'weekStart', options: WEEK_STARTS, defaultValue: d.weekStart } },
        ],
      },
      {
        type: 'group',
        heading: 'Interface',
        items: [{ ...TEXT.ribbon, control: { type: 'toggle', key: 'ribbon', defaultValue: d.ribbon } }],
      },
    ];
  }

  getControlValue(key: string): unknown {
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    if (key === 'heading') s.heading = String(value).trim() || DEFAULT_SETTINGS.heading;
    else if (key === 'defaultDate') s.defaultDate = String(value).trim() || DEFAULT_SETTINGS.defaultDate;
    else if (key === 'weekStart') s.weekStart = value === 'sunday' ? 'sunday' : 'monday';
    else Object.assign(s, { [key]: value });
    await this.plugin.saveSettings();
    if (key === 'ribbon') this.plugin.applyRibbon();
  }

  /** The pre-1.13 rendering, from the same text. Obsidian skips it once `getSettingDefinitions()` returns anything. */
  display(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    containerEl.empty();
    new Setting(containerEl).setName('Daily note').setHeading();
    this.text('heading');
    this.text('linePrefix');
    this.toggle('includeSelection');
    new Setting(containerEl).setName('Dates').setHeading();
    this.text('defaultDate');
    new Setting(containerEl)
      .setName(TEXT.weekStart.name)
      .setDesc(TEXT.weekStart.desc)
      .addDropdown((dd) =>
        dd
          .addOptions(WEEK_STARTS)
          .setValue(s.weekStart)
          .onChange((v) => void this.setControlValue('weekStart', v)),
      );
    new Setting(containerEl).setName('Interface').setHeading();
    this.toggle('ribbon');
  }

  private text(key: 'heading' | 'linePrefix' | 'defaultDate') {
    new Setting(this.containerEl)
      .setName(TEXT[key].name)
      .setDesc(TEXT[key].desc)
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_SETTINGS[key])
          .setValue(this.plugin.settings[key])
          .onChange((v) => void this.setControlValue(key, v)),
      );
  }

  private toggle(key: Key & ('includeSelection' | 'ribbon')) {
    new Setting(this.containerEl)
      .setName(TEXT[key].name)
      .setDesc(TEXT[key].desc)
      .addToggle((t) => t.setValue(this.plugin.settings[key]).onChange((v) => void this.setControlValue(key, v)));
  }
}
