import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyChange, continuationIndent, entries, formatEntry, headingText, parseHeading, planAppend, sectionLines } from '../src/insert.ts';

const H = parseHeading('Review');
const add = (text: string, entry = '- [[A]]', spec = H) => {
  const c = planAppend(text, spec, entry);
  return c ? applyChange(text, c) : null;
};

test('parseHeading takes "## Review" and "Review"', () => {
  assert.deepEqual(parseHeading('## Review'), { level: 2, title: 'Review' });
  assert.deepEqual(parseHeading('Review'), { level: 2, title: 'Review' });
  assert.deepEqual(parseHeading('### To review ###'), { level: 3, title: 'To review' });
  assert.deepEqual(parseHeading('Review', 1), { level: 1, title: 'Review' });
  assert.deepEqual(parseHeading(''), { level: 2, title: 'Review' });
  assert.deepEqual(parseHeading('   '), { level: 2, title: 'Review' });
  assert.equal(headingText({ level: 3, title: 'X' }), '### X');
});

test('creates the heading at the end of a note', () => {
  assert.equal(add('# Day\n\nSome text\n'), '# Day\n\nSome text\n\n## Review\n- [[A]]\n');
  assert.equal(add('# Day\nSome text'), '# Day\nSome text\n\n## Review\n- [[A]]\n');
  assert.equal(add('# Day\n\n\n\n'), '# Day\n\n## Review\n- [[A]]\n');
});

test('an empty note gets just the section', () => {
  assert.equal(add(''), '## Review\n- [[A]]\n');
});

test('appends at the end of an existing section', () => {
  assert.equal(add('## Review\n- [[B]]\n'), '## Review\n- [[B]]\n- [[A]]\n');
  assert.equal(add('## Review\n- [[B]]\n- [[C]]\n\n## Other\nx\n'), '## Review\n- [[B]]\n- [[C]]\n- [[A]]\n\n## Other\nx\n');
  assert.equal(add('## Review\n\n## Other\n'), '## Review\n- [[A]]\n\n## Other\n');
  assert.equal(add('## Review'), '## Review\n- [[A]]');
  assert.equal(add('## Review\n- [[B]]'), '## Review\n- [[B]]\n- [[A]]');
  assert.equal(add('intro\n\n## Review\n- [[B]]\n\n\n## Other\nx'), 'intro\n\n## Review\n- [[B]]\n- [[A]]\n\n\n## Other\nx');
});

test('the section runs through deeper headings and stops at an equal or higher one', () => {
  assert.equal(add('## Review\n- [[B]]\n### Sub\n- s\n## Next\n'), '## Review\n- [[B]]\n### Sub\n- s\n- [[A]]\n## Next\n');
  assert.equal(add('# Top\n## Review\n- [[B]]\n# Top 2\n'), '# Top\n## Review\n- [[B]]\n- [[A]]\n# Top 2\n');
});

test('heading match ignores case, trailing hashes and indentation up to three spaces', () => {
  assert.equal(add('## review\n- [[B]]\n'), '## review\n- [[B]]\n- [[A]]\n');
  assert.equal(add('## Review ##\n- [[B]]\n'), '## Review ##\n- [[B]]\n- [[A]]\n');
  assert.equal(add('   ## Review\n- [[B]]\n'), '   ## Review\n- [[B]]\n- [[A]]\n');
  // Four spaces is a code block, not a heading.
  assert.equal(add('    ## Review\nx\n'), '    ## Review\nx\n\n## Review\n- [[A]]\n');
});

test('prefers the configured level, then any level with that title', () => {
  const text = '# Review\nx\n## Review\n- [[B]]\n';
  assert.equal(add(text), '# Review\nx\n## Review\n- [[B]]\n- [[A]]\n');
  assert.equal(add('### Review\n- [[B]]\n'), '### Review\n- [[B]]\n- [[A]]\n');
  assert.equal(add('# Review\n- [[B]]\n', '- [[A]]', parseHeading('## Review')), '# Review\n- [[B]]\n- [[A]]\n');
});

test('a similar heading does not match', () => {
  assert.equal(add('## Reviews\nx\n'), '## Reviews\nx\n\n## Review\n- [[A]]\n');
  assert.equal(add('## Review later\nx\n'), '## Review later\nx\n\n## Review\n- [[A]]\n');
});

test('headings inside code fences and front matter do not count', () => {
  assert.equal(add('```\n## Review\n```\n'), '```\n## Review\n```\n\n## Review\n- [[A]]\n');
  assert.equal(add('~~~md\n## Review\n~~~\ntext\n'), '~~~md\n## Review\n~~~\ntext\n\n## Review\n- [[A]]\n');
  assert.equal(add('---\ntitle: x\n# Review\n---\nbody\n'), '---\ntitle: x\n# Review\n---\nbody\n\n## Review\n- [[A]]\n');
  // A fence inside the section does not end it.
  assert.equal(add('## Review\n```\n## Other\n```\n'), '## Review\n```\n## Other\n```\n- [[A]]\n');
  // An unclosed fence swallows the rest.
  assert.equal(add('```\n## Review\n'), '```\n## Review\n\n## Review\n- [[A]]\n');
  // The longer closing fence closes; a shorter one does not.
  assert.equal(add('````\n```\n## Review\n````\n'), '````\n```\n## Review\n````\n\n## Review\n- [[A]]\n');
});

