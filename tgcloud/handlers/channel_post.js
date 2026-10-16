import { api } from 'sdk';
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { channelSettings } from '../schema.js';
import { deleteServiceMessage, checkReactionTriggers } from '../lib/channel.js';

export default async function (channel_post, ctx) {
  const channelId = channel_post.chat.id;
  const messageId = channel_post.message_id;
  
  const settings = await db.select().from(channelSettings).where(eq(channelSettings.channelId, channelId)).get();
  
  if (!settings) return;
  
  if (settings.deleteServiceMessages && isServiceMessage(channel_post)) {
    await deleteServiceMessage(channelId, messageId);
  }
  
  if (channel_post.reaction_count) {
    await checkReactionTriggers(channelId, messageId);
  }
}

function isServiceMessage(post) {
  return post.left_chat_member || 
         post.new_chat_members || 
         post.pinned_message ||
         post.delete_chat_photo ||
         post.group_chat_created ||
         post.supergroup_chat_created ||
         post.channel_chat_created;
}