import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateUser, isAdmin, hasPermission } from '../tgcloud/lib/auth.js';
import { __pushDb, __resetDb, dbCalls } from './mocks/sdk-db.js';

beforeEach(__resetDb);

const admin = { telegramId: 40576673, username: 'kaparuz', role: 'admin' };
const plain = { telegramId: 999, username: 'someone', role: 'user' };

const valuesOf = (steps) => steps.find((s) => s.op === 'values')?.v;

describe('lib/auth.js getOrCreateUser', () => {
  it('returns existing user, one read and no writes', async () => {
    __pushDb(plain);
    const u = await getOrCreateUser(999, 'someone');
    expect(u).toEqual(plain);
    expect(dbCalls).toHaveLength(1);
    expect(dbCalls[0][0].op).toBe('select');
  });

  it('creates a new user with role user', async () => {
    __pushDb(null, [{ telegramId: 999, username: 'x', role: 'user' }]);
    const u = await getOrCreateUser(999, 'x');
    expect(u.role).toBe('user');
    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'users');
    expect(valuesOf(ins).role).toBe('user');
  });

  it('creates a new admin when id is whitelisted', async () => {
    __pushDb(null, [{ telegramId: 40576673, username: 'k', role: 'admin' }]);
    const u = await getOrCreateUser(40576673, 'k');
    expect(u.role).toBe('admin');
    const ins = dbCalls.find((s) => s[0].op === 'insert');
    expect(valuesOf(ins).role).toBe('admin');
  });

  it('creates a new admin when username is whitelisted (legacy list)', async () => {
    __pushDb(null, [{ telegramId: 1, username: 'kaparuz', role: 'admin' }]);
    const u = await getOrCreateUser(1, 'kaparuz');
    expect(u.role).toBe('admin');
  });

  it('updates stored username when it changed', async () => {
    __pushDb(
      { telegramId: 999, username: 'old', role: 'user' },
      [{ telegramId: 999, username: 'new', role: 'user' }],
    );
    const u = await getOrCreateUser(999, 'new');
    expect(u.username).toBe('new');
    const upd = dbCalls.find((s) => s[0].op === 'update' && s[0].table === 'users');
    expect(upd).toBeTruthy();
    expect(upd.find((s) => s.op === 'set').v).toEqual({ username: 'new' });
  });

  it('promotes existing user to admin when id is whitelisted', async () => {
    __pushDb(
      { telegramId: 40576673, username: 'x', role: 'user' },
      [{ telegramId: 40576673, username: 'x', role: 'admin' }],
    );
    const u = await getOrCreateUser(40576673, 'x');
    expect(u.role).toBe('admin');
  });
});

describe('lib/auth.js isAdmin / hasPermission', () => {
  it('isAdmin checks role', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(plain)).toBe(false);
  });

  it('hasPermission is true only for admin', () => {
    expect(hasPermission(admin, 'anything')).toBe(true);
    expect(hasPermission(plain, 'anything')).toBe(false);
  });
});
