// Command registry — the single source of truth for what /start, /help and
// BotFather /setcommands advertise. Hidden commands still work in the handler;
// they are simply not listed until their `reason` is resolved.

export const COMMANDS = [
  // Public, listed
  { cmd: '/start', desc: 'Начать работу', scope: 'public' },
  { cmd: '/help', desc: 'Справка', scope: 'public' },
  { cmd: '/status', desc: 'Проверить, что бот работает', scope: 'public' },
  { cmd: '/get_channel_id', desc: 'Показать сохранённые ID каналов', scope: 'public' },
  // Admin, listed
  { cmd: '/my_channels', desc: 'Как привязать канал', scope: 'admin' },
  { cmd: '/clean_daily_posts', desc: 'Очистить тестовые записи daily_posts', scope: 'admin' },
  // Hidden — still work, just not advertised
  { cmd: '/posts', desc: 'Показать последние посты', scope: 'public', hidden: true, reason: 'нет источника постов, backlog' },
  { cmd: '/code', args: '[name]', desc: 'Показать код бота', scope: 'public', hidden: true, reason: 'код бота не загружен, backlog' },
  { cmd: '/listcode', desc: 'Список всех модулей', scope: 'public', hidden: true, reason: 'код бота не загружен, backlog' },
  { cmd: '/ask', args: '<вопрос>', desc: 'Задать вопрос', scope: 'public', hidden: true, reason: 'заглушка, backlog Q&A' },
  { cmd: '/changelog', args: '<категория>: <изменения>', desc: 'Добавить запись в changelog', scope: 'admin', hidden: true, reason: 'заменено новой схемой, TASK_TRACKER' },
  { cmd: '/publish_changelog', args: '<channel_id>', desc: 'Опубликовать changelog', scope: 'admin', hidden: true, reason: 'заменено новой схемой, TASK_TRACKER' },
  { cmd: '/ai_summary', desc: 'Сгенерировать AI summary', scope: 'admin', hidden: true, reason: 'заменено новой схемой, TASK_TRACKER' },
  { cmd: '/channel_config', args: '<key> <value>', desc: 'Настройка канала', scope: 'admin', hidden: true, reason: 'KI-004/B7' },
  { cmd: '/boost_request', args: '<level>', desc: 'Запрос бустов', scope: 'admin', hidden: true, reason: 'KI-004/B7' },
  { cmd: '/reaction_trigger', args: '<post_id> <count> <action>', desc: 'Создать триггер реакций', scope: 'admin', hidden: true, reason: 'KI-004/B7' },
  { cmd: '/set_openai_key', args: '<key>', desc: 'Установить OpenAI API ключ', scope: 'admin', hidden: true, reason: 'KI-003/B1' },
];

export function listedCommands(scope) {
  return COMMANDS.filter((c) => c.scope === scope && !c.hidden);
}

export function botfatherCommands() {
  return listedCommands('public')
    .map((c) => `${c.cmd.slice(1)} - ${c.desc}`)
    .join('\n');
}
