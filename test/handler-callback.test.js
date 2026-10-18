import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../tgcloud/handlers/callback_query.js';
import { apiCalls, __onApi, __resetApi, BotApiError } from './mocks/sdk.js';
import { __pushDb, __resetDb, dbCalls } from './mocks/sdk-db.js';

beforeEach(() => {
  __resetDb();
  __resetApi();
  __onApi((method) => (method === 'sendMessage' ? { message_id: 42 } : {}));
});

const adminUser = { telegramId: 40576673, username: 'kaparuz', role: 'admin' };
const plainUser = { telegramId: 999, username: 'user9', role: 'user' };

function cbq(data, { userId = 40576673, username = 'kaparuz' } = {}) {
  return {
    id: 'cbq-1',
    from: { id: userId, username },
    data,
    message: { chat: { id: 50 }, message_id: 7, text: 'DRAFT TEXT' },
  };
}

const lastAnswer = () => apiCalls.filter((c) => c.method === 'answerCallbackQuery').at(-1)?.params;
const valuesOf = (steps) => steps.find((s) => s.op === 'values')?.v;

describe('handlers/callback_query.js guards', () => {
  it('rejects unknown callback data', async () => {
    await handler(cbq('bogus'), {});
    expect(lastAnswer().text).toContain('Неизвестная команда');
    expect(lastAnswer().show_alert).toBe(true);
    expect(dbCalls).toHaveLength(0);
  });

  it('rejects missing callback data', async () => {
    await handler(cbq(undefined), {});
    expect(lastAnswer().text).toContain('Неизвестная команда');
  });

  it('denies non-admin users', async () => {
    __pushDb(plainUser);
    await handler(cbq('pub:2026-10-18', { userId: 999, username: 'user9' }), {});
    expect(lastAnswer().text).toContain('Только для админов');
  });

  it('reports when no channel is bound', async () => {
    __pushDb(adminUser, []);
    await handler(cbq('pub:2026-10-18'), {});
    expect(lastAnswer().text).toContain('Канал не привязан');
  });
});

describe('handlers/callback_query.js pub flow', () => {
  it('publishes draft text to the bound channel and records it', async () => {
    __pushDb(adminUser, [{ channelId: -1003747058496 }], null);
    await handler(cbq('pub:2026-10-18'), {});

    const sent = apiCalls.find((c) => c.method === 'sendMessage');
    expect(sent.params.chat_id).toBe(-1003747058496);
    expect(sent.params.text).toContain('DRAFT TEXT');

    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'daily_posts');
    expect(valuesOf(ins)).toMatchObject({ date: '2026-10-18', status: 'published', channelMessageId: 42 });

    expect(lastAnswer().text).toContain('Опубликовано');
    // buttons removed from the draft message
    expect(apiCalls.some((c) => c.method === 'editMessageText' && c.params.message_id === 7)).toBe(true);
  });

  it('escapes HTML chars in the published draft text', async () => {
    __pushDb(adminUser, [{ channelId: -100 }], null);
    const q = cbq('pub:2026-10-18');
    q.message.text = 'draft a<b&c';
    await handler(q, {});
    const sent = apiCalls.find((c) => c.method === 'sendMessage');
    expect(sent.params.text).toContain('draft a&lt;b&amp;c');
    expect(sent.params.parse_mode).toBe('HTML');
  });

  it('publishes a dated draft as header, escaped body, footer and tags', async () => {
    __pushDb(adminUser, [{ channelId: -100 }], null);
    const q = cbq('pub:2026-10-18');
    q.message.text = 'Что нового за 2026-10-18\n\nbody with <b>markup';
    await handler(q, {});
    const t = apiCalls.find((c) => c.method === 'sendMessage').params.text;
    expect(t).toContain('📝 <b>Что нового · 2026-10-18</b>');
    expect(t).toContain('body with &lt;b&gt;markup');
    expect(t).toContain('<i>🐱 ВайбКот · @devin_tips</i>');
    expect(t).toContain('#changelog #devin');
  });

  it('reports an API failure to the admin', async () => {
    __pushDb(adminUser, [{ channelId: -100 }], null);
    __onApi((method) => {
      if (method === 'sendMessage') throw new BotApiError('chat not found', { code: 400, method: 'sendMessage' });
      return {};
    });
    await handler(cbq('pub:2026-10-18'), {});
    expect(lastAnswer().text).toContain('Ошибка');
    expect(lastAnswer().text).toContain('chat not found');
    expect(dbCalls.some((s) => s[0].op === 'insert')).toBe(false);
  });
});

describe('handlers/callback_query.js rej flow', () => {
  it('records rejection and removes buttons', async () => {
    __pushDb(adminUser, [{ channelId: -100 }], null);
    await handler(cbq('rej:2026-10-18'), {});
    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'daily_posts');
    expect(valuesOf(ins)).toMatchObject({ date: '2026-10-18', status: 'rejected' });
    expect(lastAnswer().text).toContain('Отклонено');
    expect(apiCalls.some((c) => c.method === 'editMessageText')).toBe(true);
    expect(apiCalls.some((c) => c.method === 'sendMessage')).toBe(false);
  });
});

describe('handlers/callback_query.js idempotency', () => {
  it('says already published and strips buttons', async () => {
    __pushDb(adminUser, [{ channelId: -100 }], { status: 'published' });
    await handler(cbq('pub:2026-10-18'), {});
    expect(lastAnswer().text).toContain('Уже опубликовано');
    expect(apiCalls.some((c) => c.method === 'sendMessage' && c.params.chat_id === -100)).toBe(false);
    expect(apiCalls.some((c) => c.method === 'editMessageText')).toBe(true);
    expect(dbCalls.some((s) => s[0].op === 'insert')).toBe(false);
  });

  it('says already rejected', async () => {
    __pushDb(adminUser, [{ channelId: -100 }], { status: 'rejected' });
    await handler(cbq('pub:2026-10-18'), {});
    expect(lastAnswer().text).toContain('Уже отклонено');
  });
});
