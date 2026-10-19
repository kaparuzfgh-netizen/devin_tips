import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// scripts/daily-changelog.js is a plain Node script, not a module: it reads
// process.env at load time and runs main() at the bottom. To test it without
// touching production code, we load the source into a Function scope with
// injected process/fetch/console, strip the auto-run line, and grab the
// internals it returns.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = readFileSync(resolve(root, 'scripts/daily-changelog.js'), 'utf8')
  .replace(/^#!.*\n/, '');

function loadScript(env = {}, fetchImpl, exitImpl) {
  const proc = { env, exit: exitImpl || (() => { throw new Error('process.exit called'); }) };
  const cons = { log() {}, error() {}, warn() {}, info() {} };
  const factory = new Function(
    'process', 'fetch', 'console',
    `${SRC.replace(/main\(\);\s*$/, '')}
     return { getDateWindow, filterCommits, generateChangelog, sendTelegramDraft, main };`,
  );
  return factory(proc, fetchImpl, cons);
}

const ENV = {
  GITHUB_REPOSITORY: 'owner/repo',
  GITHUB_TOKEN: 'ght',
  TELEGRAM_BOT_TOKEN: 'tgt',
  ADMIN_CHAT_ID: '12345',
};

const commit = (message, parents = [1]) => ({ commit: { message }, parents });
const okJson = (data) => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });

