# Devin Tips Bot

A Telegram bot demonstrating vibecoding with Devin AI and Telegram Serverless capabilities.

## Overview

Devin Tips Bot is a comprehensive Telegram bot that:
- Publishes educational content about Devin AI
- Shows its own code (self-reference)
- Manages daily changelogs
- Demonstrates advanced Telegram Bot API features
- Runs on Telegram's free Serverless infrastructure

## Features

### Core Functionality
- **Educational Posts** - Tips and tutorials about Devin AI
- **Code Examples** - Bot shows its own code with explanations
- **Q&A System** - Answers questions about vibecoding
- **Daily Changelog** - Product changelog published to @devin_tips

### Advanced Features
- **Channel Management**
  - Automatic service message deletion
  - Boost level monitoring
  - Auto boost requests
  - Reaction-based triggers

- **Change Tracking**
  - Daily changelog generation
  - GitHub integration
  - AI-assisted summaries (planned)

- **Self-Reference**
  - Bot code viewing
  - Module browsing
  - Code explanations

## Architecture

### Platform
- **Runtime:** Telegram Serverless (V8 isolate)
- **Language:** JavaScript (ES modules)
- **Database:** Built-in SQLite
- **Cost:** Free
- **Deployment:** `npx tgcloud push`

### Project Structure
```
vibebot/
├── tgcloud/              # Serverless code (deployed)
│   ├── schema.js         # Database schema
│   ├── lib/              # Shared modules
│   └── handlers/         # Telegram update handlers
├── docs/                 # Documentation
├── SYSTEM_MAP.md         # Architecture overview
├── TASK_TRACKER.md       # Task tracking
├── DOCUMENT_CANON.md     # Technical specification
└── AGENTS.md             # AI assistant rules
```

## Quick Start

### Prerequisites
- Node.js 18+
- Telegram account
- Bot created via @BotFather
- Serverless enabled in BotFather

### Installation

1. Clone the repository
```bash
git clone https://github.com/kaparuzfgh-netizen/devin_tips.git
cd devin_tips
```

2. Install dependencies
```bash
npm install
```

3. Link your bot
```bash
npx tgcloud login
```
Enter your CLI Access Token from @BotFather

4. Deploy
```bash
npx tgcloud push
npx tgcloud migrate --yes
```

## Usage

### User Commands
- `/start` - Introduction
- `/help` - Command reference
- `/posts` - List recent posts
- `/code <name>` - View bot code
- `/listcode` - List all modules
- `/ask <question>` - Ask a question
- `/get_channel_id @username` - Get channel ID

### Admin Commands
- `/changelog <changes>` - Add changelog entry
- `/publish_changelog <channel_id>` - Publish to channel
- `/channel_config <key> <value>` - Configure channel
- `/boost_request <level>` - Request boosts
- `/reaction_trigger <post_id> <count> <action>` - Create trigger

## Documentation

- [SYSTEM_MAP.md](SYSTEM_MAP.md) - Architecture overview
- [TASK_TRACKER.md](TASK_TRACKER.md) - Task tracking
- [DOCUMENT_CANON.md](DOCUMENT_CANON.md) - Technical specification
- [AGENTS.md](AGENTS.md) - AI assistant rules

## Limitations & Workarounds

### No Filesystem Access
**Problem:** Cannot read files at runtime
**Solution:** Code snippets stored in SQLite DB
**Trade-off:** Manual updates, but enables self-reference

### No npm Packages
**Problem:** Cannot install external libraries
**Solution:** Use built-in SDK (`db`, `api`, `fetch`)
**Trade-off:** Limited ecosystem, zero dependencies

### No Foreign Keys
**Problem:** SQLite runs with FKs disabled
**Solution:** Enforce integrity in application code
**Trade-off:** More code, platform-compliant

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) (to be created).

## License

MIT License - see LICENSE file

## Acknowledgments

- Telegram Serverless team
- Devin AI
- The vibecoding community

## Channel

Follow updates at: [@devin_tips](https://t.me/devin_tips)

## Support

For issues and questions, please use GitHub Issues.
