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
│   │   ├── channel.js    # Операции с каналами
│   │   └── changelog.js  # Управление changelog
│   └── handlers/         # Обработчики Telegram-обновлений
│       ├── message.js
│       ├── callback_query.js
│       └── my_chat_member.js
├── scripts/              # Скрипты для GitHub Actions
├── docs/                 # Документация
├── .github/workflows/    # GitHub Actions
├── AGENTS.md             # Правила для ИИ-ассистента
├── TASK_TRACKER.md       # Трекер задач
└── VISION.md             # Стратегия развития
```

### Схема БД
- **users** — пользователи с ролями (admin/user)
- **changelog** — записи changelog
- **daily_posts** — ежедневные посты со статусом (published/rejected)
- **channel_settings** — настройки канала (ID канала)
- **code_snippets** — код бота для самоссылки (для будущего)

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

### Админские
- `/get_channel_id @username` — Получить ID канала

## Планы

Полная стратегия развития в [docs/VISION.md](docs/VISION.md). Кратко:

- **Этап 1 (MVP):** Ежедневный changelog с ручным подтверждением
- **Этап 2:** Автоматическая публикация и сигнал о сбое
- **Этап 3:** Сбор новостей, Q&A, показ кода
- **Этап 4:** Управление каналом (удаление сервисных сообщений, бусты)
- **Этап 5:** Mini App, аналитика, мультибот

## Документация

- [VISION.md](docs/VISION.md) — Стратегия развития
- [TASK_TRACKER.md](TASK_TRACKER.md) — Трекер задач
- [AGENTS.md](AGENTS.md) — Правила для ИИ-ассистента
- [docs/tgcloud-sdk.md](docs/tgcloud-sdk.md) — Документация SDK
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — Известные проблемы

## License

MIT License — см. файл LICENSE

## Канал

Подписывайся: [@devin_tips](https://t.me/devin_tips)

## Поддержка

Для вопросов и проблем используй GitHub Issues.
