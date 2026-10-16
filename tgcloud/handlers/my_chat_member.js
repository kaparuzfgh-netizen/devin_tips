import { db } from 'sdk';
import { eq } from 'sdk/db';
import { channelSettings } from '../schema.js';

export default async function (my_chat_member, ctx) {
  const chatId = my_chat_member.chat.id;
  const bot = my_chat_member.new_chat_member.user;
  
  console.log(`[MY_CHAT_MEMBER] Bot status changed in chat ${chatId}, status: ${my_chat_member.new_chat_member.status}`);
  
  // Если бот стал администратором - сохраняем ID канала
  if (my_chat_member.new_chat_member.status === 'administrator') {
    console.log(`[MY_CHAT_MEMBER] Bot became admin in chat ${chatId}, saving to DB`);
    
    const existing = await db.select().from(channelSettings).where(eq(channelSettings.channelId, chatId)).get();
    
    if (existing) {
      await db.update(channelSettings)
        .set({ channelId: chatId })
        .where(eq(channelSettings.channelId, chatId))
        .run();
    } else {
      await db.insert(channelSettings)
        .values({ channelId: chatId })
        .run();
    }
    
    console.log(`[MY_CHAT_MEMBER] Channel ID ${chatId} saved to DB`);
  }
}