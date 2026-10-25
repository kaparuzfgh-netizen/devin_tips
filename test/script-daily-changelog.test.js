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
     return { getDateWindow, filterCommits, parseCommit, buildAiLines, generateChangelog, generateAiBody, sendTelegramDraft, sendTelegramMessage, main };`,
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

  // NOTE (B9, fixed with T5): INPUT_SIMULATE_AI_FAILURE now skips the Groq call.
  // Without GROQ_API_KEY the behaviour is identical with and without the flag.
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

// Same loader as loadScript, but with a console that records calls — needed to
// assert the Groq key never reaches the logs.
function loadScriptCapturingConsole(env, fetchImpl) {
  const logs = [];
  const errors = [];
  const proc = { env, exit: () => { throw new Error('process.exit called'); } };
  const cons = {
    log: (...args) => logs.push(args.join(' ')),
    error: (...args) => errors.push(args.join(' ')),
    warn() {}, info() {},
  };
  const factory = new Function(
    'process', 'fetch', 'console',
    `${SRC.replace(/main\(\);\s*$/, '')}
     return { getDateWindow, filterCommits, parseCommit, buildAiLines, generateChangelog, generateAiBody, sendTelegramDraft, sendTelegramMessage, main };`,
  );
  return { ...factory(proc, fetchImpl, cons), logs, errors };
}

describe('daily-changelog.js Groq AI draft (T5)', () => {
  const GROQ_KEY = 'groq-secret-for-test';
  const AI_ENV = { ...ENV, GROQ_API_KEY: GROQ_KEY, INPUT_DATE: '2026-10-19' };
  const GROQ_OK_BODY = { choices: [{ message: { content: '— Добавили X' } }] };
  const FALLBACK_TEXT = 'Что нового за 2026-10-19\n\n— feat: x';

  it('uses the Groq text when the API responds 200', async () => {
    const calls = [];
    const { main } = loadScript(AI_ENV, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      if (url.includes('api.groq.com')) return okJson(GROQ_OK_BODY);
      return okJson({ ok: true });
    });
    await main();
    expect(calls).toHaveLength(3);
    expect(calls[0].url).toContain('api.github.com');
    expect(calls[1].url).toContain('api.groq.com');
    expect(calls[1].opts.headers.Authorization).toBe(`Bearer ${GROQ_KEY}`);
    expect(calls[2].url).toContain('api.telegram.org');
    const body = JSON.parse(calls[2].opts.body);
    expect(body.text).toContain('Что нового за 2026-10-19');
    expect(body.text).toContain('— Добавили X');
  });

  it('falls back to the plain commit list when Groq returns !ok', async () => {
    const calls = [];
    const { main } = loadScript(AI_ENV, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      if (url.includes('api.groq.com')) {
        return { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) };
      }
      return okJson({ ok: true });
    });
    await main();
    expect(calls).toHaveLength(3);
    const body = JSON.parse(calls[2].opts.body);
    expect(body.text).toBe(FALLBACK_TEXT);
  });

  it('falls back to the plain commit list when the Groq fetch throws', async () => {
    const calls = [];
    const { main } = loadScript(AI_ENV, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      if (url.includes('api.groq.com')) throw new Error('network down');
      return okJson({ ok: true });
    });
    await main();
    expect(calls).toHaveLength(3);
    const body = JSON.parse(calls[2].opts.body);
    expect(body.text).toBe(FALLBACK_TEXT);
  });

  it('falls back to the plain commit list when Groq returns empty content', async () => {
    const calls = [];
    const { main } = loadScript(AI_ENV, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      if (url.includes('api.groq.com')) {
        return okJson({ choices: [{ message: { content: '   ' } }] });
      }
      return okJson({ ok: true });
    });
    await main();
    expect(calls).toHaveLength(3);
    const body = JSON.parse(calls[2].opts.body);
    expect(body.text).toBe(FALLBACK_TEXT);
  });

  it('does not call Groq when simulate_ai_failure is set', async () => {
    const calls = [];
    const env = { ...AI_ENV, INPUT_SIMULATE_AI_FAILURE: 'true' };
    const { main } = loadScript(env, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      return okJson({ ok: true });
    });
    await main();
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => !c.url.includes('api.groq.com'))).toBe(true);
    const body = JSON.parse(calls[1].opts.body);
    expect(body.text).toBe(FALLBACK_TEXT);
  });

  it('keeps the [ТЕСТ] prefix on the AI draft in test mode', async () => {
    const calls = [];
    const env = { ...AI_ENV, INPUT_TEST: 'true' };
    const { main } = loadScript(env, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      if (url.includes('api.groq.com')) return okJson(GROQ_OK_BODY);
      return okJson({ ok: true });
    });
    await main();
    const body = JSON.parse(calls[2].opts.body);
    expect(body.text.startsWith('[ТЕСТ] Что нового за')).toBe(true);
  });

  it('never leaks the Groq key into the Telegram body or console output', async () => {
    const calls = [];
    const { main, logs, errors } = loadScriptCapturingConsole(AI_ENV, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.github.com')) return okJson([commit('feat: x')]);
      if (url.includes('api.groq.com')) {
        return { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) };
      }
      return okJson({ ok: true });
    });
    await main();
    const telegramBody = calls.find((c) => c.url.includes('api.telegram.org')).opts.body;
    expect(telegramBody).not.toContain(GROQ_KEY);
    for (const line of [...logs, ...errors]) {
      expect(line).not.toContain(GROQ_KEY);
    }
  });
});

describe('daily-changelog.js parseCommit (KI-008)', () => {
  const { parseCommit } = loadScript(ENV);

  it.each([
    ['feat: добавили кнопку', 'Новое'],
    ['fix: починили кнопку', 'Исправлено'],
    ['docs: поправили readme', 'Прочее'],
    ['просто строка без типа', 'Прочее'],
  ])('maps %s to kind %s', (message, kind) => {
    expect(parseCommit(message).kind).toBe(kind);
  });

  it('keeps the whole first line as text when there is no type', () => {
    expect(parseCommit('просто строка без типа').text).toBe('просто строка без типа');
  });

  it.each([
    ['fix: escape (static) chars (KI-005)', 'escape (static) chars'],
    ['feat: перенос на новую схему changelog (Z1-Z3)', 'перенос на новую схему changelog'],
    ['feat: X (T5 + D5)', 'X'],
    ['fix: Y (B14, KI-004)', 'Y'],
  ])('strips trailing task ids from %s', (message, text) => {
    expect(parseCommit(message).text).toBe(text);
  });

  it('does not strip a trailing parenthesis without digits', () => {
    expect(parseCommit('fix: escape chars (static)').text).toBe('escape chars (static)');
  });

  it('lets a Changelog: trailer override the first line and still strips ids', () => {
    const parsed = parseCommit('feat: X (T5)\n\nChangelog: добавлена кнопка (T9)');
    expect(parsed.kind).toBe('Новое');
    expect(parsed.text).toBe('добавлена кнопка');
  });

  it('drops the scope from the description: feat(web): x', () => {
    const parsed = parseCommit('feat(web): x');
    expect(parsed.kind).toBe('Новое');
    expect(parsed.text).toBe('x');
  });
});

describe('daily-changelog.js Groq request body (KI-008)', () => {
  const GROQ_KEY = 'groq-secret-for-test';
  const AI_ENV = { ...ENV, GROQ_API_KEY: GROQ_KEY, INPUT_DATE: '2026-10-19' };

  it('sends parsed [kind] text to Groq, not the raw first line', async () => {
    const calls = [];
    const { generateAiBody } = loadScript(AI_ENV, async (url, opts) => {
      calls.push({ url, opts });
      return okJson({ choices: [{ message: { content: '— Добавили X' } }] });
    });
    await generateAiBody([commit('feat: Groq-текст черновика с запасным списком (T5)')], '2026-10-19');
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].opts.body);
    expect(body.messages[1].content).toContain('[Новое] Groq-текст черновика с запасным списком');
    expect(body.messages[1].content).not.toContain('T5');
    expect(body.messages[1].content).not.toContain('feat:');
    expect(body.messages[0].content).toContain('Не придумывай названия моделей');
  });
});

describe('daily-changelog.js prompt sandbox (INPUT_PROMPT_TEXT)', () => {
  const GROQ_KEY = 'groq-secret-for-test';
  const SANDBOX_ENV = {
    ...ENV,
    GROQ_API_KEY: GROQ_KEY,
    INPUT_PROMPT_TEXT: 'feat: A (T1)||fix: B',
  };
  const GROQ_OK_BODY = { choices: [{ message: { content: '— Добавили X' } }] };

  it('skips GitHub, calls Groq once, sends one plain message', async () => {
    const calls = [];
    const { main } = loadScript(SANDBOX_ENV, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.groq.com')) return okJson(GROQ_OK_BODY);
      return okJson({ ok: true });
    });
    await main();
    expect(calls.filter((c) => c.url.includes('api.github.com'))).toHaveLength(0);
    expect(calls.filter((c) => c.url.includes('api.groq.com'))).toHaveLength(1);
    const telegram = calls.filter((c) => c.url.includes('api.telegram.org'));
    expect(telegram).toHaveLength(1);
    expect(telegram[0].url).toContain('sendMessage');
    const body = JSON.parse(telegram[0].opts.body);
    expect(body.reply_markup).toBeUndefined();
    expect(body.text).toContain('Песочница промпта');
    expect(body.text).toContain('[Новое] A');
    expect(body.text).toContain('[Исправлено] B');
    expect(body.text).toContain('— Добавили X');
  });

  it('reports that the AI did not answer when Groq returns !ok', async () => {
    const calls = [];
    const { main } = loadScript(SANDBOX_ENV, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.groq.com')) {
        return { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) };
      }
      return okJson({ ok: true });
    });
    await main();
    const telegram = calls.filter((c) => c.url.includes('api.telegram.org'));
    expect(telegram).toHaveLength(1);
    const body = JSON.parse(telegram[0].opts.body);
    expect(body.text).toContain('ИИ не ответил');
  });

  it('never leaks the Groq key into the Telegram body or console output', async () => {
    const calls = [];
    const { main, logs, errors } = loadScriptCapturingConsole(SANDBOX_ENV, async (url, opts) => {
      calls.push({ url, opts });
      if (url.includes('api.groq.com')) {
        return { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) };
      }
      return okJson({ ok: true });
    });
    await main();
    const telegramBody = calls.find((c) => c.url.includes('api.telegram.org')).opts.body;
    expect(telegramBody).not.toContain(GROQ_KEY);
    for (const line of [...logs, ...errors]) {
      expect(line).not.toContain(GROQ_KEY);
    }
  });
});
