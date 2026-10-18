// Mock of 'sdk' for unit tests.
//
// api.* — every Bot API method call is recorded into apiCalls and resolved via
//   the handler set with __onApi((method, params) => value | throw).
// fetch — outbound HTTP; calls recorded into fetchCalls, response via __onFetch.
// db   — re-exported from ./sdk-db.js (FIFO queue via __pushDb).

export { db, __pushDb, __resetDb, dbCalls } from './sdk-db.js';

export const apiCalls = [];
let apiHandler = null;

// Telegram-style validator for parse_mode 'HTML': allowed tags only, balanced
// and properly nested, attributes restricted (href on <a>, class on
// <code>/<span>), every '<' must open a valid tag, every '&' must start a
// known entity (&lt; &gt; &amp; &quot;). Stray '>' is tolerated.
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del',
  'a', 'code', 'pre', 'blockquote', 'tg-spoiler', 'tg-emoji', 'span',
]);
const ATTR_TAGS = { a: new Set(['href']), code: new Set(['class']), span: new Set(['class']) };

export function validateHtml(text) {
  const s = String(text);
  const stack = [];
  let pos = 0;
  while (pos < s.length) {
    const ch = s[pos];
    if (ch === '<') {
      const m = s.slice(pos).match(/^<(\/?)([a-zA-Z-]+)((?:\s+[a-zA-Z-]+="[^"]*")*)>/);
      if (!m) return false;
      const [, closing, tagName, attrs] = m;
      if (!ALLOWED_TAGS.has(tagName)) return false;
      if (attrs.trim()) {
        const allowed = ATTR_TAGS[tagName];
        for (const am of attrs.trim().matchAll(/([a-zA-Z-]+)="[^"]*"/g)) {
          if (!allowed || !allowed.has(am[1])) return false;
        }
      }
      if (closing) {
        if (stack.pop() !== tagName) return false;
      } else {
        stack.push(tagName);
      }
      pos += m[0].length;
    } else if (ch === '&') {
      const m = s.slice(pos).match(/^&(lt|gt|amp|quot);/);
      if (!m) return false;
      pos += m[0].length;
    } else {
      pos += 1;
    }
  }
  return stack.length === 0;
}

export function __onApi(fn) {
  apiHandler = fn;
}

export function __resetApi() {
  apiCalls.length = 0;
  apiHandler = null;
}

export const api = new Proxy({}, {
  get(target, method) {
    if (method === 'then' || typeof method === 'symbol') return undefined;
    return async (params) => {
      const call = { method, params };
      apiCalls.push(call);
      if (
        method === 'sendMessage'
        && params?.parse_mode === 'HTML'
        && !validateHtml(params.text)
      ) {
        call.invalidHtml = true;
        throw new BotApiError("Bad Request: can't parse entities", { code: 400, method: 'sendMessage' });
      }
      if (apiHandler) return apiHandler(method, params);
      return {};
    };
  },
});

export class BotApiError extends Error {
  /** @param {string} description @param {{ code?: number, method?: string, parameters?: any }} [opts] */
  constructor(description, { code, method, parameters } = {}) {
    super(description);
    this.code = code;
    this.description = description;
    this.method = method;
    this.parameters = parameters;
  }
}

export class EndpointError extends Error {
  constructor(description, parameters) {
    super(description);
    this.description = description;
    this.parameters = parameters;
  }
}

export class InputFile {
  constructor(bytes, filename, opts = {}) {
    this.bytes = bytes;
    this.filename = filename;
    this.type = opts.type;
  }
}

export class FormData {
  constructor() {
    this.parts = [];
  }
  append(key, value) {
    this.parts.push([key, value]);
  }
}

export const fetchCalls = [];
let fetchHandler = null;

export function __onFetch(fn) {
  fetchHandler = fn;
}

export function __resetFetch() {
  fetchCalls.length = 0;
  fetchHandler = null;
}

export function fetch(url, opts = {}) {
  fetchCalls.push({ url, opts });
  if (fetchHandler) return Promise.resolve(fetchHandler(url, opts));
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    url,
    headers: { get: () => null, has: () => false },
    json: async () => ({}),
    text: async () => '',
    bodyUsed: false,
  });
}
fetch.body = {
  json: (o) => ({ __body: 'json', value: o }),
  form: (o) => ({ __body: 'form', value: o }),
  text: (t) => ({ __body: 'text', value: t }),
};
