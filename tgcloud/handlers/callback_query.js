import { api } from 'sdk';
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { getOrCreateUser, isAdmin } from '../lib/auth.js';
import { sendRichMessage, escapeMd } from '../lib/message.js';
import { dailyPosts, channelSettings } from '../schema.js';

// runs on each `callback_query` update
export default async function (callback_query, ctx) {
  const userId = callback_query.from.id;
  const data = callback_query.data;

  console.log(`[CALLBACK] Given: user=${userId}, data=${data}`);

  try {
    // Parse callback data
    if (!data || !data.startsWith('pub:') && !data.startsWith('rej:')) {
      console.log('[CALLBACK] When: invalid data format');
      try {
        await api.answerCallbackQuery({
          callback_query_id: callback_query.id,
          text: '❌ Неизвестная команда',
          show_alert: true,
        });
      } catch (e) {
        console.log('[CALLBACK] Failed to answer callback query:', e.message);
      }
      return;
    }

    const [action, date] = data.split(':');
    console.log(`[CALLBACK] When: action=${action}, date=${date}`);

    // Get user
    const user = await getOrCreateUser(userId, callback_query.from.username);
    console.log(`[CALLBACK] User: role=${user.role}`);

    // Check admin
    if (!isAdmin(user)) {
      console.log('[CALLBACK] Then: access denied - not admin');
      try {
        await api.answerCallbackQuery({
          callback_query_id: callback_query.id,
          text: '❌ Только для админов',
          show_alert: true,
        });
      } catch (e) {
        console.log('[CALLBACK] Failed to answer callback query:', e.message);
      }
      return;
    }

    // Get channel ID from database
    const channels = await db.select().from(channelSettings).all();
    if (channels.length === 0) {
      console.log('[CALLBACK] Then: no channel configured');
      try {
        await api.answerCallbackQuery({
          callback_query_id: callback_query.id,
          text: '❌ Канал не привязан. Добавь бота в канал как админа.',
          show_alert: true,
        });
      } catch (e) {
        console.log('[CALLBACK] Failed to answer callback query:', e.message);
      }
      return;
    }
    const channelId = channels[0].channelId;
    console.log(`[CALLBACK] Channel: id=${channelId}`);

    // Check if already processed
    const existing = await db.select().from(dailyPosts).where(eq(dailyPosts.date, date)).get();
    if (existing) {
      console.log(`[CALLBACK] Then: already processed, status=${existing.status}`);
      try {
        await api.answerCallbackQuery({
          callback_query_id: callback_query.id,
          text: existing.status === 'published' ? '✅ Уже опубликовано' : '❌ Уже отклонено',
          show_alert: true,
        });
      } catch (e) {
        console.log('[CALLBACK] Failed to answer callback query:', e.message);
      }

      // Remove buttons from draft message
      try {
        await api.editMessageText({
          chat_id: callback_query.message.chat.id,
          message_id: callback_query.message.message_id,
          text: callback_query.message.text,
        });
      } catch (e) {
        console.log('[CALLBACK] Failed to remove buttons:', e.message);
      }
      return;
    }
    console.log('[CALLBACK] Date not processed yet, proceeding');

    if (action === 'pub') {
      // Publish: send message text to channel
      try {
        const draftText = callback_query.message.text;
        console.log(`[CALLBACK] When: publishing text (length=${draftText.length})`);

        const result = await sendRichMessage(channelId, escapeMd(draftText));
        console.log(`[CALLBACK] Then: message sent to channel, id=${result.message_id}`);

        // Record in database
        await db.insert(dailyPosts)
          .values({
            date,
            status: 'published',
            channelMessageId: result.message_id,
            decidedAt: new Date().getTime() / 1000,
          })
          .run();
        console.log('[CALLBACK] Then: recorded to DB');

        // Update buttons on draft message
        try {
          await api.editMessageText({
            chat_id: callback_query.message.chat.id,
            message_id: callback_query.message.message_id,
            text: callback_query.message.text,
          });
          console.log('[CALLBACK] Then: buttons removed via editMessageText');
        } catch (e) {
          console.log('[CALLBACK] Failed to remove buttons:', e.message);
        }

        try {
          await api.answerCallbackQuery({
            callback_query_id: callback_query.id,
            text: '✅ Опубликовано',
          });
        } catch (e) {
          console.log('[CALLBACK] Failed to answer callback query:', e.message);
        }
      } catch (e) {
        console.error('[CALLBACK] Publish failed:', {
          method: e.method,
          code: e.code,
          description: e.description,
          message: e.message,
        });
        await api.answerCallbackQuery({
          callback_query_id: callback_query.id,
          text: `❌ Ошибка: ${e.code || 'неизвестно'} - ${e.description || e.message}`,
          show_alert: true,
        });
      }
    } else if (action === 'rej') {
      // Reject: record in database
      console.log('[CALLBACK] When: rejecting');
      await db.insert(dailyPosts)
        .values({
          date,
          status: 'rejected',
          decidedAt: new Date().getTime() / 1000,
        })
        .run();
      console.log('[CALLBACK] Then: recorded as rejected');

      // Remove buttons
      try {
        await api.editMessageText({
          chat_id: callback_query.message.chat.id,
          message_id: callback_query.message.message_id,
          text: callback_query.message.text,
        });
        console.log('[CALLBACK] Then: buttons removed via editMessageText');
      } catch (e) {
        console.log('[CALLBACK] Failed to remove buttons:', e.message);
      }

      try {
        await api.answerCallbackQuery({
          callback_query_id: callback_query.id,
          text: '❌ Отклонено',
        });
      } catch (e) {
        console.log('[CALLBACK] Failed to answer callback query:', e.message);
      }
    }
  } catch (e) {
    console.error('[CALLBACK] Error:', e);
    await api.answerCallbackQuery({
      callback_query_id: callback_query.id,
      text: `❌ Ошибка: ${e.code || 'неизвестно'} - ${e.description || e.message}`,
      show_alert: true,
    });
  }
}