describe('daily-changelog.js getDateWindow', () => {
  it('manual run: input date D spans [D-1 16:00Z, D 16:00Z)', () => {
    const { getDateWindow } = loadScript(ENV);
    const { start, end, targetDate } = getDateWindow('2026-10-15');
    expect(start.toISOString()).toBe('2026-10-14T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-15T16:00:00.000Z');
    expect(targetDate.toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('scheduled run: window ends at the most recent 16:00 UTC boundary', () => {
    const { getDateWindow } = loadScript(ENV);
    const { start, end } = getDateWindow(undefined, new Date('2026-10-19T16:17:00Z'));
    expect(start.getUTCHours()).toBe(16);
    expect(end.getUTCHours()).toBe(16);
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
  });

  it('scheduled run at D 16:17Z covers the last 24h and labels the draft D', () => {
    const { getDateWindow } = loadScript(ENV);
    const { start, end, targetDate } = getDateWindow(undefined, new Date('2026-10-19T16:17:00Z'));
    expect(start.toISOString()).toBe('2026-10-18T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-19T16:00:00.000Z');
    expect(targetDate.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('scheduled run at D 15:59Z still belongs to day D-1', () => {
    const { getDateWindow } = loadScript(ENV);
    const { start, end, targetDate } = getDateWindow(undefined, new Date('2026-10-19T15:59:00Z'));
    expect(start.toISOString()).toBe('2026-10-17T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-18T16:00:00.000Z');
    expect(targetDate.toISOString()).toBe('2026-10-18T00:00:00.000Z');
  });

  it('scheduled run exactly at D 16:00:00Z ends at that boundary', () => {
    const { getDateWindow } = loadScript(ENV);
    const { start, end, targetDate } = getDateWindow(undefined, new Date('2026-10-19T16:00:00.000Z'));
    expect(end.toISOString()).toBe('2026-10-19T16:00:00.000Z');
    expect(start.toISOString()).toBe('2026-10-18T16:00:00.000Z');
    expect(targetDate.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('manual run for 2026-10-19 reproduces the scheduled draft of that day', () => {
    const { getDateWindow } = loadScript(ENV);
    const { start, end, targetDate } = getDateWindow('2026-10-19');
    expect(start.toISOString()).toBe('2026-10-18T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-19T16:00:00.000Z');
    expect(targetDate.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('crosses a month boundary: scheduled run at 2026-11-01T16:17Z', () => {
    const { getDateWindow } = loadScript(ENV);
    const { start, end, targetDate } = getDateWindow(undefined, new Date('2026-11-01T16:17:00Z'));
    expect(start.toISOString()).toBe('2026-10-31T16:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T16:00:00.000Z');
    expect(targetDate.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('crosses a year boundary: manual run for 2027-01-01', () => {
    const { getDateWindow } = loadScript(ENV);
    const { start, end, targetDate } = getDateWindow('2027-01-01');
    expect(start.toISOString()).toBe('2026-12-31T16:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T16:00:00.000Z');
    expect(targetDate.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('daily-changelog.js filterCommits', () => {
  const { filterCommits } = loadScript(ENV);

  it('drops merge commits', () => {
    expect(filterCommits([commit('merge', [1, 2])])).toHaveLength(0);
  });

  it.each(['docs: readme', 'chore: bump', 'feat: x [skip changelog]'])(
    'drops %s',
    (message) => {
      expect(filterCommits([commit(message)])).toHaveLength(0);
    },
  );

  it('keeps feature and fix commits', () => {
    const kept = filterCommits([commit('feat: a'), commit('fix: b'), commit('docs: c')]);
    expect(kept).toHaveLength(2);
  });
});

describe('daily-changelog.js generateChangelog', () => {
  const { generateChangelog } = loadScript(ENV);

  it('returns null for an empty list', () => {
    expect(generateChangelog([], '2026-10-18', false)).toBeNull();
  });

  it('builds a dated list of first lines', () => {
    const text = generateChangelog([commit('feat: A\n\nbody'), commit('fix: B')], '2026-10-18', false);
    expect(text).toBe('Что нового за 2026-10-18\n\n— feat: A\n— fix: B');
  });

  it('adds [ТЕСТ] prefix in test mode', () => {
    expect(generateChangelog([commit('x')], 'd', true)).toContain('[ТЕСТ]');
  });

  it('truncates long changelogs with a remainder note', () => {
    const many = Array.from({ length: 200 }, (_, i) => commit(`feat: change ${i} ${'x'.repeat(50)}`));
    const text = generateChangelog(many, '2026-10-18', false);
    expect(text.length).toBeLessThanOrEqual(3600);
    expect(text).toContain('и ещё');
    expect(text).toContain('изменений');
  });
});

describe('daily-changelog.js sendTelegramDraft', () => {
  it('posts one message with pub/rej inline buttons', async () => {
    const calls = [];
    const { sendTelegramDraft } = loadScript(ENV, async (url, opts) => {
      calls.push({ url, opts });
      return okJson({ ok: true });
    });
    await sendTelegramDraft('2026-10-18', 'draft text');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.telegram.org/bottgt/sendMessage');
    const body = JSON.parse(calls[0].opts.body);
    expect(body.chat_id).toBe('12345');
    expect(body.text).toBe('draft text');
    expect(body.reply_markup.inline_keyboard[0].map((b) => b.callback_data)).toEqual([
      'pub:2026-10-18',
      'rej:2026-10-18',
    ]);
  });

  it('throws with the API error description on failure', async () => {
    const { sendTelegramDraft } = loadScript(ENV, async () => ({
      ok: false,
      json: async () => ({ code: 400, description: 'chat not found' }),
    }));
    await expect(sendTelegramDraft('d', 't')).rejects.toThrow('Telegram API error: 400 - chat not found');
  });
});

describe('daily-changelog.js main flow', () => {
  it('fetches commits and sends the draft', async () => {
    const calls = [];
    const { main } = loadScript(ENV, async (url) => {
      calls.push(url);
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      return okJson({});
    });
    await main();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('api.github.com/repos/owner/repo/commits');
    expect(calls[1]).toContain('api.telegram.org');
  });

  it('sends nothing when the day is empty', async () => {
    const calls = [];
    const { main } = loadScript(ENV, async (url) => {
      calls.push(url);
      return okJson([]);
    });
    await main();
    expect(calls).toHaveLength(1); // GitHub only, no Telegram call
  });

  it('exits with code 1 when env vars are missing', () => {
    let exitCode = null;
    // the env check runs at module load, so loadScript itself throws
    expect(() =>
      loadScript({}, async () => okJson([]), (c) => { exitCode = c; throw new Error('exit'); }),
    ).toThrow('exit');
    expect(exitCode).toBe(1);
  });

  // NOTE (audit B9): INPUT_SIMULATE_AI_FAILURE is read but never used — the
  // workflow input is dead. This test pins that today's behaviour is identical
  // with and without the flag; flip to a real simulation test when wired up.
  it('labels the draft text and buttons with the window target date', async () => {
    const bodies = [];
    const urls = [];
    const env = { ...ENV, INPUT_DATE: '2026-10-19' };
    const { main } = loadScript(env, async (url, opts) => {
      urls.push(url);
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      bodies.push(JSON.parse(opts.body));
      return okJson({});
    });
    await main();
    expect(urls[0]).toContain('since=2026-10-18T16:00:00.000Z');
    expect(urls[0]).toContain('until=2026-10-19T16:00:00.000Z');
    expect(bodies[0].text).toContain('Что нового за 2026-10-19');
    expect(bodies[0].reply_markup.inline_keyboard[0].map((b) => b.callback_data)).toEqual([
      'pub:2026-10-19',
      'rej:2026-10-19',
    ]);
  });

  it('behaves identically with simulate_ai_failure input', async () => {
    const calls = [];
    const env = { ...ENV, INPUT_SIMULATE_AI_FAILURE: 'true' };
    const { main } = loadScript(env, async (url) => {
      calls.push(url);
      return okJson(url.includes('github') ? [commit('feat: x')] : {});
    });
    await main();
    expect(calls).toHaveLength(2);
  });
});
