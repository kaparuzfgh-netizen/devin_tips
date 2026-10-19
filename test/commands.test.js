import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COMMANDS, listedCommands, botfatherCommands } from '../tgcloud/lib/commands.js';

const handlerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../tgcloud/handlers/message.js'),
  'utf8',
);

const sourceCommands = () => {
  const found = new Set();
  for (const m of handlerSource.matchAll(/case '(\/[a-z_]+)':/g)) found.add(m[1]);
  for (const m of handlerSource.matchAll(/cmd === '(\/[a-z_]+)'/g)) found.add(m[1]);
  return found;
};

describe('command registry drift lock', () => {
  it('every command literal in handlers/message.js is registered', () => {
    const registered = new Set(COMMANDS.map((c) => c.cmd));
    for (const cmd of sourceCommands()) {
      expect(registered.has(cmd), `${cmd} handled but missing from COMMANDS`).toBe(true);
    }
  });

  it('every COMMANDS entry exists in the handler source', () => {
    const inSource = sourceCommands();
    for (const { cmd } of COMMANDS) {
      expect(inSource.has(cmd), `${cmd} registered but not handled in message.js`).toBe(true);
    }
  });
});

describe('listedCommands', () => {
  it('returns non-hidden entries per scope', () => {
    const pub = listedCommands('public');
    expect(pub.every((c) => c.scope === 'public' && !c.hidden)).toBe(true);
    expect(pub.map((c) => c.cmd)).toEqual(['/start', '/help', '/status', '/get_channel_id']);
    const admin = listedCommands('admin');
    expect(admin.every((c) => c.scope === 'admin' && !c.hidden)).toBe(true);
    expect(admin.map((c) => c.cmd)).toEqual(['/my_channels', '/clean_daily_posts']);
  });
});

describe('botfatherCommands', () => {
  it('emits one valid BotFather line per listed public command', () => {
    const lines = botfatherCommands().split('\n');
    expect(lines).toHaveLength(listedCommands('public').length);
    for (const line of lines) {
      expect(line).toMatch(/^[a-z0-9_]{1,32} - .{3,256}$/);
    }
    expect(lines).toContain('start - Начать работу');
  });

  it('never lists hidden or admin commands', () => {
    const names = new Set(botfatherCommands().split('\n').map((l) => l.split(' - ')[0]));
    for (const c of COMMANDS.filter((x) => x.hidden || x.scope !== 'public')) {
      expect(names.has(c.cmd.slice(1)), `${c.cmd} must not be advertised`).toBe(false);
    }
  });
});
