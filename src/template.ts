// The core Daily notes template variables: {{title}}, {{date}}, {{time}}, each
// with an optional ":FORMAT", like {{date:dddd, D MMMM}}.

export interface TemplateContext {
  /** Name of the new note, without extension. */
  title: string;
  /** Formats the note's date. */
  date: (format: string) => string;
  /** Formats the current time. */
  time: (format: string) => string;
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{\s*(title|date|time)\s*(?::([^}]*))?\}\}/gi, (_all, name: string, format?: string) => {
    const fmt = format?.trim();
    switch (name.toLowerCase()) {
      case 'title': return ctx.title;
      case 'date': return ctx.date(fmt || 'YYYY-MM-DD');
      default: return ctx.time(fmt || 'HH:mm');
    }
  });
}
