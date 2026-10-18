import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPost,
  publishPost,
  getPublishedPosts,
  getPost,
  storeCodeSnippet,
  getCodeSnippet,
  listCodeSnippets,
} from '../tgcloud/lib/content.js';
import { __pushDb, __resetDb, dbCalls } from './mocks/sdk-db.js';

beforeEach(__resetDb);

const valuesOf = (steps) => steps.find((s) => s.op === 'values')?.v;

describe('lib/content.js posts', () => {
  it('createPost inserts with published=false and JSON-stringified tags', async () => {
    __pushDb([{ id: 1 }]);
    const post = await createPost('qa', 'Title', 'Body', 40576673, { language: 'ru', tags: ['a', 'b'] });
    expect(post).toEqual({ id: 1 });
    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'posts');
    const v = valuesOf(ins);
    expect(v.type).toBe('qa');
    expect(v.published).toBe(false);
    expect(v.tags).toBe('["a","b"]');
    expect(v.createdBy).toBe(40576673);
  });

  it('createPost stores null tags when absent', async () => {
    __pushDb([{ id: 2 }]);
    await createPost('qa', 'T', 'B', 1);
    const v = valuesOf(dbCalls.find((s) => s[0].op === 'insert'));
    expect(v.tags).toBeNull();
  });

  it('publishPost sets published=true', async () => {
    __pushDb([{ id: 5, published: true }]);
    const post = await publishPost(5);
    expect(post.published).toBe(true);
    const upd = dbCalls.find((s) => s[0].op === 'update' && s[0].table === 'posts');
    expect(upd.find((s) => s.op === 'set').v.published).toBe(true);
  });

  it('getPublishedPosts returns rows', async () => {
    __pushDb([{ id: 1 }, { id: 2 }]);
    const rows = await getPublishedPosts();
    expect(rows).toHaveLength(2);
    const sel = dbCalls[0];
    expect(sel[0].op).toBe('select');
    expect(sel.some((s) => s.op === 'limit' && s.n === 10)).toBe(true);
  });

  // BUG (see audit B3): with a type arg the code calls query.where() a second
  // time and discards the result on immutable builders — the type filter may be
  // silently ignored by the real SDK. The mock builder is mutable, so this test
  // only pins the intended call sequence; verify semantics on the platform.
  it('getPublishedPosts(type) still applies the published filter', async () => {
    __pushDb([]);
    await getPublishedPosts('qa', 5);
    const wheres = dbCalls[0].filter((s) => s.op === 'where');
    expect(wheres.length).toBeGreaterThanOrEqual(1);
  });

  it('getPost fetches by id', async () => {
    __pushDb({ id: 7 });
    const p = await getPost(7);
    expect(p.id).toBe(7);
    expect(dbCalls[0][0].table ?? dbCalls[0].find((s) => s.op === 'from').table).toBe('posts');
  });
});

describe('lib/content.js code snippets', () => {
  it('storeCodeSnippet inserts all fields', async () => {
    __pushDb([{ id: 1 }]);
    const s = await storeCodeSnippet('mod', 'desc', 'code()', 'tgcloud/lib/x.js', 'javascript');
    expect(s.id).toBe(1);
    const v = valuesOf(dbCalls.find((s2) => s2[0].op === 'insert' && s2[0].table === 'code_snippets'));
    expect(v).toMatchObject({ name: 'mod', code: 'code()', filePath: 'tgcloud/lib/x.js', language: 'javascript' });
  });

  it('getCodeSnippet returns null when missing', async () => {
    __pushDb(null);
    expect(await getCodeSnippet('nope')).toBeNull();
  });

  it('listCodeSnippets returns all rows', async () => {
    __pushDb([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(await listCodeSnippets()).toHaveLength(3);
  });
});