test('front matter is skipped only at the very start', () => {
  assert.equal(add('---\na: 1\n---\n## Review\n- [[B]]\n'), '---\na: 1\n---\n## Review\n- [[B]]\n- [[A]]\n');
  assert.equal(add('text\n---\n## Review\n'), 'text\n---\n## Review\n- [[A]]\n');
});

test('Windows line endings are kept', () => {
  const c = planAppend('## Review\r\n- [[B]]\r\n', H, '- [[A]]')!;
  assert.equal(c.insert, '\n- [[A]]');
  assert.equal(applyChange('## Review\r\n- [[B]]\r\n', c), '## Review\r\n- [[B]]\n- [[A]]\r\n');
});

test('does not repeat an entry already in the section', () => {
  assert.equal(planAppend('## Review\n- [[A]]\n', H, '- [[A]]'), null);
  assert.equal(planAppend('## Review\n- [[A]]\n', H, '- [[A]]\n  > quote'), null);
  assert.notEqual(planAppend('## Review\n- [[A]] \n- [[B]]\n', H, '- [[A]]: note'), null);
  // The same line in another section is not a repeat.
  assert.notEqual(planAppend('## Other\n- [[A]]\n', H, '- [[A]]'), null);
});

test('the change is a range edit, so an editor can apply it as one transaction', () => {
  const text = '## Review\n- [[B]]\n\n## Other\n';
  assert.deepEqual(planAppend(text, H, '- [[A]]'), { from: 17, to: 17, insert: '\n- [[A]]' });
  assert.deepEqual(planAppend('x\n', H, '- [[A]]'), { from: 1, to: 2, insert: '\n\n## Review\n- [[A]]\n' });
});

test('formatEntry', () => {
  assert.equal(formatEntry({ prefix: '- ', link: '[[A]]' }), '- [[A]]');
  assert.equal(formatEntry({ prefix: '- [ ] ', link: '[[A]]' }), '- [ ] [[A]]');
  assert.equal(formatEntry({ prefix: '', link: '[[A]]' }), '[[A]]');
  assert.equal(formatEntry({ prefix: '- ', link: '[[A]]', note: '  check   the numbers ' }), '- [[A]]: check the numbers');
  assert.equal(formatEntry({ prefix: '- ', link: '[[A]]', note: '   ' }), '- [[A]]');
  assert.equal(formatEntry({ prefix: '- ', link: '[[A]]', quote: 'one\ntwo' }), '- [[A]]\n  > one\n  > two');
  assert.equal(formatEntry({ prefix: '- ', link: '[[A]]', quote: 'one\n\ntwo\n' }), '- [[A]]\n  > one\n  >\n  > two');
  assert.equal(formatEntry({ prefix: '- [ ] ', link: '[[A]]', quote: 'q' }), '- [ ] [[A]]\n  > q');
  assert.equal(formatEntry({ prefix: '1. ', link: '[[A]]', quote: 'q' }), '1. [[A]]\n   > q');
  assert.equal(formatEntry({ prefix: '', link: '[[A]]', quote: 'q' }), '[[A]]\n> q');
  assert.equal(formatEntry({ prefix: '- ', link: '[[A]]', note: 'n', quote: 'q' }), '- [[A]]: n\n  > q');
  assert.equal(formatEntry({ prefix: '- ', link: '[[A]]', quote: '\r\nwin\r\ndows\r\n\r\n' }), '- [[A]]\n  > win\n  > dows');
  assert.equal(formatEntry({ prefix: '- ', link: '[[A]]', quote: '   ' }), '- [[A]]');
  assert.equal(continuationIndent('  - '), '    ');
});

test('an entry with a quote lands inside the section', () => {
  const entry = formatEntry({ prefix: '- ', link: '[[A]]', quote: 'q1\nq2' });
  assert.equal(add('## Review\n- [[B]]\n  > old\n\n## Other\n', entry), '## Review\n- [[B]]\n  > old\n- [[A]]\n  > q1\n  > q2\n\n## Other\n');
});

test('sectionLines and entries', () => {
  const text = '# D\n## Review\n- [[A]]\n  > quote\n- [[B]]: note\n\n## Other\n- x\n';
  assert.deepEqual(sectionLines(text, H), ['- [[A]]', '  > quote', '- [[B]]: note', '']);
  assert.deepEqual(entries(text, H), ['- [[A]]', '- [[B]]: note']);
  assert.deepEqual(entries('# D\n', H), []);
  assert.deepEqual(sectionLines('', H), []);
});
