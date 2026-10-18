import { table, integer, text, boolean, sql } from 'sdk/db';

// Your database tables go here as named exports. Deploying this file registers the
// schema; applying the changes (a migration) updates the database.

// Users with roles (admin, user)
export const users = table('users', {
  telegramId: integer('telegram_id').primaryKey(),
  username: text('username'),
  role: text('role').notNull().default('user'),
});

// Content posts (educational, code examples, Q&A)
export const posts = table('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  language: text('language'),
  tags: text('tags'),
  published: boolean('published').notNull().default(false),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdBy: integer('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Q&A conversations
export const conversations = table('conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: text('category'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Bot code snippets for self-reference
export const codeSnippets = table('code_snippets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  code: text('code').notNull(),
  filePath: text('file_path').notNull(),
  language: text('language').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Changelog entries
export const changelog = table('changelog', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  category: text('category').notNull(), // feature, fix, improvement, documentation
  changes: text('changes').notNull(),
  published: boolean('published').notNull().default(false),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Reaction triggers (post needs X reactions to trigger action)
export const reactionTriggers = table('reaction_triggers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').notNull(),
  channelId: integer('channel_id').notNull(),
  requiredReactions: integer('required_reactions').notNull(),
  action: text('action').notNull(),
  actionData: text('action_data'),
  triggered: boolean('triggered').notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Channel settings
export const channelSettings = table('channel_settings', {
  channelId: integer('channel_id').primaryKey(),
  deleteServiceMessages: boolean('delete_service_messages').notNull().default(false),
  autoBoostRequest: boolean('auto_boost_request').notNull().default(false),
  targetBoostLevel: integer('target_boost_level'),
  changelogChannelId: integer('changelog_channel_id'),
  openaiApiKey: text('openai_api_key'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Daily posts with admin approval
export const dailyPosts = table('daily_posts', {
  date: text('date').primaryKey(),
  status: text('status').notNull(),
  channelMessageId: integer('channel_message_id'),
  decidedAt: integer('decided_at', { mode: 'timestamp' }),
});
