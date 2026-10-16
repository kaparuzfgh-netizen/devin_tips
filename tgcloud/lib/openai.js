import { fetch } from 'sdk';
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { channelSettings } from '../schema.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

async function getApiKey() {
  const settings = await db.select().from(channelSettings).limit(1).get();
  return settings?.openaiApiKey || null;
}

export async function generateChangelogSummary(changes) {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const prompt = `Summarize these changes into a concise changelog entry. Use emoji categories:
✨ for features
🐛 for bug fixes
♻️ for improvements
📝 for documentation

Changes:
${changes}

Format as a clean, readable list. Keep it brief and informative.`;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: fetch.body.json({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that formats changelogs concisely with emoji categories.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('OpenAI API error:', error);
      return null;
    }

    const data = await res.json();
    return data.choices[0]?.message?.content || null;
  } catch (e) {
    console.error('OpenAI fetch error:', e.message);
    return null;
  }
}

export async function categorizeChange(change) {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const prompt = `Categorize this change as one of: feature, fix, improvement, documentation. Return only the category word.

Change: ${change}`;

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: fetch.body.json({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You categorize changes. Return only one word: feature, fix, improvement, or documentation.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 20,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.choices[0]?.message?.content?.trim().toLowerCase() || null;
  } catch (e) {
    return null;
  }
}

export async function setOpenaiApiKey(apiKey) {
  const settings = await db.select().from(channelSettings).limit(1).get();
  
  if (settings) {
    await db.update(channelSettings)
      .set({ openaiApiKey: apiKey })
      .where(eq(channelSettings.channelId, settings.channelId))
      .run();
  } else {
    await db.insert(channelSettings)
      .values({ channelId: 1, openaiApiKey: apiKey })
      .run();
  }
}
