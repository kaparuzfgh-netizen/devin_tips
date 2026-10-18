// handlers/message.js — runs on each `message` update. The file name is the
// Telegram update type; the platform calls the default export with the matching
// payload (here, a Message). The full update is available as `ctx.update`.

import { api } from 'sdk';
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { getOrCreateUser, isAdmin } from '../lib/auth.js';
import { getPublishedPosts, getCodeSnippet, listCodeSnippets } from '../lib/content.js';
import { setChannelSetting, sendBoostRequest, getChannelInfo, createReactionTrigger } from '../lib/channel.js';
import { addChangelogEntry, publishChangelog, generateDailySummary } from '../lib/changelog.js';
import { setOpenaiApiKey } from '../lib/openai.js';
import { sendRichMessage, formatId } from '../lib/message.js';
import { channelSettings, dailyPosts } from '../schema.js';

export default async function (message, ctx) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username;
  const text = message.text;

  const user = await getOrCreateUser(userId, username);

  // Handle forwarded messages to get channel ID
  if (message.forward_from_chat) {
    const forwardedChatId = message.forward_from_chat.id;
    const forwardedChatTitle = message.forward_from_chat.title || message.forward_from_chat.username;
    await api.sendMessage({
      chat_id: chatId,
      text: `📋 ID канала/чата "${forwardedChatTitle}": ${forwardedChatId}`,
    });
    return;
  }

  if (text?.startsWith('/')) {
    await handleCommand(text, chatId, user, message);
  } else {
    await handleQuestion(text, chatId, user);
  }
}

