import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../tgcloud/handlers/channel_post.js';
import { apiCalls, __onApi, __resetApi } from './mocks/sdk.js';
import { __pushDb, __resetDb } from './mocks/sdk-db.js';

beforeEach(() => {
  __resetDb();
  __resetApi();
});

function post(extra) {
  return { chat: { id: -100 }, message_id: 5, text: 'hi', ...extra };
}

describe('handlers/channel_post.js', () => {
  it('does nothing for an unknown channel', async () => {
    __pushDb(null);
    await handler(post({ left_chat_member: { id: 1 } }), {});
    expect(apiCalls).toHaveLength(0);
  });

  it('deletes a service message when the setting is on', async () => {
    __pushDb({ channelId: -100, deleteServiceMessages: true });
    await handler(post({ left_chat_member: { id: 1 } }), {});
    expect(apiCalls[0]).toEqual({ method: 'deleteMessage', params: { chat_id: -100, message_id: 5 } });
  });

  it('keeps a service message when the setting is off', async () => {
    __pushDb({ channelId: -100, deleteServiceMessages: false });
    await handler(post({ left_chat_member: { id: 1 } }), {});
    expect(apiCalls).toHaveLength(0);
  });

  it('keeps a regular post even with the setting on', async () => {
    __pushDb({ channelId: -100, deleteServiceMessages: true });
    await handler(post({}), {});
    expect(apiCalls.some((c) => c.method === 'deleteMessage')).toBe(false);
  });
});
