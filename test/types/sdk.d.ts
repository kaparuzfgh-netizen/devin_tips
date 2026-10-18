// Ambient type stubs for the tgcloud platform SDK.
// The platform publishes no .d.ts; this stub exists for name resolution only,
// so tsc can check tgcloud/**/*.js (e.g. catch undefined identifiers like
// KI-002 `chat_id`). Everything is intentionally `any`-typed.
// Runtime behavior in tests is covered by the vitest aliases in
// test/mocks/sdk.js and test/mocks/sdk-db.js.

declare module 'sdk' {
  export const api: any;
  export const db: any;
  export const fetch: any;

  export class BotApiError extends Error {
    code?: number;
    description?: string;
    method?: string;
    parameters?: any;
  }

  export class EndpointError extends Error {
    description?: string;
    parameters?: any;
  }

  export class InputFile {
    constructor(bytes: any, filename?: string, opts?: any);
  }

  export class FormData {
    append(key: string, value: any): void;
  }
}

declare module 'sdk/db' {
  export const db: any;
  export default db;

  // Schema DSL
  export const table: any;
  export const integer: any;
  export const text: any;
  export const real: any;
  export const float: any;
  export const numeric: any;
  export const blob: any;
  export const boolean: any;
  export const json: any;
  export const index: any;
  export const check: any;
  export const sql: any;
  export const primaryKey: any;
  export const unique: any;
  export const uniqueIndex: any;

  // Query operators
  export const eq: any;
  export const ne: any;
  export const gt: any;
  export const gte: any;
  export const lt: any;
  export const lte: any;
  export const like: any;
  export const notLike: any;
  export const isNull: any;
  export const isNotNull: any;
  export const and: any;
  export const or: any;
  export const not: any;
  export const between: any;
  export const notBetween: any;
  export const inArray: any;
  export const notInArray: any;
  export const count: any;
  export const sum: any;
  export const avg: any;
  export const min: any;
  export const max: any;
  export const asc: any;
  export const desc: any;
}
