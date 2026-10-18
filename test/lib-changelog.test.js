import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../tgcloud/lib/openai.js', () => ({
  generateChangelogSummary: vi.fn(async () => 'AI-SUMMARY'),
  categorizeChange: vi.fn(async () => 'feature'),
  setOpenaiApiKey: vi.fn(async () => {}),
}));

import {
  addChangelogEntry,
  getChangelog,
  publishChangelog,
  autoPublishChangelog,
  generateDailySummary,
} from '../tgcloud/lib/changelog.js';
import { generateChangelogSummary } from '../tgcloud/lib/openai.js';
import { apiCalls, __resetApi } from './mocks/sdk.js';
import { __pushDb, __resetDb, dbCalls } from './mocks/sdk-db.js';

beforeEach(() => {
  __resetDb();
  __resetApi();
  vi.clearAllMocks();
});

describe('lib/changelog.js', () => {
  it('addChangelogEntry inserts with today date', async () => {
    __pushDb([{ id: 1, date: 'x' }]);
    const e = await addChangelogEntry('feature', 'did a thing');
    const v = dbCalls[0].find((s) => s.op === 'values').v;
    expect(v.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(v.category).toBe('feature');
    expect(v.changes).toBe('did a thing');
  });

  it('getChangelog without date returns all entries ordered', async () => {
    __pushDb([{ id: 1 }, { id: 2 }]);
    const rows = await getChangelog();
    expect(rows).toHaveLength(2);
    expect(dbCalls[0].some((s) => s.op === 'orderBy')).toBe(true);
    expect(dbCalls[0].some((s) => s.op === 'where')).toBe(false);
  });

  // BUG (see audit B12): getChangelog(date) uses .get() — it returns a single
  // row even though several changelog entries share the same date.
  it.fails('getChangelog(date) returns all entries of that date', async () => {
    __pushDb({ id: 1 }); // what .get() actually yields: one row, not a list
    const rows = await getChangelog('2026-10-18');
    expect(Array.isArray(rows)).toBe(true);
  });

  it('publishChangelog with nothing pending reports failure', async () => {
    __pushDb([]);
    const r = await publishChangelog(-100);
    expect(r).toEqual({ success: false, message: 'Нет изменений для публикации' });
    expect(apiCalls).toHaveLength(0);
  });

  it('publishChangelog posts grouped text and marks entries published', async () => {
    __pushDb([
      { id: 1, date: '2026-10-18', category: 'feature', changes: 'A', published: false },
      { id: 2, date: '2026-10-18', category: 'fix', changes: 'B', published: false },
    ]);
    const r = await publishChangelog(-100);
    expect(r).toEqual({ success: true, published: 2 });
    const sent = apiCalls.find((c) => c.method === 'sendMessage');
    expect(sent.params.chat_id).toBe(-100);
    expect(sent.params.text).toContain('📝 Changelog');
    expect(sent.params.text).toContain('2026-10-18');
    expect(sent.params.text).toContain('• A');
    const updates = dbCalls.filter((s) => s[0].op === 'update' && s[0].table === 'changelog');
    expect(updates).toHaveLength(2);
  });

  it('autoPublishChangelog publishes to each configured changelogChannelId', async () => {
    __pushDb(
      [{ channelId: -100, changelogChannelId: -200 }],
      [{ id: 1, date: '2026-10-18', category: 'fix', changes: 'B', published: false }],
    );
    await autoPublishChangelog();
    const sent = apiCalls.find((c) => c.method === 'sendMessage');
    expect(sent.params.chat_id).toBe(-200);
  });

  it('autoPublishChangelog skips settings without changelogChannelId', async () => {
    __pushDb([{ channelId: -100, changelogChannelId: null }]);
    await autoPublishChangelog();
    expect(apiCalls).toHaveLength(0);
  });

  it('generateDailySummary returns null with no entries today', async () => {
    __pushDb([]);
    expect(await generateDailySummary()).toBeNull();
    expect(generateChangelogSummary).not.toHaveBeenCalled();
  });

  it('generateDailySummary passes joined changes to AI', async () => {
    __pushDb([{ changes: 'one' }, { changes: 'two' }]);
    const s = await generateDailySummary();
    expect(s).toBe('AI-SUMMARY');
    expect(generateChangelogSummary).toHaveBeenCalledWith('one\ntwo');
  });
});
