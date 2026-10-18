import { api } from 'sdk';
import { Html, stripHtml } from './format.js';

// Escape legacy-Markdown special chars in dynamic text (user input, DB
// values, error messages) before it goes through sendRichMessage.
export function escapeMd(text) {
  return String(text ?? '').replace(/([_*`[])/g, '\\$1');
}

// Helper for rich messages with monospace for IDs/code.
// Dual mode during the HTML migration: Html content is sent with
// parse_mode 'HTML'; plain strings keep the legacy Markdown behavior.
export async function sendRichMessage(chatId, content, options = {}) {
  if (content instanceof Html) {
    const opts = {
      chat_id: chatId,
      text: String(content),
      parse_mode: 'HTML',
      ...options,
    };
    try {
      return await api.sendMessage(opts);
    } catch (e) {
      const description = e?.description || e?.message || '';
      if (e?.code === 400 && /parse entities/i.test(description)) {
        const { parse_mode, ...plain } = opts;
        return await api.sendMessage({ ...plain, text: stripHtml(content) });
      }
      throw e;
    }
  }
  const opts = {
    chat_id: chatId,
    text: content,
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
