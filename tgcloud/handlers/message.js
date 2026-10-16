// handlers/message.js — runs on each `message` update. The file name is the
// Telegram update type; the platform calls the default export with the matching
// payload (here, a Message). The full update is available as `ctx.update`.

import { api } from 'sdk';
import { getOrCreateUser, isAdmin } from '../lib/auth.js';
import { getPublishedPosts, getCodeSnippet, listCodeSnippets } from '../lib/content.js';
import { setChannelSetting, sendBoostRequest, getChannelInfo, createReactionTrigger } from '../lib/channel.js';
import { addChangelogEntry, publishChangelog } from '../lib/changelog.js';

export default async function (message, ctx) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username;
  const text = message.text;

  const user = await getOrCreateUser(userId, username);

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

  switch (cmd) {
    case '/start':
      await api.sendMessage({
        chat_id: chatId,
        text: `👋 Привет! Я Devin Tips Bot - бот о Devin AI!\n\n` +
          `Я помогу тебе узнать о возможностях Devin, покажу примеры кода и отвечу на вопросы.\n\n` +
          `📚 Команды:\n` +
          `/help - Показать справку\n` +
          `/posts - Показать последние посты\n` +
          `/code [name] - Показать код бота\n` +
          `/listcode - Список всех модулей\n` +
          `/ask <вопрос> - Задать вопрос\n` +
          `/get_channel_id @username - Получить ID канала\n` +
          `\n${isAdmin(user) ? '🔧 Админ-команды:\n/changelog <изменения> - Добавить запись в changelog\n/publish_changelog <channel_id> - Опубликовать changelog\n/channel_config <key> <value> - Настройка канала\n/boost_request <level> - Запрос бустов\n/reaction_trigger <post_id> <count> <action> - Создать триггер реакций' : ''}`,
      });
      break;

    case '/help':
      await api.sendMessage({
        chat_id: chatId,
        text: `📖 Справка по Devin Tips Bot\n\n` +
          `📚 Команды:\n` +
          `/start - Начать работу\n` +
          `/help - Эта справка\n` +
          `/posts - Показать последние посты\n` +
          `/code [name] - Показать код бота\n` +
          `/listcode - Список всех модулей\n` +
          `/ask <вопрос> - Задать вопрос о Devin\n\n` +
          `Типы постов:\n` +
          `• educational - Образовательные материалы\n` +
          `• code_example - Примеры кода\n` +
          `• qa - Вопросы и ответы\n` +
          `• auto - Автоматический контент`,
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
        await api.sendMessage({ chat_id, text: '❌ Только для админов' });
        return;
      }
      if (!args) {
        await api.sendMessage({ chat_id, text: '❌ Укажи изменения. Пример: /changelog Добавлена функция X' });
        return;
      }
      await addChangelogEntry(args);
      await api.sendMessage({ chat_id, text: '✅ Запись добавлена в changelog' });
      break;

    case '/publish_changelog':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id, text: '❌ Только для админов' });
        return;
      }
      if (!args) {
        await api.sendMessage({ chat_id, text: '❌ Укажи ID канала' });
        return;
      }
      const result = await publishChangelog(parseInt(args));
      if (result.success) {
        await api.sendMessage({ chat_id, text: `✅ Опубликовано ${result.published} записей` });
      } else {
        await api.sendMessage({ chat_id, text: result.message });
      }
      break;

    case '/channel_config':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id, text: '❌ Только для админов' });
        return;
      }
      const configParts = args.split(' ');
      if (configParts.length < 2) {
        await api.sendMessage({ chat_id, text: '❌ Использование: /channel_config <key> <value>\nКлючи: deleteServiceMessages, autoBoostRequest, targetBoostLevel, changelogChannelId' });
        return;
      }
      const key = configParts[0];
      const value = configParts.slice(1).join(' ');
      await setChannelSetting(chatId, key, value);
      await api.sendMessage({ chat_id, text: `✅ Настройка ${key} = ${value} сохранена` });
      break;

    case '/boost_request':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id, text: '❌ Только для админов' });
        return;
      }
      if (!args) {
        await api.sendMessage({ chat_id, text: '❌ Укажи целевой уровень' });
        return;
      }
      const boostResult = await sendBoostRequest(chatId, parseInt(args));
      await api.sendMessage({ chat_id, text: boostResult.message });
      break;

    case '/reaction_trigger':
      if (!isAdmin(user)) {
        await api.sendMessage({ chat_id, text: '❌ Только для админов' });
        return;
      }
      const triggerParts = args.split(' ');
      if (triggerParts.length < 3) {
        await api.sendMessage({ chat_id, text: '❌ Использование: /reaction_trigger <post_id> <count> <action>' });
        return;
      }
      await createReactionTrigger(parseInt(triggerParts[0]), chatId, parseInt(triggerParts[1]), triggerParts[2]);
      await api.sendMessage({ chat_id, text: '✅ Триггер создан' });
      break;

    case '/get_channel_id':
      if (!args) {
        await api.sendMessage({ chat_id, text: '❌ Укажи @username канала. Пример: /get_channel_id @devin_tips' });
        return;
      }
      try {
        const channel = await api.getChat({ chat_id: args });
        await api.sendMessage({ chat_id, text: `📋 ID канала ${args}: ${channel.id}` });
      } catch (e) {
        await api.sendMessage({ chat_id, text: '❌ Не удалось получить ID канала. Убедись, что бот добавлен в канал.' });
      }
      break;

    default:
      await api.sendMessage({
        chat_id: chatId,
        text: '❓ Неизвестная команда. Используй /help для справки.',
      });
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
