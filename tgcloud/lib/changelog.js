import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { api } from 'sdk';
import { changelog, channelSettings } from '../schema.js';
import { generateChangelogSummary } from './openai.js';

const CATEGORY_EMOJIS = {
  feature: '✨',
  fix: '🐛',
  improvement: '♻️',
  documentation: '📝',
};

export async function addChangelogEntry(category, changes) {
  const today = new Date().toISOString().split('T')[0];
  const [entry] = await db.insert(changelog)
    .values({ date: today, category, changes })
    .returning()
    .run();
  return entry;
}

export async function getChangelog(date = null) {
  if (date) {
    return await db.select().from(changelog).where(eq(changelog.date, date)).get();
  }
  return await db.select().from(changelog).orderBy(desc(changelog.date)).all();
}

export async function publishChangelog(channelId) {
  const unpublished = await db.select().from(changelog)
    .where(eq(changelog.published, false))
    .orderBy(desc(changelog.date))
    .all();
  
  if (unpublished.length === 0) {
    return { success: false, message: 'Нет изменений для публикации' };
  }
  
  const grouped = {};
  for (const entry of unpublished) {
    if (!grouped[entry.date]) {
      grouped[entry.date] = [];
    }
    grouped[entry.date].push(entry);
  }
  
  let text = '📝 Changelog\n\n';
  
  for (const [date, entries] of Object.entries(grouped)) {
    text += `📅 ${date}\n\n`;
    
    const byCategory = {};
    for (const entry of entries) {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = [];
      }
      byCategory[entry.category].push(entry.changes);
    }
    
    for (const [category, changes] of Object.entries(byCategory)) {
      const emoji = CATEGORY_EMOJIS[category] || '📌';
      text += `${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}:\n`;
      for (const change of changes) {
        text += `  • ${change}\n`;
      }
      text += '\n';
    }
  }
  
  await api.sendMessage({ chat_id: channelId, text });
  
  for (const entry of unpublished) {
    await db.update(changelog)
      .set({ published: true, publishedAt: new Date().getTime() / 1000 })
      .where(eq(changelog.id, entry.id))
      .run();
  }
  
  return { success: true, published: unpublished.length };
}

export async function autoPublishChangelog() {
  const settings = await db.select().from(channelSettings).all();
  
  for (const setting of settings) {
    if (setting.changelogChannelId) {
      await publishChangelog(setting.changelogChannelId);
    }
  }
}

export async function generateDailySummary() {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = await db.select().from(changelog)
    .where(eq(changelog.date, today))
    .all();
  
  if (todayEntries.length === 0) return null;
  
  const allChanges = todayEntries.map(e => e.changes).join('\n');
  const summary = await generateChangelogSummary(allChanges);
  return summary;
}
