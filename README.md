# Review Later

Link the current note into a future daily note, with a date typed in plain English, so it comes back when you want to review it.

Review Later puts a link to the note you are reading into a future daily note, under a heading you choose. When that day comes, the note is in your daily note, where you will see it. It is a tickler file for your vault, and a successor to [Review](https://github.com/ryanjamurphy/review-obsidian) that does not need another plugin to read dates and does not rewrite your daily note as a whole.

## Usage

Open a note and run **Review this note on...** from the command palette (give it a hotkey), the file menu, or the optional ribbon icon. Type a date in plain English and press Enter. The suggestions show the date each phrase resolves to, so you see what you will get before you commit.

| You type | You get (today is Thursday 8 Oct 2026) |
| --- | --- |
| `today`, `tomorrow` | 8 Oct, 9 Oct |
| `monday`, `next monday` | 12 Oct (the next one after today; on a Monday, a week away) |
| `in 3 days`, `in 2 weeks`, `in a month` | 11 Oct, 22 Oct, 8 Nov |
| `next week` | 12 Oct, the first day of next week |
| `next month` | 1 Nov, the first day of next month |
| `2026-11-01`, `nov 1`, `1 november 2027` | that day (without a year, the next one coming up) |

Past dates work too (`yesterday`, `3 days ago`, `2026-09-01`). Months are clamped, so a month after 31 January is 28 February.

Add a short note after a bar: `next monday | check the numbers`. If you have text selected, it goes under the link as a block quote (you can turn that off). Pressing Enter on an empty prompt uses your default date.

There are also commands for the quick picks, **Review this note tomorrow**, **next week** and **next month**, which skip the prompt, and **Show notes scheduled for review**, which lists the review lines in today's and later daily notes and opens the one you pick.

The daily note looks like this afterwards:

```markdown
## Review
- [[Quarterly plan]]: check the numbers
- [[Meeting notes]]
  > "We agreed to revisit the budget in November."
```

- The link follows your link settings (wikilink or Markdown link, shortest path or full path).
- The daily note comes from the core **Daily notes** settings: folder, date format and template. If it does not exist yet, it is created from the template, with the heading added at the end if the template has none. If it exists, the line goes at the end of the section. Nothing else in the note is touched.
- If the daily note is open, the line is added through the editor in a single step, so one undo takes it back. A note that is already listed under the heading is not added twice.

## Settings

- **Review heading**: the section that receives the links (default `## Review`; `Review` means level 2). It is created at the end of the note if missing.
- **Line prefix**: how each line starts (default `- `; use `- [ ] ` for tasks).
- **Keep selected text**: add the selection as a block quote.
- **Default date**: what an empty prompt means (default `tomorrow`).
- **Week starts on**: Monday or Sunday, for “next week”.
- **Ribbon icon**: off by default.

Coming from Review? The heading, line prefix and default date work the same, with the same defaults. Review's block and heading variants are not here yet.

## Privacy

Everything happens inside your vault. Review Later makes no network requests, collects nothing and sends nothing anywhere.

## Installation

In Obsidian, open **Settings → Community plugins → Browse** and search for "Review Later".

## More plugins by Siulved54

| Plugin | What it does | Source |
| --- | --- | --- |
| [Shared Blocks](https://obsidian.md/plugins?id=shared-blocks) | Write a block of text once and reuse it in any note. Edit the source and every reference re-renders live. | [shared-blocks](https://github.com/perezamadorluisenrique-gif/shared-blocks) |
| [Text Case and Cleanup](https://obsidian.md/plugins?id=text-format) | Change case, make camelCase or slugs, sort lines and remove duplicates, and repair text pasted out of a PDF, without touching code or URLs. | [text-format](https://github.com/perezamadorluisenrique-gif/text-format) |
| [Typography as You Type](https://obsidian.md/plugins?id=typography-as-you-type) | Curly quotes, dashes and ellipses as you type, kept out of code and maths, with Backspace to take one back. | [smart-typography-plugin](https://github.com/perezamadorluisenrique-gif/smart-typography-plugin) |
| [Section Numbering](https://obsidian.md/plugins?id=section-numbering) | Number headings as an outline (1, 1.1, 1.2) and keep every link to them working when they renumber. | [section-numbering](https://github.com/perezamadorluisenrique-gif/section-numbering) |
| [Spreadsheet to Table](https://obsidian.md/plugins?id=spreadsheet-to-table) | Paste cells from Excel or Google Sheets as a Markdown table with a real header, insert CSV files, and copy tables back out. | [spreadsheet-to-table](https://github.com/perezamadorluisenrique-gif/spreadsheet-to-table) |
| [Hybrid Line Numbers](https://obsidian.md/plugins?id=hybrid-line-numbers) | Relative and hybrid line numbers for Vim-style jumps, where a folded section counts as one line. | [hybrid-line-numbers](https://github.com/perezamadorluisenrique-gif/hybrid-line-numbers) |
| [List Item Callouts](https://obsidian.md/plugins?id=list-item-callouts) | Colour a single list item as a callout by starting it with a character such as `&`, `!` or `?`. | [list-item-callouts](https://github.com/perezamadorluisenrique-gif/list-item-callouts) |
| [Folder Counts](https://obsidian.md/plugins?id=folder-counts) | See how many notes or files each folder holds, right in the file explorer, with a vault total and folder exclusions. | [folder-counts](https://github.com/perezamadorluisenrique-gif/folder-counts) |
| [Note Reading Time](https://obsidian.md/plugins?id=note-reading-time) | Reading time of the current note or your selection in the status bar, optionally saved to a property. | [note-reading-time](https://github.com/perezamadorluisenrique-gif/note-reading-time) |
| [Task Rollover](https://obsidian.md/plugins?id=task-rollover) | Roll unfinished tasks from your last daily note into today's when it is created, with a real undo. | [task-rollover](https://github.com/perezamadorluisenrique-gif/task-rollover) |
| [Zoom Into Section](https://obsidian.md/plugins?id=zoom-into-section) | Zoom into a heading or list item to see only it and its contents, with a breadcrumb bar to climb back out. | [zoom-into-section](https://github.com/perezamadorluisenrique-gif/zoom-into-section) |
| [Link Title on Paste](https://obsidian.md/plugins?id=link-title-on-paste) | Paste a web address and get a Markdown link with the page's title, fetched in the background and undone in one step. | [link-title-on-paste](https://github.com/perezamadorluisenrique-gif/link-title-on-paste) |
| [Update Radar](https://obsidian.md/plugins?id=update-radar) | Checks your installed community plugins for updates in the background, shows what changed, and flags the ones that look abandoned. | [community-update-checker](https://github.com/perezamadorluisenrique-gif/community-update-checker) |
| [Dataview to Bases](https://obsidian.md/plugins?id=dataview-to-bases) | Convert Dataview queries into Bases blocks, and see which queries in your vault can be converted. | [dataview-to-bases](https://github.com/perezamadorluisenrique-gif/dataview-to-bases) |
| [Line Editing Commands](https://obsidian.md/plugins?id=line-editing-commands) | Duplicate, join, sort and reverse lines, insert blank lines and jump to a line number, with multi-cursor support. | [line-editing-commands](https://github.com/perezamadorluisenrique-gif/line-editing-commands) |
| [Note Mover Rules](https://obsidian.md/plugins?id=note-mover-rules) | Move notes into folders by ordered rules on tags, properties, titles and paths, with a preview before any bulk move. | [note-mover-rules](https://github.com/perezamadorluisenrique-gif/note-mover-rules) |
| [Tab History](https://obsidian.md/plugins?id=tab-history) | Keeps each tab's back and forward history across restarts, and adds commands to move, maximize and close tabs. | [tab-history](https://github.com/perezamadorluisenrique-gif/tab-history) |
| [URL Cards](https://obsidian.md/plugins?id=url-cards) | Shows web addresses as cards with title, description and image, and reads existing cardlink blocks. | [url-cards](https://github.com/perezamadorluisenrique-gif/url-cards) |
| [Vim Config](https://obsidian.md/plugins?id=vim-config) | Loads a vimrc-style file from your vault so your key mappings and editor commands are ready when vim mode starts. | [vim-config](https://github.com/perezamadorluisenrique-gif/vim-config) |
| [Task Archive](https://obsidian.md/plugins?id=task-archive) | Moves completed tasks, with their sub-items, into an archive section or note. | [task-archive](https://github.com/perezamadorluisenrique-gif/task-archive) |

All of them are in the community directory: Settings -> Community plugins ->
Browse, then search for the name.
