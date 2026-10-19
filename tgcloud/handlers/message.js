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
import { sendRichMessage } from '../lib/message.js';
import { listedCommands } from '../lib/commands.js';
import {
  html, header, section, list, footer,
  ok, fail, empty, unknown, info,
  formatId, formatCode,
} from '../lib/format.js';
import { channelSettings, dailyPosts } from '../schema.js';

const commandLines = (scope) =>
  listedCommands(scope)
    .map((c) => `${c.cmd}${c.args ? ` ${c.args}` : ''} - ${c.desc}`)
    .join('\n');

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
    await sendRichMessage(
      chatId,
      html`📋 ID канала/чата "${forwardedChatTitle}": ${forwardedChatId}`,
    );
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
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      const result = await db.delete(dailyPosts).run();
      await sendRichMessage(chatId, ok(`Удалено ${result.rowsAffected} записей из daily_posts`));
      return;
    }

    switch (cmd) {
    case '/start':
      await sendRichMessage(
        chatId,
        html`${header('👋', 'Devin Tips Bot')}

${'Привет! Я Devin Tips Bot - бот о Devin AI!\n\nЯ помогу тебе узнать о возможностях Devin, покажу примеры кода и отвечу на вопросы.'}

${section('📚 Команды', commandLines('public'))}${isAdmin(user) ? html`

${section('🔧 Админ-команды', commandLines('admin'))}` : ''}

${footer()}`,
      );
      break;

    case '/help':
      await sendRichMessage(
        chatId,
        html`${header('📖', 'Справка по Devin Tips Bot')}

${section('📚 Команды', commandLines('public'))}${isAdmin(user) ? html`

${section('🔧 Админ-команды', commandLines('admin'))}` : ''}

${footer()}`,
      );
      break;

    case '/posts':
      const posts = await getPublishedPosts(null, 5);
      if (posts.length === 0) {
        await sendRichMessage(chatId, empty('Пока нет опубликованных постов.'));
      } else {
        await sendRichMessage(
          chatId,
          html`${header('📚', 'Последние посты:')}\n\n${list(
            posts.map((p) => `${p.title}\n   ${p.content.substring(0, 100)}...`),
          )}`,
        );
      }
      break;

    case '/code':
      if (!args) {
        await sendRichMessage(chatId, html`Укажи имя модуля. Используй /listcode для просмотра.`);
        return;
      }
      const snippet = await getCodeSnippet(args);
      if (!snippet) {
        await sendRichMessage(chatId, fail(`Модуль "${args}" не найден.`));
      } else {
        await sendRichMessage(
          chatId,
          html`📄 ${snippet.name}\n${snippet.description ? html`\n${snippet.description}\n` : ''}\n${formatCode(snippet.code, snippet.language)}`,
        );
      }
      break;

    case '/listcode':
      const snippets = await listCodeSnippets();
      if (snippets.length === 0) {
        await sendRichMessage(chatId, empty('Код бота еще не загружен.'));
      } else {
        await sendRichMessage(
          chatId,
          html`${header('📂', 'Модули бота:')}\n\n${list(snippets.map((s) => `${s.name} - ${s.filePath}`))}`,
        );
      }
      break;

    case '/ask':
      if (!args) {
        await sendRichMessage(chatId, fail('Укажи вопрос после команды. Пример: /ask Как использовать Devin?'));
        return;
      }
      await handleQuestion(args, chatId, user);
      break;

    case '/changelog':
      if (!isAdmin(user)) {
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      if (!args) {
        await sendRichMessage(chatId, fail('Укажи категорию и изменения. Пример: /changelog feature: Добавлена функция X\nКатегории: feature, fix, improvement, documentation'));
        return;
      }
      const parts = args.split(':');
      if (parts.length < 2) {
        await sendRichMessage(chatId, fail('Неверный формат. Используй: /changelog <категория>: <изменения>'));
        return;
      }
      const category = parts[0].trim().toLowerCase();
      const changes = parts.slice(1).join(':').trim();
      const validCategories = ['feature', 'fix', 'improvement', 'documentation'];
      if (!validCategories.includes(category)) {
        await sendRichMessage(chatId, fail(`Неверная категория. Доступно: ${validCategories.join(', ')}`));
        return;
      }
      await addChangelogEntry(category, changes);
      await sendRichMessage(chatId, ok('Запись добавлена в changelog'));
      break;

    case '/publish_changelog':
      if (!isAdmin(user)) {
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      if (!args) {
        await sendRichMessage(chatId, fail('Укажи ID канала'));
        return;
      }
      const result = await publishChangelog(parseInt(args));
      if (result.success) {
        await sendRichMessage(chatId, ok(`Опубликовано ${result.published} записей`));
      } else {
        await sendRichMessage(chatId, html`${result.message}`);
      }
      break;

    case '/channel_config':
      if (!isAdmin(user)) {
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      const configParts = args.split(' ');
      if (configParts.length < 2) {
        await sendRichMessage(chatId, fail('Использование: /channel_config <key> <value>\nКлючи: deleteServiceMessages, autoBoostRequest, targetBoostLevel, changelogChannelId'));
        return;
      }
      const key = configParts[0];
      const value = configParts.slice(1).join(' ');
      await setChannelSetting(chatId, key, value);
      await sendRichMessage(chatId, ok(`Настройка ${key} = ${value} сохранена`));
      break;

    case '/boost_request':
      if (!isAdmin(user)) {
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      if (!args) {
        await sendRichMessage(chatId, fail('Укажи целевой уровень'));
        return;
      }
      const boostResult = await sendBoostRequest(chatId, parseInt(args));
      await sendRichMessage(chatId, html`${boostResult.message}`);
      break;

    case '/reaction_trigger':
      if (!isAdmin(user)) {
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      const triggerParts = args.split(' ');
      if (triggerParts.length < 3) {
        await sendRichMessage(chatId, fail('Использование: /reaction_trigger <post_id> <count> <action>'));
        return;
      }
      await createReactionTrigger(parseInt(triggerParts[0]), chatId, parseInt(triggerParts[1]), triggerParts[2]);
      await sendRichMessage(chatId, ok('Триггер создан'));
      break;

    case '/get_channel_id':
      // Show saved channel IDs from database
      const savedChannels = await db.select().from(channelSettings).all();
      
      if (savedChannels.length === 0) {
        await sendRichMessage(chatId, fail('Каналы не найдены в базе данных.\n\nДобавь бота в канал как админа - он автоматически сохранит ID.'));
        return;
      }
      
      await sendRichMessage(
        chatId,
        html`${header('📋', 'Сохранённые каналы:')}\n\n${list(savedChannels.map((c) => formatId(c.channelId)))}`,
      );
      break;

    case '/set_openai_key':
      if (!isAdmin(user)) {
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      if (!args) {
        await sendRichMessage(chatId, fail('Укажи API ключ. Пример: /set_openai_key gsk_...'));
        return;
      }
      await setOpenaiApiKey(args);
      await sendRichMessage(chatId, ok('OpenAI API ключ сохранен'));
      break;

    case '/ai_summary':
      if (!isAdmin(user)) {
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      const summary = await generateDailySummary();
      if (!summary) {
        await sendRichMessage(chatId, fail('Нет изменений за сегодня или API ключ не настроен'));
      } else {
        await sendRichMessage(chatId, html`${header('🤖', 'AI Summary')}\n\n${summary}`);
      }
      break;

    case '/my_channels':
      if (!isAdmin(user)) {
        await sendRichMessage(chatId, fail('Только для админов'));
        return;
      }
      try {
        const me = await api.getMe();
        await sendRichMessage(
          chatId,
          info(`Бот @${me.username} должен быть добавлен в канал как админ.\n\nПосле добавления просто перешли любое сообщение из канала боту - он покажет ID.`),
        );
      } catch (e) {
        await sendRichMessage(chatId, fail('Ошибка'));
      }
      break;

    case '/status':
      try {
        const me = await api.getMe();
        await sendRichMessage(
          chatId,
          ok(html`Бот работает!\n\n🤖 Бот: @${me.username}\n👤 Твой ID: ${formatId(user.telegramId)}\n👤 Твоя роль: ${user.role}`),
        );
      } catch (e) {
        await sendRichMessage(chatId, fail('Ошибка проверки статуса'));
      }
      break;

    default:
      await sendRichMessage(chatId, unknown('Неизвестная команда. Используй /help для справки.'));
  }
  } catch (e) {
    console.error(`[ERROR] Command ${cmd} failed:`, e);
    await sendRichMessage(chatId, fail(`Ошибка выполнения команды: ${e.description || e.message || 'Неизвестная ошибка'}`));
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

  await sendRichMessage(chatId, html`${answer}`);
}
