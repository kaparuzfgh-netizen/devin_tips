import { api } from 'sdk';
import { Html, esc, stripHtml } from './format.js';

export { formatId, formatCode } from './format.js';

// Helper for rich messages with monospace for IDs/code.
// Html content is sent as parse_mode 'HTML'; any other value is escaped and
// sent as HTML text — safe by default. On a 400 "can't parse entities" the
// message is retried once as stripped plain text.
export async function sendRichMessage(chatId, content, options = {}) {
  const safe = content instanceof Html ? content : new Html(esc(String(content)));
  const opts = {
    chat_id: chatId,
    text: String(safe),
    parse_mode: 'HTML',
    ...options,
  };
  try {
    return await api.sendMessage(opts);
  } catch (e) {
    const description = e?.description || e?.message || '';
    if (e?.code === 400 && /parse entities/i.test(description)) {
      const { parse_mode, ...plain } = opts;
      return await api.sendMessage({ ...plain, text: stripHtml(safe) });
    }
    throw e;
  }
}
