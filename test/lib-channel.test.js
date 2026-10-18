import { describe, it, expect, beforeEach } from 'vitest';
import {
  deleteServiceMessage,
  getChannelInfo,
  sendBoostRequest,
  setChannelSetting,
  createReactionTrigger,
  checkReactionTriggers,
} from '../tgcloud/lib/channel.js';
import { apiCalls, __onApi, __resetApi } from './mocks/sdk.js';
import { __pushDb, __resetDb, dbCalls } from './mocks/sdk-db.js';

beforeEach(() => {
  __resetDb();
  __resetApi();
});

const valuesOf = (steps) => steps.find((s) => s.op === 'values')?.v;
const setOf = (steps) => steps.find((s) => s.op === 'set')?.v;

describe('lib/channel.js deleteServiceMessage', () => {
  it('calls api.deleteMessage with chat and message ids', async () => {
    await deleteServiceMessage(-100, 42);
    expect(apiCalls[0]).toEqual({ method: 'deleteMessage', params: { chat_id: -100, message_id: 42 } });
  });

  it('swallows API errors', async () => {
    __onApi(() => { throw new Error('boom'); });
    await expect(deleteServiceMessage(-100, 42)).resolves.toBeUndefined();
  });
});

describe('lib/channel.js getChannelInfo / sendBoostRequest', () => {
  it('getChannelInfo returns chat and boosts', async () => {
    __onApi((method) => (method === 'getChat' ? { id: -100, boost_level: 2 } : { boosts: [] }));
    const info = await getChannelInfo(-100);
    expect(info.chat.boost_level).toBe(2);
    expect(apiCalls.map((c) => c.method)).toEqual(['getChat', 'getChatBoosts']);
  });

  it('sendBoostRequest posts message when below target', async () => {
    __onApi((method) => (method === 'getChat' ? { id: -100, boost_level: 1 } : { boosts: [] }));
    const r = await sendBoostRequest(-100, 3);
    expect(r.success).toBe(true);
    expect(r.needed).toBe(2);
    const sent = apiCalls.find((c) => c.method === 'sendMessage');
    expect(sent.params.chat_id).toBe(-100);
    expect(sent.params.text).toContain('уровня 3');
  });

  it('sendBoostRequest reports when level already reached', async () => {
    __onApi((method) => (method === 'getChat' ? { id: -100, boost_level: 5 } : { boosts: [] }));
    const r = await sendBoostRequest(-100, 3);
    expect(r.success).toBe(false);
    expect(r.message).toContain('уже достигнут');
    expect(apiCalls.some((c) => c.method === 'sendMessage')).toBe(false);
  });
});

describe('lib/channel.js setChannelSetting', () => {
  it('updates existing settings row', async () => {
    __pushDb({ channelId: -100, deleteServiceMessages: false });
    await setChannelSetting(-100, 'deleteServiceMessages', true);
    const upd = dbCalls.find((s) => s[0].op === 'update' && s[0].table === 'channel_settings');
    expect(upd).toBeTruthy();
    expect(setOf(upd).deleteServiceMessages).toBe(true);
    expect(dbCalls.some((s) => s[0].op === 'insert')).toBe(false);
  });

  it('inserts a new row when none exists', async () => {
    __pushDb(null);
    await setChannelSetting(-100, 'targetBoostLevel', '3');
    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'channel_settings');
    expect(valuesOf(ins)).toMatchObject({ channelId: -100, targetBoostLevel: '3' });
  });
});

describe('lib/channel.js reaction triggers', () => {
  it('createReactionTrigger inserts and returns the row', async () => {
    __pushDb([{ id: 9 }]);
    const t = await createReactionTrigger(777, -100, 5, 'send_message', '{"message":"x"}');
    expect(t.id).toBe(9);
    const v = valuesOf(dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'reaction_triggers'));
    expect(v).toMatchObject({ postId: 777, channelId: -100, requiredReactions: 5, action: 'send_message' });
  });

  it('fires action when reaction count reaches the threshold', async () => {
    __pushDb([{ id: 1, postId: 777, channelId: -100, requiredReactions: 5, action: 'send_message', actionData: '{"message":"Boom"}', triggered: false }]);
    __onApi((method) => (method === 'getMessageReactionCount' ? { total_reaction_count: 6 } : {}));
    await checkReactionTriggers(-100, 777);
    const sent = apiCalls.find((c) => c.method === 'sendMessage');
    expect(sent.params.text).toBe('Boom');
    const upd = dbCalls.find((s) => s[0].op === 'update' && s[0].table === 'reaction_triggers');
    expect(setOf(upd)).toEqual({ triggered: true });
  });

  it('does nothing when below the threshold', async () => {
    __pushDb([{ id: 1, postId: 777, channelId: -100, requiredReactions: 5, action: 'send_message', triggered: false }]);
    __onApi((method) => (method === 'getMessageReactionCount' ? { total_reaction_count: 4 } : {}));
    await checkReactionTriggers(-100, 777);
    expect(apiCalls.some((c) => c.method === 'sendMessage')).toBe(false);
    expect(dbCalls.some((s) => s[0].op === 'update')).toBe(false);
  });

  it('skips already triggered rows', async () => {
    __pushDb([{ id: 1, postId: 777, channelId: -100, requiredReactions: 1, action: 'send_message', triggered: true }]);
    __onApi(() => ({}));
    await checkReactionTriggers(-100, 777);
    expect(apiCalls).toHaveLength(0);
  });

  // BUG (see audit B11): checkReactionTriggers ignores trigger.postId — any
  // message's reaction update is checked against every trigger in the channel,
  // so a trigger for post A fires on unrelated post B. Expected: only the
  // trigger's own post should be evaluated.
  it.fails('does not fire a trigger for a different post', async () => {
    __pushDb([{ id: 1, postId: 777, channelId: -100, requiredReactions: 1, action: 'send_message', triggered: false }]);
    __onApi(() => ({ total_reaction_count: 100 }));
    await checkReactionTriggers(-100, 999); // update is for message 999, trigger is for 777
    expect(apiCalls.some((c) => c.method === 'sendMessage')).toBe(false);
  });
});
