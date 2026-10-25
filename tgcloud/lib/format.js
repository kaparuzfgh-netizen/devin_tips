// HTML fixtures for Telegram messages (parse_mode 'HTML').
// Pure module — must NOT import 'sdk': stays unit-testable and reusable.

import { releaseNames } from './codename.js';
import { VERSION } from './version.js';

export class Html extends String {}

export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function raw(s) {
  return new Html(String(s));
}

const item = (v) => (v instanceof Html ? String(v) : esc(v));

// Tagged template: interpolations are escaped via esc() unless they are Html
// instances (inserted as is) or arrays (joined with '' after the same rule).
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) {
      const v = values[i];
      out += Array.isArray(v) ? v.map(item).join('') : item(v);
    }
  });
  return new Html(out);
}

// --- Inline fixtures ---
export const b = (x) => html`<b>${x}</b>`;
export const i = (x) => html`<i>${x}</i>`;
export const code = (x) => html`<code>${x}</code>`;
export const quote = (x) => html`<blockquote>${x}</blockquote>`;

export function pre(x, lang = '') {
  return lang
    ? html`<pre><code class="language-${lang}">${x}</code></pre>`
    : html`<pre><code>${x}</code></pre>`;
}

const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

export function link(text, url) {
  return raw(`<a href="${escAttr(url)}">${item(text)}</a>`);
}

// --- Layout fixtures ---
export const header = (emoji, title) => html`${emoji} <b>${title}</b>`;

export const list = (items) => new Html(items.map((it) => `• ${item(it)}`).join('\n'));

export const section = (title, bodyHtml) => html`<b>${title}</b>\n${bodyHtml}`;

export const kv = (label, value) => html`${label}: ${value}`;

export const BRAND = 'ВайбКот';
export const CHANNEL = '@devin_tips';
export const FOOTER_TEXT = '🐱 ВайбКот · @devin_tips';
export const DEFAULT_TAGS = ['changelog', 'devin'];

export function footer(date) {
  const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`)
    : null;
  const valid = parsed && !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === date;
  if (!valid) return html`<i>${FOOTER_TEXT}</i>`;
  const { day, week, month } = releaseNames(date);
  return html`<i>${FOOTER_TEXT}</i>\n<i>🐾 выпуск ${day} · неделя ${week} · месяц ${month} · ${VERSION}</i>`;
}

export function tag(name) {
  return '#' + String(name).replace(/[^\p{L}\p{N}_]/gu, '_');
}

export function tags(...names) {
  const seen = new Set();
  const out = [];
  for (const name of names) {
    if (!String(name)) continue;
    const t = tag(name);
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return new Html(out.join(' '));
}

// --- Status fixtures ---
export const ok = (text) => html`✅ ${text}`;
export const fail = (text) => html`❌ ${text}`;
export const empty = (text) => html`📭 ${text}`;
export const unknown = (text) => html`❓ ${text}`;
export const info = (text) => html`ℹ️ ${text}`;

// --- Code/ID fixtures ---
export const formatId = (id) => code(id);
export const formatCode = (codeText, lang) => pre(codeText, lang);

// --- Composers ---
export function changelogPost({ date, groups }) {
  let out = String(header('📝', 'Что нового · ' + date)) + '\n\n';
  for (const g of groups) {
    const category = String(g.category);
    out += `${g.emoji} <b>${esc(category.charAt(0).toUpperCase() + category.slice(1))}</b>\n`;
    out += String(list(g.items)) + '\n\n';
  }
  out += String(footer(date)) + '\n\n';
  out += String(tags(...DEFAULT_TAGS, ...groups.map((g) => g.category)));
  return new Html(out);
}

export function draftPost(draftText, fallbackDate) {
  const text = String(draftText ?? '');
  const lines = text.split('\n');
  const m = lines[0].match(/^(\[ТЕСТ\] )?Что нового за (\d{4}-\d{2}-\d{2})\s*$/);
  let head;
  let body;
  if (m) {
    head = header('📝', (m[1] || '') + 'Что нового · ' + m[2]);
    body = lines.slice(1).join('\n').replace(/^\n+/, '');
  } else {
    head = header('📝', fallbackDate ? 'Что нового · ' + fallbackDate : 'Что нового');
    body = text;
  }
  return new Html(`${head}\n\n${esc(body)}\n\n${footer(m ? m[2] : fallbackDate)}\n\n${tags(...DEFAULT_TAGS)}`);
}

// Visible text without tags/entities — used for the plain-text fallback.
export function stripHtml(htmlString) {
  return String(htmlString)
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}
