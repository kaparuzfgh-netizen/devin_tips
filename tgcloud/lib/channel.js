import { api } from 'sdk';
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { channelSettings, reactionTriggers } from '../schema.js';

export async function deleteServiceMessage(chatId, messageId) {
  try {
    await api.deleteMessage({ chat_id: chatId, message_id: messageId });
  } catch (e) {
    console.log('Failed to delete message:', e.message);
  }
}

export async function getChannelInfo(channelId) {
  const chat = await api.getChat({ chat_id: channelId });
  const boosts = await api.getChatBoosts({ chat_id: channelId });
  return { chat, boosts };
}

export async function sendBoostRequest(channelId, targetLevel) {
  const info = await getChannelInfo(channelId);
  const currentLevel = info.chat.boost_level || 0;
  
  if (currentLevel >= targetLevel) {
    return { success: false, message: 'Уровень уже достигнут' };
  }
  
  const needed = targetLevel - currentLevel;
  await api.sendMessage({
    chat_id: channelId,
    text: `🚀 Нам нужно ${needed} бустов для достижения уровня ${targetLevel}!\n\nТекущий уровень: ${currentLevel}\n\nПожалуйста, поддержите канал бустом!`,
  });
  
  return { success: true, currentLevel, targetLevel, needed };
}

export async function setChannelSetting(channelId, setting, value) {
  const existing = await db.select().from(channelSettings).where(eq(channelSettings.channelId, channelId)).get();
  
  if (existing) {
    await db.update(channelSettings)
      .set({ [setting]: value, updatedAt: new Date().getTime() / 1000 })
      .where(eq(channelSettings.channelId, channelId))
      .run();
  } else {
    await db.insert(channelSettings)
      .values({ channelId, [setting]: value })
      .run();
  }
}

export async function createReactionTrigger(postId, channelId, requiredReactions, action, actionData) {
  const [trigger] = await db.insert(reactionTriggers)
    .values({ postId, channelId, requiredReactions, action, actionData })
    .returning()
    .run();
  return trigger;
}

export async function checkReactionTriggers(channelId, postId) {
  const triggers = await db.select().from(reactionTriggers)
    .where(eq(reactionTriggers.channelId, channelId))
    .all();
  
  for (const trigger of triggers) {
    if (trigger.triggered) continue;
    
    const message = await api.getMessageReactionCount({
      chat_id: channelId,
      message_id: postId,
    });
    
    const totalReactions = message.total_reaction_count || 0;
    
    if (totalReactions >= trigger.requiredReactions) {
      await db.update(reactionTriggers)
        .set({ triggered: true })
        .where(eq(reactionTriggers.id, trigger.id))
        .run();
      
      await executeTriggerAction(trigger);
    }
  }
}

async function executeTriggerAction(trigger) {
  switch (trigger.action) {
    case 'send_message':
      const data = JSON.parse(trigger.actionData || '{}');
      await api.sendMessage({
        chat_id: trigger.channelId,
        text: data.message || 'Триггер активирован!',
      });
      break;
  }
}
