import { api } from 'sdk';

// Helper for rich messages with monospace for IDs/code
export async function sendRichMessage(chatId, text, options = {}) {
  const opts = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
    ...options,
  };
  return await api.sendMessage(opts);
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
