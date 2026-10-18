import { api } from 'sdk';

// Escape legacy-Markdown special chars in dynamic text (user input, DB
// values, error messages) before it goes through sendRichMessage.
export function escapeMd(text) {
  return String(text ?? '').replace(/([_*`[])/g, '\\$1');
}

// Helper for rich messages with monospace for IDs/code
export async function sendRichMessage(chatId, text, options = {}) {
  const opts = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
    ...options,
  };
  try {
    return await api.sendMessage(opts);
  } catch (e) {
    const description = e?.description || e?.message || '';
    if (e?.code === 400 && /parse entities/i.test(description)) {
      const { parse_mode, ...plain } = opts;
      return await api.sendMessage(plain);
    }
    throw e;
  }
}

// Format ID for easy copying (monospace)
export function formatId(id) {
  return `\`${id}\``;
}

// Format code block for easy copying
export function formatCode(code, language = '') {
  if (language) {
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }
  return `\`\`\`\n${code}\n\`\`\``;
}
