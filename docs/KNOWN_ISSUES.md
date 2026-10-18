# KNOWN_ISSUES

Отслеживаемые проблемы и их решения.

## KI-001: `/get_channel_id @devin_tips` не работает

**Дата:** 2026-10-16
**Команда:** `/get_channel_id @devin_tips`
**Статус:** WORKAROUND

### Наблюдаемое поведение
Команда не может получить ID канала по @username.

### Точный текст ошибки
Из логов пользователя: `❌ Не удалось получить ID канала. Возможные причины: Bot is not added to the channel, Channel is private (no username), Incorrect username`

**Примечание:** Точный код ошибки API (400/403) из логов Telegram Serverless недоступен - console.log виден только при локальном запуске через `npx tgcloud run`, а не в production.

### Контекст
- Бот добавлен в канал @devin_tips как админ (утверждается владельцем)
- Канал публичный (https://t.me/devin_tips)
- Команда `/status` показывает что бот работает и пользователь admin

### Решение (WORKAROUND)
ID канала получен через событие `my_chat_member` при добавлении бота в канал.
Доказательство: команда `/get_channel_id` показывает сохранённый ID `-1003747058496`.
Handler `my_chat_member` работает и сохраняет ID автоматически.

### Первопричина
Неизвестна. Telegram Bot API может не поддерживать поиск канала по username в текущей версии Serverless SDK.
