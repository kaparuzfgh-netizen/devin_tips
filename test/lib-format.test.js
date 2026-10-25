import { describe, it, expect } from 'vitest';
import {
  Html,
  esc,
  raw,
  html,
  b,
  i,
  code,
  pre,
  link,
  quote,
  header,
  list,
  section,
  kv,
  footer,
  tag,
  tags,
  ok,
  fail,
  empty,
  unknown,
  info,
  formatId,
  formatCode,
  changelogPost,
  draftPost,
  stripHtml,
  BRAND,
  CHANNEL,
  FOOTER_TEXT,
  DEFAULT_TAGS,
} from '../tgcloud/lib/format.js';
import { VERSION } from '../tgcloud/lib/version.js';
import { validateHtml } from './mocks/sdk.js';

describe('lib/format.js esc', () => {
  it('escapes &, <, > in the right order', () => {
    expect(esc('a<b>&"c"')).toBe('a&lt;b&gt;&amp;"c"');
    expect(esc('&lt;')).toBe('&amp;lt;');
  });

  it('handles null, undefined and numbers', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(42)).toBe('42');
  });
});

describe('lib/format.js html tag', () => {
  it('escapes plain interpolations', () => {
    expect(String(html`x ${'<script>'} y`)).toBe('x &lt;script&gt; y');
    expect(String(html`a ${'&amp;'} b`)).toBe('a &amp;amp; b');
  });

  it('inserts Html instances verbatim', () => {
    expect(String(html`x ${b('y')} z`)).toBe('x <b>y</b> z');
    expect(String(html`x ${raw('<u>y</u>')} z`)).toBe('x <u>y</u> z');
  });

  it('joins arrays with per-item escaping', () => {
    expect(String(html`[${['a<b', raw('<i>c</i>'), 'd']}]`)).toBe('[a&lt;b<i>c</i>d]');
  });

  it('returns an Html instance', () => {
    expect(html`x`).toBeInstanceOf(Html);
    expect(raw('x')).toBeInstanceOf(Html);
  });
});

describe('lib/format.js inline fixtures', () => {
  it('b, i, code, quote wrap with escaping', () => {
    expect(String(b('a<b'))).toBe('<b>a&lt;b</b>');
    expect(String(i('x'))).toBe('<i>x</i>');
    expect(String(code('a<b'))).toBe('<code>a&lt;b</code>');
    expect(String(quote('q'))).toBe('<blockquote>q</blockquote>');
  });

  it('pre without lang has no class attribute', () => {
    expect(String(pre('x<y'))).toBe('<pre><code>x&lt;y</code></pre>');
  });

  it('pre with lang adds the language class', () => {
    expect(String(pre('const a = 1;', 'js'))).toBe('<pre><code class="language-js">const a = 1;</code></pre>');
  });

  it('link escapes url including quotes', () => {
    expect(String(link('t', 'https://x/?a="b"&c=1'))).toBe('<a href="https://x/?a=&quot;b&quot;&amp;c=1">t</a>');
    expect(String(link('a<b', 'https://x'))).toBe('<a href="https://x">a&lt;b</a>');
  });
});

describe('lib/format.js layout fixtures', () => {
  it('header renders emoji + bold title', () => {
    expect(String(header('📝', 'Что нового · 2026-10-18'))).toBe('📝 <b>Что нового · 2026-10-18</b>');
  });

  it('list renders bullet lines with per-item escaping', () => {
    expect(String(list(['a<b', b('B')]))).toBe('• a&lt;b\n• <b>B</b>');
    expect(String(list([]))).toBe('');
  });

  it('section renders bold title + body', () => {
    expect(String(section('📚 Команды', list(['x'])))).toBe('<b>📚 Команды</b>\n• x');
  });

  it('kv renders label: value', () => {
    expect(String(kv('Роль', 'admin'))).toBe('Роль: admin');
  });

  it('footer renders the brand line in italics', () => {
    expect(String(footer())).toBe(`<i>🐱 ВайбКот · @devin_tips · ${VERSION}</i>`);
    expect(BRAND).toBe('ВайбКот');
    expect(CHANNEL).toBe('@devin_tips');
    expect(FOOTER_TEXT).toBe(`🐱 ВайбКот · @devin_tips · ${VERSION}`);
    expect(DEFAULT_TAGS).toEqual(['changelog', 'devin']);
  });

  it('tag sanitizes non-word chars to underscore, keeps letters/digits/_', () => {
    expect(tag('hello world!')).toBe('#hello_world_');
    expect(tag('devin-tips')).toBe('#devin_tips');
    expect(tag('кириллица')).toBe('#кириллица');
    expect(tag('a_b')).toBe('#a_b');
  });

  it('tags joins with space, drops empty and duplicate names', () => {
    expect(String(tags('a', '', 'a', 'b'))).toBe('#a #b');
    expect(String(tags('a-b', 'a_b'))).toBe('#a_b');
  });
});

describe('lib/format.js status fixtures', () => {
  it('ok/fail/empty/unknown/info prepend their emoji and escape text', () => {
    expect(String(ok('done<b>'))).toBe('✅ done&lt;b&gt;');
    expect(String(fail('no'))).toBe('❌ no');
    expect(String(empty('none'))).toBe('📭 none');
    expect(String(unknown('huh'))).toBe('❓ huh');
    expect(String(info('fyi'))).toBe('ℹ️ fyi');
  });

  it('status fixtures pass Html through unescaped', () => {
    expect(String(ok(b('done')))).toBe('✅ <b>done</b>');
  });
});

