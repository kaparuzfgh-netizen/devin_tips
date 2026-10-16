# System Map - Devin Tips Bot

## Overview
Devin Tips Bot is a Telegram bot demonstrating vibecoding with Devin AI and Telegram Serverless capabilities. The bot publishes educational content about Devin, shows its own code, manages changelogs, and demonstrates advanced Telegram Bot API features.

## Architecture

### Telegram Serverless Platform
- **Runtime:** V8 isolate on Telegram infrastructure
- **Language:** JavaScript (ES modules)
- **Database:** Built-in SQLite
- **SDK:** `db`, `api`, `fetch`, `console`
- **Deployment:** `npx tgcloud push`
- **Cost:** Free

### Project Structure
```
vibebot/
├── tgcloud/              # Serverless code (deployed)
│   ├── schema.js         # Database schema
│   ├── lib/              # Shared modules
│   │   ├── auth.js       # Authentication & permissions
│   │   ├── content.js    # Content management
│   │   ├── channel.js    # Channel operations
│   │   ├── changelog.js  # Changelog management
│   │   ├── github.js     # GitHub integration
│   │   └── self.js       # Self-reference (code viewing)
│   └── handlers/         # Telegram update handlers
│       ├── message.js
│       ├── callback_query.js
│       ├── channel_post.js
│       └── message_reaction_count.js
├── docs/                 # Documentation
├── .tgcloud/             # CLI state (gitignored)
├── AGENTS.md             # AI assistant rules
├── SYSTEM_MAP.md         # This file
├── TASK_TRACKER.md       # Task tracking
├── DOCUMENT_CANON.md     # Technical specification
└── package.json
```

### Database Schema
- **users** - User management with roles (admin/user)
- **posts** - Content posts (educational, code examples, Q&A, auto)
- **conversations** - Q&A history
- **code_snippets** - Bot code for self-reference
- **changelog** - Product changelog entries
- **reaction_triggers** - Reaction-based automation
- **channel_settings** - Per-channel configuration

### Data Flow
1. User sends message → `handlers/message.js`
2. Handler processes command → calls lib modules
3. Lib modules interact with DB (`db`) or API (`api`)
4. Response sent back via `api.sendMessage`

### External Integrations
- **GitHub API** - For version control integration (via `fetch`)
- **Telegram Bot API** - Full access via SDK (`api`)
- **AI Service** - Free AI for content generation (planned)

## Limitations & Workarounds

### No Filesystem Access
- **Limitation:** Cannot read local files at runtime
- **Workaround:** Code snippets stored in SQLite DB, loaded manually
- **Module:** `lib/self.js`

### No npm Packages
- **Limitation:** Cannot install packages at runtime
- **Workaround:** Use built-in SDK (`db`, `api`, `fetch`)
- **Alternative:** External APIs via `fetch`

### Execution Time Limits
- **Limitation:** Short execution time per request
- **Workaround:** Keep operations lightweight, use DB for persistence

### No Foreign Keys
- **Limitation:** SQLite runs with FKs off
- **Workaround:** Enforce integrity in application code
- **Implementation:** Manual cleanup/verification

## Key Features

### 1. Educational Content
- Posts about Devin AI capabilities
- Code examples
- Q&A with users
- Daily changelog

### 2. Self-Reference
- Bot shows its own code
- Module browsing
- Code explanations

### 3. Channel Management
- Service message deletion
- Boost level monitoring
- Auto boost requests
- Reaction triggers

### 4. Change Tracking
- Daily changelog generation
- Publication to channel
- GitHub integration

## Deployment Pipeline
1. Edit code locally
2. `npx tgcloud push` - Deploy to cloud
3. `npx tgcloud migrate --yes` - Apply DB changes
4. Test in Telegram
5. Commit to GitHub

## Security
- Admin usernames hardcoded in `lib/auth.js`
- CLI token stored locally (`.tgcloud/`)
- Bot token managed via BotFather
- GitHub token for write operations (planned)
