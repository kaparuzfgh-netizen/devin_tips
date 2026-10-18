# Devin Tips Bot

Telegram-бот на Telegram Serverless, публикующий ежедневный changelog в канал @devin_tips.

## Обзор

Бот демонстрирует возможности вайбкодинга на Telegram Serverless — бесплатной платформе для Telegram-ботов. Главная функция: ежедневная публикация changelog с подтверждением админа.

## Архитектура

### Платформа
- **Runtime:** Telegram Serverless (V8 isolate)
- **Language:** JavaScript (ES modules)
- **Database:** Built-in SQLite
- **Cost:** Free
- **Deployment:** `npx tgcloud push`

### Структура проекта
```
devin_tips/
├── tgcloud/              # Код для облака (деплоится)
│   ├── schema.js         # Схема БД
│   ├── lib/              # Общие модули
│   │   ├── auth.js       # Аутентификация и права
│   │   ├── channel.js    # Операции с каналами, триггеры реакций
│   │   ├── changelog.js  # Управление changelog (старая схема)
│   │   ├── content.js    # Посты и сниппеты кода
│   │   ├── github.js     # GitHub API (не используется)
│   │   ├── message.js    # sendRichMessage, formatId, formatCode
│   │   ├── openai.js     # AI-summary (см. docs/KNOWN_ISSUES.md, KI-003)
│   │   └── self.js       # Статичные сниппеты (не используется)
│   └── handlers/         # Обработчики Telegram-обновлений
│       ├── message.js            # Команды + свободный текст
│       ├── callback_query.js     # Кнопки «Опубликовать/Отклонить»
│       ├── my_chat_member.js     # Привязка channel_id
│       ├── channel_post.js       # Сервисные сообщения, реакции
│       └── message_reaction_count.js
├── scripts/              # Скрипты для GitHub Actions (не деплоится)
│   └── daily-changelog.js        # Коммиты → черновик админу
├── test/                 # Vitest-тесты и моки sdk (не деплоится)
├── docs/                 # Документация
├── .github/workflows/    # daily-changelog.yml + check.yml (quality gate)
├── AGENTS.md             # Единый файл правил для ИИ-агента
├── SYSTEM_MAP.md         # Карта модулей, статусы Frozen/Core
└── TASK_TRACKER.md       # Трекер задач
```

### Схема БД
- **users** — пользователи с ролями (admin/user)
- **changelog** — записи changelog
- **daily_posts** — ежедневные посты со статусом (published/rejected)
- **channel_settings** — настройки канала (ID канала)
- **posts** — контентные посты (для будущего)
- **conversations** — Q&A диалоги (для будущего)
- **code_snippets** — код бота для самоссылки (для будущего)
- **reaction_triggers** — триггеры по числу реакций

### Поток данных (целевая схема)
1. GitHub Action запускается ежедневно в 07:00 UTC (12:00 Asia/Almaty)
2. Action берёт коммиты за сутки через GitHub API
3. Groq генерирует связный текст (или запасной вариант — простой список)
4. Action отправляет черновик админу в личку через Bot API
5. Админ нажимает «Опубликовать» → бот копирует сообщение в канал
6. Бот записывает дату как опубликованную

### Ограничения платформы
- **Нет доступа к файлам** — код snippets хранится в SQLite
- **Нет npm-пакетов** — только встроенный SDK (`db`, `api`, `fetch`)
- **Нет внешних ключей** — целостность БД enforced в коде
- **Нет планировщика** — используется GitHub Actions
- **Нет хранилища секретов** — секреты в GitHub Secrets

## Где что хранится

**Секреты (в GitHub Secrets):**
- `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather
- `GROQ_API_KEY` — ключ Groq для генерации текста

**Переменные (в GitHub Variables):**
- `ADMIN_CHAT_ID` — числовой ID чата админа в Telegram

**В БД бота:**
- ID канала @devin_tips (таблица `channel_settings`)
- Статусы ежедневных постов (таблица `daily_posts`)

**В самом боте секретов нет.**

## Быстрый старт

### Требования
- Node.js 18+
- Telegram-аккаунт
- Бот создан через @BotFather
- Serverless включён в @BotFather

### Установка

1. Клонирование репозитория
```bash
git clone https://github.com/kaparuzfgh-netizen/devin_tips.git
cd devin_tips
```

2. Установка зависимостей
```bash
npm install
```

3. Подключение бота
```bash
npx tgcloud login
```
Введи CLI Access Token от @BotFather

4. Деплой
```bash
npx tgcloud push
npx tgcloud migrate --yes
```

## Команды

### Пользовательские
- `/start` — Приветствие
- `/help` — Справка по командам
- `/status` — Статус бота и роль пользователя
- `/posts` — Последние опубликованные посты
- `/code <name>` — Показать код бота
- `/listcode` — Список модулей
- `/ask <вопрос>` — Задать вопрос
- `/get_channel_id` — Показать сохранённые ID каналов
- `/my_channels` — Справка по привязке канала

### Админские
- `/changelog <категория>: <текст>` — Запись в changelog (старая схема, заменена кнопками)
- `/publish_changelog <channel_id>` — Публикация changelog (старая схема)
- `/channel_config <key> <value>` — Настройки канала
- `/boost_request <level>` — Запрос бустов
- `/reaction_trigger <post_id> <count> <action>` — Триггер реакций
- `/set_openai_key <key>` — Ключ для AI summary
- `/ai_summary` — Сгенерировать AI summary
- `/clean_daily_posts` — Очистить daily_posts (тестовая)

> Внимание: у части админ-команд есть известная ошибка — см. `docs/KNOWN_ISSUES.md`, KI-002.

## Планы

Полная стратегия развития в [docs/VISION.md](docs/VISION.md). Кратко:

- **Этап 1 (MVP):** Ежедневный changelog с ручным подтверждением
- **Этап 2:** Автоматическая публикация и сигнал о сбое
- **Этап 3:** Сбор новостей, Q&A, показ кода
- **Этап 4:** Управление каналом (удаление сервисных сообщений, бусты)
- **Этап 5:** Mini App, аналитика, мультибот

## Проверки

```bash
npm run check    # lint + typecheck + тесты — единая команда верификации
```

Тесты: Vitest, `test/**/*.test.js`. Облачный `sdk` (БД, Telegram API, HTTP) замокан —
реальные сервисы и секреты не нужны. То же самое гоняет CI (`.github/workflows/check.yml`)
на каждый push и PR.

## Документация

- [AGENTS.md](AGENTS.md) — Единый файл правил для ИИ-ассистента
- [SYSTEM_MAP.md](SYSTEM_MAP.md) — Карта модулей и статусы Frozen/Core
- [VISION.md](docs/VISION.md) — Стратегия развития
- [TASK_TRACKER.md](TASK_TRACKER.md) — Трекер задач
- [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md) — Документация SDK
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — Известные проблемы

## License

MIT License — см. файл LICENSE

## Канал

Подписывайся: [@devin_tips](https://t.me/devin_tips)

## Поддержка

Для вопросов и проблем используй GitHub Issues.
