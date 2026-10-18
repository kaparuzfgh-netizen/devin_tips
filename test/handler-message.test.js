import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../tgcloud/handlers/message.js';
import { apiCalls, __onApi, __resetApi } from './mocks/sdk.js';
import { __pushDb, __resetDb, dbCalls } from './mocks/sdk-db.js';

beforeEach(() => {
  __resetDb();
  __resetApi();
  __onApi((method) => (method === 'getMe' ? { username: 'devin_tips_bot' } : {}));
});

const adminUser = { telegramId: 40576673, username: 'kaparuz', role: 'admin' };
const plainUser = { telegramId: 999, username: 'user9', role: 'user' };

/** @param {string | undefined} text @param {any} [opts] */
function msg(text, { userId = 999, username = 'user9', chatId = 50, ...extra } = {}) {
  return {
    chat: { id: chatId },
    from: { id: userId, username },
    text,
    ...extra,
  };
}

const lastSend = () => apiCalls.filter((c) => c.method === 'sendMessage').at(-1)?.params;
const valuesOf = (steps) => steps.find((s) => s.op === 'values')?.v;

describe('handlers/message.js basics', () => {
  it('/start greets a regular user without admin section', async () => {
    __pushDb(plainUser);
    await handler(msg('/start'), {});
    expect(lastSend().text).toContain('Привет');
    expect(lastSend().text).not.toContain('Админ-команды');
  });

  it('/start shows admin commands to admin', async () => {
    __pushDb(adminUser);
    await handler(msg('/start', { userId: 40576673, username: 'kaparuz' }), {});
    expect(lastSend().text).toContain('Админ-команды');
  });

  it('/status replies via sendRichMessage with role', async () => {
    __pushDb(plainUser);
    await handler(msg('/status'), {});
    const p = lastSend();
    expect(p.parse_mode).toBe('HTML');
    expect(p.text).toContain('@devin_tips_bot');
    expect(p.text).toContain('user');
  });

  it('replies with the forwarded chat id', async () => {
    __pushDb(plainUser);
    await handler(msg(undefined, { forward_from_chat: { id: -100111, title: 'Ch' } }), {});
    expect(lastSend().text).toContain('-100111');
    expect(lastSend().text).toContain('Ch');
  });

  it('unknown command gets the fallback hint', async () => {
    __pushDb(plainUser);
    await handler(msg('/zzz'), {});
    expect(lastSend().text).toContain('Неизвестная команда');
  });

  it('plain text question about devin gets the canned answer', async () => {
    __pushDb(plainUser);
    await handler(msg('расскажи про devin'), {});
    expect(lastSend().text).toContain('Devin');
  });

  it('/start sends command names unescaped for a regular user', async () => {
    __pushDb(plainUser);
    await handler(msg('/start'), {});
    expect(lastSend().text).toContain('/get_channel_id');
    expect(lastSend().text).toContain('/my_channels');
    expect(lastSend().text).toContain('code [name]');
  });

  it('/start includes the admin command block for admins', async () => {
    __pushDb(adminUser);
    await handler(msg('/start', { userId: 40576673, username: 'kaparuz' }), {});
    const t = lastSend().text;
    for (const cmd of ['/publish_changelog', '/channel_config', '/boost_request', '/reaction_trigger', '/set_openai_key', '/ai_summary']) {
      expect(t).toContain(cmd);
    }
  });

  it('/help keeps command names readable and escapes placeholders', async () => {
    __pushDb(plainUser);
    await handler(msg('/help'), {});
    expect(lastSend().text).toContain('code_example');
    expect(lastSend().text).toContain('code [name]');
    expect(lastSend().text).toContain('&lt;вопрос&gt;');
  });

  // Regression lock: static texts go out as HTML now — underscores stay as-is
  // and every send must be parse_mode HTML (invalid markup is also caught by
  // the mock validator in test/setup.js). See KI-005/KI-006.
  it('static /start and /help texts are sent as HTML', async () => {
    for (const [cmd, user] of [['/start', plainUser], ['/start', adminUser], ['/help', plainUser]]) {
      __resetDb();
      __resetApi();
      __onApi((method) => (method === 'getMe' ? { username: 'devin_tips_bot' } : {}));
      __pushDb(user);
      await handler(msg(cmd, { userId: user.telegramId, username: user.username }), {});
      expect(lastSend().parse_mode).toBe('HTML');
      expect(lastSend().text).toContain('/help');
    }
  });
});

