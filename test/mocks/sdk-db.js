// Mock of 'sdk/db' for unit tests.
//
// Query-builder chains are recorded into `dbCalls` (one entry per terminal
// call). Terminal methods (.get/.all/.run and raw db.run/all/get/values/$count)
// resolve values taken from a FIFO queue — push expected rows per test with
// __pushDb(...), inspect recorded chains in dbCalls afterwards.

const dbQueue = [];
export const dbCalls = [];

export function __pushDb(...results) {
  dbQueue.push(...results);
}

export function __resetDb() {
  dbQueue.length = 0;
  dbCalls.length = 0;
}

function makeChain(type, tbl) {
  /** @type {any[]} */
  const steps = [{ op: type, table: tbl && tbl.__name }];
  const b = {
    __steps: steps,
    from: (t) => { steps.push({ op: 'from', table: t.__name }); return b; },
    where: (...conds) => { steps.push({ op: 'where', conds }); return b; },
    orderBy: (...cols) => { steps.push({ op: 'orderBy', cols }); return b; },
    limit: (n) => { steps.push({ op: 'limit', n }); return b; },
    offset: (n) => { steps.push({ op: 'offset', n }); return b; },
    groupBy: (...cols) => { steps.push({ op: 'groupBy', cols }); return b; },
    having: (...conds) => { steps.push({ op: 'having', conds }); return b; },
    distinct: () => { steps.push({ op: 'distinct' }); return b; },
    set: (v) => { steps.push({ op: 'set', v }); return b; },
    values: (v) => { steps.push({ op: 'values', v }); return b; },
    returning: (p) => { steps.push({ op: 'returning', p }); return b; },
    onConflictDoNothing: (o) => { steps.push({ op: 'onConflictDoNothing', o }); return b; },
    onConflictDoUpdate: (o) => { steps.push({ op: 'onConflictDoUpdate', o }); return b; },
    get: () => { dbCalls.push(steps); return Promise.resolve(dbQueue.shift() ?? null); },
    all: () => { dbCalls.push(steps); return Promise.resolve(dbQueue.shift() ?? []); },
    run: () => { dbCalls.push(steps); return Promise.resolve(dbQueue.shift() ?? { rowsAffected: 1, lastInsertRowid: 1, rows: [] }); },
    // awaitable builder: `await db.select().from(t)` resolves like .all()
    then: (resolve) => { dbCalls.push(steps); resolve(dbQueue.shift() ?? []); },
  };
  return b;
}

export const db = {
  select: () => makeChain('select'),
  insert: (t) => makeChain('insert', t),
  update: (t) => makeChain('update', t),
  delete: (t) => makeChain('delete', t),
  $count: () => Promise.resolve(dbQueue.shift() ?? 0),
  run: () => Promise.resolve(dbQueue.shift() ?? { rowsAffected: 0, lastInsertRowid: 0, rows: [] }),
  all: () => Promise.resolve(dbQueue.shift() ?? []),
  get: () => Promise.resolve(dbQueue.shift() ?? null),
  values: () => Promise.resolve(dbQueue.shift() ?? []),
};
export default db;

// --- Schema DSL ---

// A column ref: any chained modifier (.primaryKey(), .notNull(), .default(...),
// .deprecated(...), ...) returns the same column object.
function makeColumn(name) {
  const target = { __name: name };
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return undefined;
      if (prop in t) return t[prop];
      return () => proxy;
    },
  });
  return proxy;
}

export const integer = (name) => makeColumn(name);
export const text = (name) => makeColumn(name);
export const real = (name) => makeColumn(name);
export const float = (name) => makeColumn(name);
export const numeric = (name) => makeColumn(name);
export const blob = (name) => makeColumn(name);
export const boolean = (name) => makeColumn(name);
export const json = (name) => makeColumn(name);

export function table(name, cols) {
  const t = { __name: name };
  for (const k of Object.keys(cols)) t[k] = cols[k];
  return t;
}

export function sql(strings, ...vals) {
  return { __sql: Array.isArray(strings) ? strings.join('?') : strings, vals };
}
sql.raw = (s) => ({ __sql: s });

const op = (name) => (...args) => ({ op: name, args });

export const eq = op('eq');
export const ne = op('ne');
export const gt = op('gt');
export const gte = op('gte');
export const lt = op('lt');
export const lte = op('lte');
export const like = op('like');
export const notLike = op('notLike');
export const isNull = op('isNull');
export const isNotNull = op('isNotNull');
export const and = op('and');
export const or = op('or');
export const not = op('not');
export const between = op('between');
export const notBetween = op('notBetween');
export const inArray = op('inArray');
export const notInArray = op('notInArray');
export const count = op('count');
export const sum = op('sum');
export const avg = op('avg');
export const min = op('min');
export const max = op('max');
export const asc = op('asc');
export const desc = op('desc');
export const primaryKey = op('primaryKey');
export const unique = op('unique');
export const uniqueIndex = op('uniqueIndex');
export const index = op('index');
export const check = op('check');
