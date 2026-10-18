import { describe, it, expect, beforeEach } from 'vitest';
import { sendRichMessage, formatId, formatCode } from '../tgcloud/lib/message.js';
import { apiCalls, __resetApi } from './mocks/sdk.js';

beforeEach(__resetApi);

describe('lib/message.js', () => {
  it('formatId wraps value in backticks', () => {
    expect(formatId(40576673)).toBe('`40576673`');
  });

  it('formatCode without language', () => {
    expect(formatCode('x')).toBe('```\nx\n```');
  });

  it('formatCode with language', () => {
    expect(formatCode('const a = 1;', 'js')).toBe('```js\nconst a = 1;\n```');
  });

  it('sendRichMessage sends with Markdown parse_mode', async () => {
    await sendRichMessage(123, 'hi');
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0].method).toBe('sendMessage');
    expect(apiCalls[0].params).toMatchObject({
      chat_id: 123,
      text: 'hi',
      parse_mode: 'Markdown',
    });
  });

  it('sendRichMessage merges extra options', async () => {
    await sendRichMessage(1, 't', { reply_markup: { keyboard: [] } });
    expect(apiCalls[0].params.reply_markup).toEqual({ keyboard: [] });
    expect(apiCalls[0].params.chat_id).toBe(1);
  });
});
