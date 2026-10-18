import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateChangelogSummary,
  categorizeChange,
  setOpenaiApiKey,
} from '../tgcloud/lib/openai.js';
import { __onFetch, __resetFetch, fetchCalls } from './mocks/sdk.js';
import { __pushDb, __resetDb, dbCalls } from './mocks/sdk-db.js';

beforeEach(() => {
  __resetDb();
  __resetFetch();
});

const okJson = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });

describe('lib/openai.js generateChangelogSummary', () => {
  it('returns null when no API key stored', async () => {
    __pushDb(null);
    expect(await generateChangelogSummary('changes')).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  it('calls the API with bearer key and returns content', async () => {
    __pushDb({ openaiApiKey: 'k-test' });
    __onFetch(() => okJson({ choices: [{ message: { content: 'SUM' } }] }));
    const s = await generateChangelogSummary('changes');
    expect(s).toBe('SUM');
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].opts.headers.Authorization).toBe('Bearer k-test');
  });

  // BUG (see audit B1): the code calls api.openai.com but MODEL is
  // 'openai/gpt-oss-120b' — a Groq model id — while the project goal (and the
  // GROQ_API_KEY secret) is Groq. Expected: the Groq endpoint.
  it.fails('calls the Groq endpoint', async () => {
    __pushDb({ openaiApiKey: 'k-test' });
    __onFetch(() => okJson({ choices: [{ message: { content: 'x' } }] }));
    await generateChangelogSummary('changes');
    expect(fetchCalls[0].url).toContain('groq');
  });

  it('returns null on API error response', async () => {
    __pushDb({ openaiApiKey: 'k-test' });
    __onFetch(() => ({ ok: false, status: 500, text: async () => 'server error' }));
    expect(await generateChangelogSummary('x')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    __pushDb({ openaiApiKey: 'k-test' });
    __onFetch(() => { throw new Error('network'); });
    expect(await generateChangelogSummary('x')).toBeNull();
  });
});

describe('lib/openai.js categorizeChange', () => {
  it('returns trimmed lowercase category', async () => {
    __pushDb({ openaiApiKey: 'k' });
    __onFetch(() => okJson({ choices: [{ message: { content: ' Feature ' } }] }));
    expect(await categorizeChange('x')).toBe('feature');
  });

  it('returns null without API key', async () => {
    __pushDb(null);
    expect(await categorizeChange('x')).toBeNull();
  });
});

describe('lib/openai.js setOpenaiApiKey', () => {
  it('updates the existing settings row', async () => {
    __pushDb({ channelId: -100, openaiApiKey: 'old' });
    await setOpenaiApiKey('new-key');
    const upd = dbCalls.find((s) => s[0].op === 'update' && s[0].table === 'channel_settings');
    expect(upd.find((s) => s.op === 'set').v).toEqual({ openaiApiKey: 'new-key' });
  });

  // BUG (see audit B2): when no settings row exists the code inserts a row with
  // channelId: 1 — a fake channel that pollutes channel_settings. Expected: no
  // bogus row (e.g. refuse or require a real channel id).
  it.fails('does not insert a dummy channelId=1 row when settings are missing', async () => {
    __pushDb(null);
    await setOpenaiApiKey('new-key');
    const ins = dbCalls.find((s) => s[0].op === 'insert' && s[0].table === 'channel_settings');
    expect(ins?.find((s) => s.op === 'values')?.v?.channelId).not.toBe(1);
  });
});