async function handleCommand(command, chatId, user, message) {
  const parts = command.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  console.log(`[CMD] ${cmd} from user ${user.telegramId} (@${user.username})`);

  try {
    // Команда для очистки тестовых данных из daily_posts
    if (cmd === '/clean_daily_posts') {
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      const result = await db.delete(dailyPosts).run();
      await api.sendMessage({ chat_id: chatId, text: `✅ Удалено ${result.rowsAffected} записей из daily_posts` });
      return;
    }

    switch (cmd) {
    case '/start':
      await api.sendMessage({
        chat_id: chatId,
        text: '👋 Привет! Я Devin Tips Bot - бот о Devin AI!\n\n' +
          'Я помогу тебе узнать о возможностях Devin, покажу примеры кода и отвечу на вопросы.\n\n' +
          '📚 Команды:\n' +
          '/help - Показать справку\n' +
          '/posts - Показать последние посты\n' +
          '/code [name] - Показать код бота\n' +
          '/listcode - Список всех модулей\n' +
          '/ask <вопрос> - Задать вопрос\n' +
          '/get_channel_id @username - Получить ID канала\n' +
          '/my_channels - Справка по каналам\n' +
          `\n${isAdmin(user) ? '🔧 Админ-команды:\n/changelog <категория>: <изменения> - Добавить запись в changelog\n/publish_changelog <channel_id> - Опубликовать changelog\n/channel_config <key> <value> - Настройка канала\n/boost_request <level> - Запрос бустов\n/reaction_trigger <post_id> <count> <action> - Создать триггер реакций\n/set_openai_key <key> - Установить OpenAI API ключ\n/ai_summary - Сгенерировать AI summary' : ''}`,
      });
      break;

    case '/help':
      await api.sendMessage({
        chat_id: chatId,
        text: '📖 Справка по Devin Tips Bot\n\n' +
          '📚 Команды:\n' +
          '/start - Начать работу\n' +
          '/help - Эта справка\n' +
          '/posts - Показать последние посты\n' +
          '/code [name] - Показать код бота\n' +
          '/listcode - Список всех модулей\n' +
          '/ask <вопрос> - Задать вопрос о Devin\n\n' +
          'Типы постов:\n' +
          '• educational - Образовательные материалы\n' +
          '• code_example - Примеры кода\n' +
          '• qa - Вопросы и ответы\n' +
          '• auto - Автоматический контент',
      });
      break;

    case '/posts':
      const posts = await getPublishedPosts(null, 5);
      if (posts.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: '📭 Пока нет опубликованных постов.',
        });
      } else {
        let text = '📚 Последние посты:\n\n';
        for (const post of posts) {
          text += `📌 ${post.title}\n`;
          text += `   ${post.content.substring(0, 100)}...\n\n`;
        }
        await api.sendMessage({ chat_id: chatId, text });
      }
      break;

    case '/code':
      if (!args) {
        await api.sendMessage({
          chat_id: chatId,
          text: 'Укажи имя модуля. Используй /listcode для просмотра.',
        });
        return;
      }
      const snippet = await getCodeSnippet(args);
      if (!snippet) {
        await api.sendMessage({
          chat_id: chatId,
          text: `❌ Модуль "${args}" не найден.`,
        });
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: `📄 ${snippet.name}\n${snippet.description ? `\n${snippet.description}\n` : ''}\n\`\`\`${snippet.language}\n${snippet.code}\n\`\`\``,
          parse_mode: 'Markdown',
        });
      }
      break;

    case '/listcode':
      const snippets = await listCodeSnippets();
      if (snippets.length === 0) {
        await api.sendMessage({
          chat_id: chatId,
          text: '📭 Код бота еще не загружен.',
        });
      } else {
        let text = '📂 Модули бота:\n\n';
        for (const s of snippets) {
          text += `• ${s.name} - ${s.filePath}\n`;
        }
        await api.sendMessage({ chat_id: chatId, text });
      }
      break;

    case '/ask':
      if (!args) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Укажи вопрос после команды. Пример: /ask Как использовать Devin?',
        });
        return;
      }
      await handleQuestion(args, chatId, user);
      break;

    case '/changelog':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      if (!args) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Укажи категорию и изменения. Пример: /changelog feature: Добавлена функция X\nКатегории: feature, fix, improvement, documentation' });
        return;
      }
      const parts = args.split(':');
      if (parts.length < 2) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Неверный формат. Используй: /changelog <категория>: <изменения>' });
        return;
      }
      const category = parts[0].trim().toLowerCase();
      const changes = parts.slice(1).join(':').trim();
      const validCategories = ['feature', 'fix', 'improvement', 'documentation'];
      if (!validCategories.includes(category)) {
        await api.sendMessage({ chat_id: chatId, text: `❌ Неверная категория. Доступно: ${validCategories.join(', ')}` });
        return;
      }
      await addChangelogEntry(category, changes);
      await api.sendMessage({ chat_id: chatId, text: '✅ Запись добавлена в changelog' });
      break;

    case '/publish_changelog':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      if (!args) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Укажи ID канала' });
        return;
      }
      const result = await publishChangelog(parseInt(args));
      if (result.success) {
        await api.sendMessage({ chat_id: chatId, text: `✅ Опубликовано ${result.published} записей` });
      } else {
        await api.sendMessage({ chat_id: chatId, text: result.message });
      }
      break;

    case '/channel_config':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      const configParts = args.split(' ');
      if (configParts.length < 2) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Использование: /channel_config <key> <value>\nКлючи: deleteServiceMessages, autoBoostRequest, targetBoostLevel, changelogChannelId' });
        return;
      }
      const key = configParts[0];
      const value = configParts.slice(1).join(' ');
      await setChannelSetting(chatId, key, value);
      await api.sendMessage({ chat_id: chatId, text: `✅ Настройка ${key} = ${value} сохранена` });
      break;

    case '/boost_request':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      if (!args) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Укажи целевой уровень' });
        return;
      }
      const boostResult = await sendBoostRequest(chatId, parseInt(args));
      await api.sendMessage({ chat_id: chatId, text: boostResult.message });
      break;

    case '/reaction_trigger':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      const triggerParts = args.split(' ');
      if (triggerParts.length < 3) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Использование: /reaction_trigger <post_id> <count> <action>' });
        return;
      }
      await createReactionTrigger(parseInt(triggerParts[0]), chatId, parseInt(triggerParts[1]), triggerParts[2]);
      await api.sendMessage({ chat_id: chatId, text: '✅ Триггер создан' });
      break;

    case '/get_channel_id':
      // Show saved channel IDs from database
      const savedChannels = await db.select().from(channelSettings).all();
      
      if (savedChannels.length === 0) {
        await sendRichMessage(chatId, '❌ Каналы не найдены в базе данных.\n\nДобавь бота в канал как админа - он автоматически сохранит ID.');
        return;
      }
      
      let text = '📋 Сохранённые каналы:\n\n';
      for (const channel of savedChannels) {
        text += `• ${formatId(channel.channelId)}\n`;
      }
      
      await sendRichMessage(chatId, text);
      break;

    case '/set_openai_key':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      if (!args) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Укажи API ключ. Пример: /set_openai_key gsk_...' });
        return;
      }
      await setOpenaiApiKey(args);
      await api.sendMessage({ chat_id: chatId, text: '✅ OpenAI API ключ сохранен' });
      break;

    case '/ai_summary':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      const summary = await generateDailySummary();
      if (!summary) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Нет изменений за сегодня или API ключ не настроен' });
      } else {
        await api.sendMessage({ chat_id: chatId, text: `🤖 AI Summary:\n\n${summary}` });
      }
      break;

    case '/my_channels':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Только для админов' });
        return;
      }
      try {
        const me = await api.getMe();
        await api.sendMessage({
          chat_id: chatId,
          text: `ℹ️ Бот @${me.username} должен быть добавлен в канал как админ.\n\nПосле добавления просто перешли любое сообщение из канала боту - он покажет ID.`,
        });
      } catch (e) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Ошибка' });
      }
      break;

    case '/status':
      try {
        const me = await api.getMe();
        await sendRichMessage(chatId, `✅ Бот работает!\n\n🤖 Бот: @${me.username}\n👤 Твой ID: ${formatId(user.telegramId)}\n👤 Твоя роль: ${user.role}`);
      } catch (e) {
        await api.sendMessage({ chat_id: chatId, text: '❌ Ошибка проверки статуса' });
      }
      break;

    default:
      await sendRichMessage(chatId, '❓ Неизвестная команда. Используй /help для справки.');
  }
  } catch (e) {
    console.error(`[ERROR] Command ${cmd} failed:`, e);
    await sendRichMessage(chatId, `❌ Ошибка выполнения команды: ${e.description || e.message || 'Неизвестная ошибка'}`);
  }
}

async function handleQuestion(question, chatId, user) {
  if (!question) return;

  const responses = {
    'devin': 'Devin - это AI-агент для программирования, который помогает писать код, исправлять баги и управлять проектами.',
    'код': 'Я могу показать свой код! Используй /code <имя_модуля> или /listcode для просмотра.',
    'помощь': 'Используй /help для просмотра всех команд.',
    'функции': 'Мои функции: публикация контента о Devin, показ кода, ответы на вопросы, управление каналом, changelog.',
  };

  let answer = null;
  const lowerQuestion = question.toLowerCase();

  for (const [key, value] of Object.entries(responses)) {
    if (lowerQuestion.includes(key)) {
      answer = value;
      break;
    }
  }

  if (!answer) {
    answer = '🤔 Я пока учусь отвечать на такие вопросы. Попробуй спросить о Devin, моём коде или моих функциях!';
  }

  await api.sendMessage({
    chat_id: chatId,
    text: answer,
  });
}
