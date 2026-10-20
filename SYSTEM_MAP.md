# SYSTEM_MAP — карта модулей по реальному коду

Статусы компонентов:
- **Frozen** — работает, используется, не менялся недавно. Не трогать без прямого запроса владельца.
- **Core** — критичный узел живого MVP-контура. Правки только по задаче из трекера и с зелёным `npm run check`.
- без статуса — обычный код; мёртвый код помечен отдельно.

Подтверждено владельцем 2026-10-19.

## Потоки данных

### Daily changelog (текущая цель, MVP)
```
GitHub Actions cron 16:17 UTC = 19:17 МСК (.github/workflows/daily-changelog.yml)
  → scripts/daily-changelog.js          [Core]
      → GitHub API: коммиты за сутки → фильтр (merge/docs:/chore:/[skip changelog])
      → Telegram Bot API: черновик админу с кнопками pub:/rej:
  → handlers/callback_query.js          [Core]
      → pub: sendRichMessage в канал + insert daily_posts(status='published')
      → rej: insert daily_posts(status='rejected')
```
Текст черновика — Groq (`GROQ_API_KEY`, T5); при любой ошибке и без ключа —
запасной простой список коммитов. Старый `lib/openai.js` не задействован, см. KI-003.

### Привязка канала
```
update my_chat_member (бот стал админом канала)
  → handlers/my_chat_member.js          [Frozen]
      → channel_settings.channelId       (T2 VERIFIED)
```

### Команды
```
update message → handlers/message.js    [Core]
  → lib/auth.js getOrCreateUser         [Core] — регистрация/роли
  → handleCommand → lib/content.js, lib/changelog.js, lib/channel.js,
                    lib/openai.js, lib/message.js
  → handleQuestion → заготовка ответов
```

### Сервисные функции канала
```
update channel_post           → handlers/channel_post.js → lib/channel.js
update message_reaction_count → handlers/message_reaction_count.js → lib/channel.js
```

## Реестр модулей

| Файл | Зона ответственности | Статус | Зависит от |
|---|---|---|---|
| `tgcloud/schema.js` | Схема БД: users, posts, conversations, code_snippets, changelog, reaction_triggers, channel_settings, daily_posts | Core | sdk/db |
| `handlers/message.js` | Роутинг всех команд (17) + свободный текст | Core; KI-002 | auth, content, channel, changelog, openai, message, schema |
| `handlers/callback_query.js` | Кнопки pub:/rej: — публикация/отклонение черновика | Core | auth, schema, api |
| `handlers/my_chat_member.js` | Сохранение channel_id при выдаче админки | Frozen | schema |
| `handlers/channel_post.js` | Удаление сервисных сообщений, триггеры реакций | — (KI-004/B5) | channel, schema |
| `handlers/message_reaction_count.js` | Делегирует в checkReactionTriggers | — (KI-004/B8) | channel |
| `lib/auth.js` | getOrCreateUser, isAdmin, hasPermission; whitelist ADMIN_IDS + legacy usernames | Core | schema |
| `lib/channel.js` | Настройки канала, удаление сервисных, бусты, триггеры реакций | — (KI-004/B7,B11) | schema, api |
| `lib/changelog.js` | Старая схема changelog (команды ЗАМЕНЕНО, код не удалять) + generateDailySummary | — | schema, api, openai |
| `lib/content.js` | CRUD постов и сниппетов кода | — (KI-004/B3) | schema |
| `lib/commands.js` | Реестр команд (listed/hidden), источник для /start, /help и текста BotFather; тест сверяет с `handlers/message.js` | — | — |
| `lib/message.js` | sendRichMessage (parse_mode HTML, обычная строка экранируется, повтор plain при 400 parse entities), реэкспорт formatId/formatCode | Frozen (изменён по решению владельца, KI-005/KI-006) | api, format |
| `lib/format.js` | Фикстуры оформления HTML: html-шаблон, header/list/footer/tags, ok/fail/empty, changelogPost/draftPost, stripHtml (чистый, без sdk) | — (KI-006) | — |
| `lib/openai.js` | AI-summary через OpenAI-совместимый endpoint | — (KI-003) | schema, fetch |
| `lib/github.js` | GitHub API (commits/releases/diff) | мёртвый код | fetch |
| `lib/self.js` | Статичные сниппеты кода бота | мёртвый код | content |
| `scripts/daily-changelog.js` | Сбор коммитов + черновик админу: текст от Groq, при сбое — простой список (job, не деплоится) | Core | GitHub API, Groq API, Bot API |
| `.github/workflows/daily-changelog.yml` | cron 16:17 UTC (19:17 МСК) + ручной запуск | Core | scripts/ |
| `.github/workflows/check.yml` | Quality gate: npm run check на push/PR | — | — |
| `test/` | Vitest + моки sdk (db/api/fetch), regression lock | — | tgcloud/, scripts/ |

## Границы и секреты
- Секреты: GitHub Secrets (`TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY`), переменная `ADMIN_CHAT_ID`.
  Исключение-нарушение: `channel_settings.openai_api_key` в БД бота (KI-003).
- `endpoints/` не существует — Mini App нет.
- Планировщика в платформе нет — расписание живёт в GitHub Actions.
