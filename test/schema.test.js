import { describe, it, expect } from 'vitest';
import * as schema from '../tgcloud/schema.js';

const EXPECTED_TABLES = {
  users: 'users',
  posts: 'posts',
  conversations: 'conversations',
  codeSnippets: 'code_snippets',
  changelog: 'changelog',
  reactionTriggers: 'reaction_triggers',
  channelSettings: 'channel_settings',
  dailyPosts: 'daily_posts',
};

describe('tgcloud/schema.js', () => {
  it('exports all expected tables', () => {
    for (const key of Object.keys(EXPECTED_TABLES)) {
      expect(schema[key], `missing export ${key}`).toBeTruthy();
    }
  });

  it('tables map to the documented SQL names', () => {
    for (const [key, name] of Object.entries(EXPECTED_TABLES)) {
      expect(schema[key].__name).toBe(name);
    }
  });

  it('daily_posts has date/status/channelMessageId columns', () => {
    for (const col of ['date', 'status', 'channelMessageId', 'decidedAt']) {
      expect(schema.dailyPosts[col], `missing column ${col}`).toBeTruthy();
    }
  });

  it('channel_settings keeps channelId as primary key', () => {
    expect(schema.channelSettings.channelId).toBeTruthy();
  });
});