describe('lib/format.js code fixtures', () => {
  it('formatId renders <code>', () => {
    expect(String(formatId(40576673))).toBe('<code>40576673</code>');
  });

  it('formatCode renders pre', () => {
    expect(String(formatCode('x'))).toBe('<pre><code>x</code></pre>');
    expect(String(formatCode('x', 'js'))).toBe('<pre><code class="language-js">x</code></pre>');
  });
});

describe('lib/format.js changelogPost', () => {
  it('composes header, grouped items, footer and tags', () => {
    const post = changelogPost({
      date: '2026-10-18',
      groups: [
        { category: 'feature', emoji: '✨', items: ['added a<b', 'other'] },
        { category: 'fix', emoji: '🐛', items: ['fixed x'] },
      ],
    });
    const s = String(post);
    expect(post).toBeInstanceOf(Html);
    expect(s).toContain('📝 <b>Что нового · 2026-10-18</b>');
    expect(s).toContain('✨ <b>Feature</b>\n• added a&lt;b\n• other');
    expect(s).toContain('🐛 <b>Fix</b>\n• fixed x');
    expect(s).toContain(`<i>🐱 ВайбКот · @devin_tips · ${VERSION}</i>`);
    expect(s).toContain('#changelog #devin #feature #fix');
    expect(validateHtml(s)).toBe(true);
  });
});

describe('lib/format.js draftPost', () => {
  it('uses the dated first line as header and the rest as escaped body', () => {
    const s = String(draftPost('Что нового за 2026-10-18\n\nbody <b>text', 'ignored'));
    expect(s).toContain('📝 <b>Что нового · 2026-10-18</b>');
    expect(s).toContain('body &lt;b&gt;text');
    expect(s).toContain(`<i>🐱 ВайбКот · @devin_tips · ${VERSION}</i>`);
    expect(s).toContain('#changelog #devin');
    expect(validateHtml(s)).toBe(true);
  });

  it('keeps the [ТЕСТ] prefix in the header', () => {
    const s = String(draftPost('[ТЕСТ] Что нового за 2026-10-18\nbody', undefined));
    expect(s).toContain('📝 <b>[ТЕСТ] Что нового · 2026-10-18</b>');
    expect(s).toContain('body');
  });

  it('falls back to the callback date and escapes the whole text', () => {
    const s = String(draftPost('freeform <draft>', '2026-10-18'));
    expect(s).toContain('📝 <b>Что нового · 2026-10-18</b>');
    expect(s).toContain('freeform &lt;draft&gt;');
  });

  it('renders a bare title when no date is known', () => {
    const s = String(draftPost('freeform', undefined));
    expect(s).toContain('📝 <b>Что нового</b>');
  });
});

describe('lib/format.js footer with version', () => {
  it('footer() renders the brand line with VERSION', () => {
    const s = String(footer());
    expect(s).toBe(`<i>🐱 ВайбКот · @devin_tips · ${VERSION}</i>`);
    expect(s).toContain(VERSION);
    expect(validateHtml(s)).toBe(true);
  });

  it('changelogPost footer carries VERSION', () => {
    const s = String(changelogPost({
      date: '2026-10-20',
      groups: [{ category: 'feature', emoji: '✨', items: ['added x'] }],
    }));
    expect(s).toContain(`<i>🐱 ВайбКот · @devin_tips · ${VERSION}</i>`);
    expect(validateHtml(s)).toBe(true);
  });

  it('draftPost footer carries VERSION with and without a dated header', () => {
    const dated = String(draftPost('Что нового за 2026-10-20\n\nbody', 'ignored'));
    const undated = String(draftPost('freeform', undefined));
    expect(dated).toContain(`<i>🐱 ВайбКот · @devin_tips · ${VERSION}</i>`);
    expect(undated).toContain(`<i>🐱 ВайбКот · @devin_tips · ${VERSION}</i>`);
    expect(validateHtml(dated)).toBe(true);
  });
});

describe('lib/format.js stripHtml', () => {
  it('removes tags and decodes entities', () => {
    expect(stripHtml('<b>a</b> &lt;x&gt; &amp; &quot;q&quot;')).toBe('a <x> & "q"');
    expect(stripHtml(raw('plain'))).toBe('plain');
  });
});

describe('mock HTML validator', () => {
  it('rejects unbalanced, stray-< and bare-& texts', () => {
    expect(validateHtml('<b>x')).toBe(false);
    expect(validateHtml('a < b')).toBe(false);
    expect(validateHtml('fish & chips')).toBe(false);
    expect(validateHtml('a </i>')).toBe(false);
    expect(validateHtml('<b><i>x</b></i>')).toBe(false);
    expect(validateHtml('<script>x</script>')).toBe(false);
    expect(validateHtml('<b foo="1">x</b>')).toBe(false);
  });

  it('accepts valid HTML', () => {
    expect(validateHtml('<b>bold</b> and <i>it</i>')).toBe(true);
    expect(validateHtml('<a href="https://x">link</a>')).toBe(true);
    expect(validateHtml('<pre><code class="language-js">x&lt;y</code></pre>')).toBe(true);
    expect(validateHtml('plain > text &amp; entities')).toBe(true);
    expect(validateHtml('• a\n• b')).toBe(true);
  });
});
