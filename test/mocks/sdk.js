// Mock of 'sdk' for unit tests.
//
// api.* — every Bot API method call is recorded into apiCalls and resolved via
//   the handler set with __onApi((method, params) => value | throw).
// fetch — outbound HTTP; calls recorded into fetchCalls, response via __onFetch.
// db   — re-exported from ./sdk-db.js (FIFO queue via __pushDb).

export { db, __pushDb, __resetDb, dbCalls } from './sdk-db.js';

export const apiCalls = [];
let apiHandler = null;

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
      apiCalls.push({ method, params });
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