// Regression lock for KI-002 (audit B13): every admin-command branch used the
// `{ chat_id }` shorthand while the variable is `chatId` — ReferenceError killed
// all admin commands. Fixed by `chat_id: chatId`; these are ordinary tests now.
describe('handlers/message.js admin guard', () => {
  it.each(['/changelog feature: x', '/publish_changelog -100', '/channel_config k v', '/ai_summary', '/clean_daily_posts'])(
    '%s is denied for a regular user',
    async (cmd) => {
      __pushDb(plainUser);
      await handler(msg(cmd), {});
      expect(lastSend().text).toContain('Только для админов');
    },
  );

  it('/changelog happy path inserts an entry', async () => {
    __pushDb(adminUser, [{ id: 1 }]);
    await handler(msg('/changelog feature: новая штука', { userId: 40576673, username: 'kaparuz' }), {});
    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'changelog');
    expect(valuesOf(ins)).toMatchObject({ category: 'feature', changes: 'новая штука' });
    expect(lastSend().text).toContain('Запись добавлена');
  });

  it('/changelog rejects a bad category', async () => {
    __pushDb(adminUser);
    await handler(msg('/changelog bogus: x', { userId: 40576673, username: 'kaparuz' }), {});
    expect(lastSend().text).toContain('Неверная категория');
    expect(dbCalls.some((s) => s[0].op === 'insert')).toBe(false);
  });

  it('/clean_daily_posts deletes rows for admin', async () => {
    __pushDb(adminUser, { rowsAffected: 3 });
    await handler(msg('/clean_daily_posts', { userId: 40576673, username: 'kaparuz' }), {});
    expect(dbCalls.some((s) => s[0].op === 'delete' && s[0].table === 'daily_posts')).toBe(true);
    expect(lastSend().text).toContain('Удалено 3');
  });

  it('/clean_daily_posts keeps the table name readable', async () => {
    __pushDb(adminUser, { rowsAffected: 3 });
    await handler(msg('/clean_daily_posts', { userId: 40576673, username: 'kaparuz' }), {});
    expect(lastSend().text).toContain('daily_posts');
  });

  it('/channel_config usage message escapes placeholders', async () => {
    __pushDb(adminUser);
    await handler(msg('/channel_config', { userId: 40576673, username: 'kaparuz' }), {});
    expect(lastSend().text).toContain('channel_config');
    expect(lastSend().text).toContain('&lt;key&gt;');
  });

  it('/reaction_trigger usage message escapes placeholders', async () => {
    __pushDb(adminUser);
    await handler(msg('/reaction_trigger', { userId: 40576673, username: 'kaparuz' }), {});
    expect(lastSend().text).toContain('reaction_trigger');
    expect(lastSend().text).toContain('&lt;post_id&gt;');
  });

  it('/set_openai_key usage message keeps command and prefix readable', async () => {
    __pushDb(adminUser);
    await handler(msg('/set_openai_key', { userId: 40576673, username: 'kaparuz' }), {});
    expect(lastSend().text).toContain('set_openai_key');
    expect(lastSend().text).toContain('gsk_');
  });

  // BUG (see audit B7): /channel_config passes chatId — the admin's private
  // chat — as the channel id, so settings land on a bogus channel_settings row.
  // Expected: the command targets the configured channel, not the sender's DM.
  it.fails('/channel_config writes to the configured channel, not the admin DM', async () => {
    __pushDb(adminUser, { channelId: -100 }); // existing channel row
    await handler(msg('/channel_config deleteServiceMessages true', { userId: 40576673, username: 'kaparuz', chatId: 50 }), {});
    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'channel_settings');
    expect(valuesOf(ins)?.channelId).not.toBe(50);
    const upd = dbCalls.find((s) => s[0].op === 'update' && s[0].table === 'channel_settings');
    expect(upd).toBeTruthy();
  });
});

describe('handlers/message.js content commands', () => {
  it('/get_channel_id says none when DB is empty', async () => {
    __pushDb(plainUser, []);
    await handler(msg('/get_channel_id'), {});
    expect(lastSend().text).toContain('не найдены');
  });

  it('/get_channel_id lists saved channel ids', async () => {
    __pushDb(plainUser, [{ channelId: -1003747058496 }]);
    await handler(msg('/get_channel_id'), {});
    expect(lastSend().text).toContain('1003747058496');
  });

  it('/posts with empty DB says so', async () => {
    __pushDb(plainUser, []);
    await handler(msg('/posts'), {});
    expect(lastSend().text).toContain('нет опубликованных постов');
  });

  it('/code without args asks for a name', async () => {
    __pushDb(plainUser);
    await handler(msg('/code'), {});
    expect(lastSend().text).toContain('Укажи имя модуля');
  });

  it('/code reports a missing module', async () => {
    __pushDb(plainUser, null);
    await handler(msg('/code nope'), {});
    expect(lastSend().text).toContain('не найден');
  });

  it('/code keeps special chars readable in the requested module name', async () => {
    __pushDb(plainUser, null);
    await handler(msg('/code no_pe*x'), {});
    expect(lastSend().text).toContain('no_pe*x');
    expect(lastSend().parse_mode).toBe('HTML');
  });

  it('/ask without args asks for a question', async () => {
    __pushDb(plainUser);
    await handler(msg('/ask'), {});
    expect(lastSend().text).toContain('Укажи вопрос');
  });
});
