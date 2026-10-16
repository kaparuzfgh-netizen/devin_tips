// lib/self — self-reference module for bot code
// Note: TG Serverless has no filesystem access at runtime
// Code snippets must be loaded manually or via external sources

import { storeCodeSnippet } from './content.js';

// Predefined code snippets (manually maintained)
// In production, these could be loaded from a remote source or updated via admin commands
export const botCodeSnippets = [
  {
    name: 'message_handler',
    description: 'Обработчик сообщений бота',
    code: `export default async function (message, ctx) {
  const chatId = message.chat.id;
  const text = message.text;

  // Обработка команд и вопросов
  await handleCommand(text, chatId);
};`,
    filePath: 'tgcloud/handlers/message.js',
    language: 'javascript',
  },
  {
    name: 'auth_module',
    description: 'Модуль аутентификации и прав',
    code: `export async function getOrCreateUser(telegramId, username) {
  let user = await db.select().from(users)
    .where(eq(users.telegramId, telegramId))
    .get();

  if (!user) {
    user = await db.insert(users)
      .values({ telegramId, username, role: 'user' })
      .returning()
      .run();
  }

  return user;
}`,
    filePath: 'tgcloud/lib/auth.js',
    language: 'javascript',
  },
];

// Initialize code snippets in database
export async function initializeCodeSnippets() {
  for (const snippet of botCodeSnippets) {
    await storeCodeSnippet(
      snippet.name,
      snippet.description,
      snippet.code,
      snippet.filePath,
      snippet.language
    );
  }
}
