import { describe, it, expect, beforeEach } from 'vitest';
import { sendRichMessage, escapeMd, formatId, formatCode } from '../tgcloud/lib/message.js';
import { html, b, raw } from '../tgcloud/lib/format.js';
import { apiCalls, __onApi, __resetApi, BotApiError } from './mocks/sdk.js';

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

  it('sendRichMessage returns the sendMessage result', async () => {
    __onApi(() => ({ message_id: 7 }));
    const r = await sendRichMessage(1, 't');
    expect(r).toEqual({ message_id: 7 });
  });

  it('sendRichMessage retries without parse_mode on 400 parse entities', async () => {
    let calls = 0;
    __onApi(() => {
      calls += 1;
      if (calls === 1) throw new BotApiError("Bad Request: can't parse entities", { code: 400 });
      return { message_id: 9 };
    });
    const r = await sendRichMessage(1, 'a_b*c');
    expect(r).toEqual({ message_id: 9 });
    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0].params.parse_mode).toBe('Markdown');
    expect(apiCalls[0].params.text).toBe('a_b*c');
    expect(apiCalls[1].params.parse_mode).toBeUndefined();
    expect(apiCalls[1].params.text).toBe('a_b*c');
    expect(apiCalls[1].params.chat_id).toBe(1);
  });

  it('sendRichMessage keeps extra options on the plain-text retry', async () => {
    let calls = 0;
    __onApi(() => {
      calls += 1;
      if (calls === 1) throw new BotApiError("can't parse entities", { code: 400 });
      return {};
    });
    await sendRichMessage(1, 't', { reply_markup: { keyboard: [] } });
    expect(apiCalls[1].params.reply_markup).toEqual({ keyboard: [] });
    expect(apiCalls[1].params.parse_mode).toBeUndefined();
  });

  it('sendRichMessage does not retry on other 400 errors', async () => {
    __onApi(() => { throw new BotApiError('chat not found', { code: 400 }); });
    await expect(sendRichMessage(1, 'a_b')).rejects.toThrow('chat not found');
    expect(apiCalls).toHaveLength(1);
  });

  it('sendRichMessage does not retry on non-400 codes', async () => {
    __onApi(() => { throw new BotApiError("can't parse entities", { code: 403 }); });
    await expect(sendRichMessage(1, 'a_b')).rejects.toThrow("can't parse entities");
    expect(apiCalls).toHaveLength(1);
  });

  it('sendRichMessage rethrows when the retry also fails', async () => {
    __onApi(() => { throw new BotApiError("can't parse entities", { code: 400 }); });
    await expect(sendRichMessage(1, 'a_b')).rejects.toThrow("can't parse entities");
    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[1].params.parse_mode).toBeUndefined();
  });

  it('sendRichMessage sends Html content with parse_mode HTML', async () => {
    await sendRichMessage(1, html`hi ${b('there')}`);
    expect(apiCalls).toHaveLength(1);
    expect(apiCalls[0].params).toMatchObject({
      chat_id: 1,
      text: 'hi <b>there</b>',
      parse_mode: 'HTML',
    });
  });

  it('sendRichMessage retries Html content with stripped plain text on 400 parse entities', async () => {
    let calls = 0;
    __onApi(() => {
      calls += 1;
      if (calls === 1) throw new BotApiError("can't parse entities", { code: 400 });
      return { message_id: 3 };
    });
    const r = await sendRichMessage(1, html`hi ${b('there')} &lt;x&gt;`);
    expect(r).toEqual({ message_id: 3 });
    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0].params.parse_mode).toBe('HTML');
    expect(apiCalls[1].params.parse_mode).toBeUndefined();
    expect(apiCalls[1].params.text).toBe('hi there <x>');
  });

  it('mock marks invalidHtml and rejects invalid HTML with 400', async () => {
    await sendRichMessage(1, raw('<b>oops')); // fallback recovers the send
    expect(apiCalls[0].invalidHtml).toBe(true);
    expect(apiCalls[1].params.parse_mode).toBeUndefined();
    __resetApi(); // intentional violation: clear the flag before the setup guard
  });
});

describe('escapeMd', () => {
  it('escapes each of the four Markdown special chars', () => {
    expect(escapeMd('a_b*c`d[e')).toBe('a\\_b\\*c\\`d\\[e');
  });

  it('handles null, undefined and numbers', () => {
    expect(escapeMd(null)).toBe('');
    expect(escapeMd(undefined)).toBe('');
    expect(escapeMd(42)).toBe('42');
  });

  it('leaves other characters untouched', () => {
    expect(escapeMd('a-b.c)d]e{f}/g')).toBe('a-b.c)d]e{f}/g');
    expect(escapeMd('')).toBe('');
  });
});
