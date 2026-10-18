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

---

## KI-002: Все админ-команды падают с `chat_id is not defined` (аудит, B13)

**Дата:** 2026-10-19
**Источник:** аудит контура надёжности + regression-тесты
**Статус:** FIXED — `fix: chat_id shortcut in admin handlers (KI-002)`;
29 мест `{ chat_id,` → `{ chat_id: chatId,` в `tgcloud/handlers/message.js`;
8 тестов сняты с `it.fails`; ESLint `no-undef` включён обратно.

### Наблюдаемое поведение
В `tgcloud/handlers/message.js` функция `handleCommand` объявлена с параметром `chatId`,
но ветки админ-команд вызывают `api.sendMessage({ chat_id, ... })` — шортхенд для
несуществующей переменной `chat_id`. Это `ReferenceError`, которое проглатывается общим
`try/catch` → пользователь видит только «❌ Ошибка выполнения команды: chat_id is not defined».

### Затронуто
Все ветки с шортхендом `{ chat_id, ... }`: `/clean_daily_posts`, `/changelog`,
`/publish_changelog`, `/channel_config`, `/boost_request`, `/reaction_trigger`,
`/set_openai_key`, `/ai_summary`, часть `/my_channels` и catch-ветка `/status`.
Включая ответы «Только для админов» внутри этих команд — то есть отказ тоже не доходит.

### Доказательство
`npm run test` — 13 тестов помечены `it.fails` и фиксируют это поведение (8 из них —
KI-002, после фикса стали обычными `it`).
`tsc --checkJs` над tgcloud/ выдавал `TS2552: Cannot find name 'chat_id'` (~29 мест).
ESLint правило `no-undef` было отключено в `.eslintrc.json` — поэтому баг прошёл gate;
после фикса правило включено (`"no-undef": "error"`).

### Связанное правило
Правило платформы (`docs/tgcloud-rules.md`) прямо предупреждало про путаницу
`chat_id`/`chatId` — предупреждение оправдалось. Gate не ловил, потому что
`no-undef` выключен.

---

## KI-003: lib/openai.js зовёт api.openai.com с именем Groq-модели (аудит, B1)

**Статус:** CONFIRMED (тест `it.fails`: "calls the Groq endpoint")
`OPENAI_API_URL = https://api.openai.com/v1/chat/completions`, `MODEL = 'openai/gpt-oss-120b'`
(Groq-имя модели). Цель проекта и секрет — Groq (`GROQ_API_KEY`). Запросы к api.openai.com
с такой моделью падают. Дополнительно: ключ хранится в `channel_settings.openai_api_key`
(БД бота) — противоречит правилу «секреты только в GitHub Secrets».
Также `setOpenaiApiKey` при пустой таблице вставляет строку с `channelId: 1` (B2).

## KI-005: Миграция на sendRichMessage (WRITTEN, не проверено в живом Telegram)

**Статус:** WRITTEN — тесты зелёные, живой проверки в Telegram ещё не было.
Весь код `tgcloud/` теперь шлёт через `sendRichMessage` (Markdown) с `escapeMd()` для
динамического текста и повтором обычным текстом при 400 «parse entities».
Затронуты Frozen `lib/message.js` и Core-хендлеры — по прямому решению владельца.
Для VERIFIED: в Telegram пройти `/start`, `/status`, `/code`, `/changelog`, кнопки `pub:`/`rej:`
и убедиться, что сообщения со спецсимволами (`_`, `*`) доходят.
Остался за границей миграции: `scripts/daily-changelog.js` (нативный fetch, без parse_mode).

**Регрессия, найденная при живой проверке (исправлена):** в `/start` и `/help` команды с `_`
(`/get_channel_id`, `/my_channels`, `/publish_changelog` …) потеряли подчёркивания, а админский блок стал
курсивом — константные тексты не экранировались, `escapeMd()` стоял только на динамике.
Исправлено: статические тексты со спецсимволами обёрнуты в `escapeMd()` (коммит
«fix: escape static Markdown chars in bot texts»); добавлен тест-замок на неэкранированный `_`
в `/start` и `/help`. Урок: при `parse_mode: Markdown` экранировать нужно и статические тексты.

## KI-004: Прочие находки аудита (не исправлены)

- **B3** `lib/content.js getPublishedPosts(type)`: второй `.where()` может отбрасываться
  builder'ом — фильтр по типу молча игнорируется. Проверить на платформе.
- **B4** `decidedAt`/`publishedAt`/`updatedAt` пишутся как `Date.now()/1000` (число), а колонки
  `mode:'timestamp'` ожидают `Date` — по SDK-доке значение может сохраниться сырым float.
- **B5** `handlers/channel_post.js`: проверка `channel_post.reaction_count` — мёртвая ветка,
  в этом типе апдейта поля нет.
- **B6** `handlers/my_chat_member.js`: `update` ставит `channelId` самому себе — no-op.
- **B7** `/channel_config`, `/reaction_trigger`, `/boost_request` используют `chatId`
  (личку админа) как `channelId` — настройки пишутся на мусорную строку.
- **B8** `channel_post.js`, `message_reaction_count.js`, `my_chat_member.js` — нет общего
  `try/catch` и входного `console.log`, требование правила платформы (`docs/tgcloud-rules.md`).
- **B9** `INPUT_SIMULATE_AI_FAILURE` в `scripts/daily-changelog.js` читается, но не используется.
- **B10** Незакоммиченные правки в рабочей копии (`callback_query.js`, `message.js`)
  на момент аудита — решить: закоммитить или откатить.
- **B11** `checkReactionTriggers` игнорирует `trigger.postId`: реакция на любой пост
  проверяется против всех триггеров канала — триггер поста A срабатывает от поста B.
  Тест `it.fails` в `test/lib-channel.test.js`.
- **B12** `getChangelog(date)` использует `.get()` — вернёт одну строку, хотя записей
  на дату может быть несколько. Тест `it.fails` в `test/lib-changelog.test.js`.
- **B14** `.github/workflows/daily-changelog.yml` без блока `permissions:` — GITHUB_TOKEN
  получает широкие дефолтные права (правило требует минимальные).
- **B15** Мёртвый код: `lib/github.js`, `lib/self.js` нигде не импортируются.
