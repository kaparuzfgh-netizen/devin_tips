import { checkReactionTriggers } from '../lib/channel.js';

export default async function (message_reaction_count, ctx) {
  const chatId = message_reaction_count.chat.id;
  const messageId = message_reaction_count.message_id;
  
  await checkReactionTriggers(chatId, messageId);
}