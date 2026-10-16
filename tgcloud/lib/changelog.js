import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { api } from 'sdk';
import { changelog, channelSettings } from '../schema.js';

export async function addChangelogEntry(changes) {
  const today = new Date().toISOString().split('T')[0];
  const [entry] = await db.insert(changelog)
    .values({ date: today, changes })
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
  
  let text = '📝 Changelog:\n\n';
  for (const entry of unpublished) {
    text += `📅 ${entry.date}\n${entry.changes}\n\n`;
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
