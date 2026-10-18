import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../tgcloud/handlers/my_chat_member.js';
import { __pushDb, __resetDb, dbCalls } from './mocks/sdk-db.js';

beforeEach(__resetDb);

function upd(status, chatId = -1003747058496) {
  return {
    chat: { id: chatId },
    new_chat_member: { status, user: { id: 1, is_bot: true } },
  };
}

const valuesOf = (steps) => steps.find((s) => s.op === 'values')?.v;

describe('handlers/my_chat_member.js', () => {
  it('saves channel id when the bot becomes administrator', async () => {
    __pushDb(null);
    await handler(upd('administrator'), {});
    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'channel_settings');
    expect(valuesOf(ins)).toEqual({ channelId: -1003747058496 });
  });

  it('updates the row when channel already known', async () => {
    __pushDb({ channelId: -1003747058496 });
    await handler(upd('administrator'), {});
    expect(dbCalls.some((s) => s[0].op === 'update' && s[0].table === 'channel_settings')).toBe(true);
  });

  it('ignores non-admin status changes', async () => {
    for (const status of ['member', 'left', 'kicked', 'restricted']) {
      __resetDb();
      await handler(upd(status), {});
      expect(dbCalls, `status=${status}`).toHaveLength(0);
    }
  });
});
