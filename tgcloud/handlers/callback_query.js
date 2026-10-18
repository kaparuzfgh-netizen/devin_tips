import { api } from 'sdk';
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { isAdmin } from '../lib/auth.js';
import { dailyPosts, channelSettings } from '../schema.js';

// runs on each `callback_query` update
export default async function (callback_query, ctx) {
  const userId = callback_query.from.id;
  const data = callback_query.data;

  console.log(`[CALLBACK] User ${userId}, data: ${data}`);

  try {
    // Parse callback data
    if (!data || !data.startsWith('pub:') && !data.startsWith('rej:')) {
      await api.answerCallbackQuery({
        callback_query_id: callback_query.id,
        text: '❌ Неизвестная команда',
        show_alert: true,
      });
      return;
    }

    const [action, date] = data.split(':');

    // Get user
    const user = await (await import('../lib/auth.js')).getOrCreateUser(userId, callback_query.from.username);

    // Check admin
    if (!isAdmin(user)) {
      await api.answerCallbackQuery({
        callback_query_id: callback_query.id,
        text: '❌ Только для админов',
        show_alert: true,
      });
      return;
    }

    // Get channel ID from database
    const channels = await db.select().from(channelSettings).all();
    if (channels.length === 0) {
      await api.answerCallbackQuery({
        callback_query_id: callback_query.id,
        text: '❌ Канал не привязан. Добавь бота в канал как админа.',
        show_alert: true,
      });
      return;
    }
    const channelId = channels[0].channelId;

    // Check if already processed
    const existing = await db.select().from(dailyPosts).where(eq(dailyPosts.date, date)).get();
    if (existing) {
      await api.answerCallbackQuery({
        callback_query_id: callback_query.id,
        text: existing.status === 'published' ? '✅ Уже опубликовано' : '❌ Уже отклонено',
        show_alert: true,
      });

      // Remove buttons from draft message
      try {
        await api.editMessageReplyMarkup({
          chat_id: callback_query.message.chat.id,
          message_id: callback_query.message.message_id,
          reply_markup: null,
        });
      } catch (e) {
        console.log('[CALLBACK] Failed to remove buttons:', e.message);
      }
      return;
    }

    if (action === 'pub') {
      // Publish: send message text to channel
      try {
        const draftText = callback_query.message.text;

        const result = await api.sendMessage({
          chat_id: channelId,
          text: draftText,
        });

        // Record in database
        await db.insert(dailyPosts)
          .values({
            date,
            status: 'published',
            channelMessageId: result.message_id,
            decidedAt: new Date().getTime() / 1000,
          })
          .run();

        // Update buttons on draft message
        await api.editMessageReplyMarkup({
          chat_id: callback_query.message.chat.id,
          message_id: callback_query.message.message_id,
          reply_markup: null,
        });

        await api.answerCallbackQuery({
          callback_query_id: callback_query.id,
          text: '✅ Опубликовано',
        });
      } catch (e) {
        console.error('[CALLBACK] Publish failed:', e);
        await api.answerCallbackQuery({
          callback_query_id: callback_query.id,
          text: `❌ Ошибка: ${e.code || 'неизвестно'} - ${e.description || e.message}`,
          show_alert: true,
        });
      }
    } else if (action === 'rej') {
      // Reject: record in database
      await db.insert(dailyPosts)
        .values({
          date,
          status: 'rejected',
          decidedAt: new Date().getTime() / 1000,
        })
        .run();

      // Remove buttons
      await api.editMessageReplyMarkup({
        chat_id: callback_query.message.chat.id,
        message_id: callback_query.message.message_id,
        reply_markup: null,
      });

      await api.answerCallbackQuery({
        callback_query_id: callback_query.id,
        text: '❌ Отклонено',
      });
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