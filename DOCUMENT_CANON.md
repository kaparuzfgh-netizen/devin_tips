# Document Canon - Technical Specification

## Project: Devin Tips Bot

### Executive Summary
Devin Tips Bot is a demonstration project showcasing the capabilities of:
1. **Vibecoding with Devin AI** - AI-assisted software development
2. **Telegram Serverless** - Official Telegram infrastructure for bot hosting
3. **Modern Bot Development** - Full-featured Telegram bot with advanced features

### Primary Goals

#### 1. Educational Demonstration
Showcase what's possible with:
- Telegram Serverless platform
- AI-assisted development workflow
- Modern bot architecture
- Workarounds for platform limitations

#### 2. Content Platform
Create a hub for:
- Devin AI tips and tutorials
- Code examples and explanations
- Q&A about vibecoding
- Daily project changelogs

#### 3. Technical Exploration
Explore and document:
- Serverless architecture patterns
- Database design without filesystem
- API integration strategies
- Automation workflows

## Technical Requirements

### Platform Constraints
- **Runtime:** Telegram Serverless (V8 isolate)
- **Language:** JavaScript (ES modules)
- **Database:** SQLite (built-in)
- **Filesystem:** No access at runtime
- **Packages:** No npm at runtime
- **Execution:** Time-limited per request

### Functional Requirements

#### Core Features
1. **User Management**
   - Automatic user registration
   - Role-based permissions (admin/user)
   - Username-based admin assignment

2. **Content System**
   - Educational posts about Devin
   - Code examples with explanations
   - Q&A with users
   - Self-reference (bot shows its own code)

3. **Channel Management**
   - Service message deletion
   - Boost level monitoring
   - Automatic boost requests
   - Reaction-based triggers

4. **Changelog System**
   - Daily changelog generation
   - Publication to @devin_tips channel
   - GitHub integration
   - AI-assisted summaries

5. **GitHub Integration**
   - Commit tracking
   - Release creation
   - Diff viewing
   - Version control

### Non-Functional Requirements

#### Performance
- Response time < 1s for most operations
- Handle concurrent users efficiently
- Minimal database queries per request

#### Reliability
- Automatic error handling
- Graceful degradation
- No data loss during migrations

#### Security
- Admin-only operations protected
- Token management (CLI, bot, GitHub)
- No sensitive data in logs

#### Maintainability
- Clear code structure
- Comprehensive documentation
- Version control via GitHub

## Architecture Decisions

### Why Telegram Serverless?
- **Free hosting** - No server costs
- **Official infrastructure** - Reliable and maintained
- **Built-in features** - DB, Bot API, HTTP client
- **Fast execution** - ~200ms startup time
- **Auto-scaling** - No capacity planning

### Workarounds for Limitations

#### No Filesystem Access
**Problem:** Cannot read code files at runtime
**Solution:** Store code snippets in SQLite DB
**Module:** `lib/self.js`
**Trade-off:** Manual code updates, but enables self-reference

#### No npm Packages
**Problem:** Cannot install external libraries
**Solution:** Use built-in SDK (`db`, `api`, `fetch`)
**Trade-off:** Limited ecosystem, but zero dependencies

#### No Foreign Keys
**Problem:** SQLite runs with FKs disabled
**Solution:** Enforce integrity in application code
**Trade-off:** More code, but consistent with platform

## Data Model

### Entities
- **User** - Telegram user with role
- **Post** - Content with type, status, metadata
- **Conversation** - Q&A history
- **CodeSnippet** - Bot code for self-reference
- **Changelog** - Product changes
- **ReactionTrigger** - Automation rules
- **ChannelSettings** - Per-channel config

### Relationships
- User → Posts (created_by)
- User → Conversations (user_id)
- Channel → Settings (1:1)
- Channel → ReactionTriggers (1:N)

## API Design

### Telegram Commands
- `/start` - Introduction
- `/help` - Command reference
- `/posts` - List posts
- `/code <name>` - View code
- `/listcode` - List modules
- `/ask <question>` - Q&A
- `/get_channel_id @username` - Get channel ID

### Admin Commands
- `/changelog <changes>` - Add changelog entry
- `/publish_changelog <channel_id>` - Publish to channel
- `/channel_config <key> <value>` - Configure channel
- `/boost_request <level>` - Request boosts
- `/reaction_trigger <post_id> <count> <action>` - Create trigger

### Handlers
- `message.js` - Text messages and commands
- `callback_query.js` - Button clicks
- `channel_post.js` - Channel posts
- `message_reaction_count.js` - Reaction updates

## Deployment Strategy

### Development Workflow
1. Edit code locally
2. Test with `npx tgcloud run`
3. Deploy with `npx tgcloud push`
4. Migrate DB with `npx tgcloud migrate --yes`
5. Test in Telegram
6. Commit to GitHub

### CI/CD (Future)
- GitHub Actions for automated testing
- Auto-deployment on push to main
- Automated changelog generation
- Release creation

## Success Metrics

### Technical
- Deployment success rate: 100%
- Response time: < 1s
- Uptime: 99.9% (platform dependent)

### Content
- Posts published: Daily
- Changelog accuracy: Complete
- Code examples: Comprehensive

### User Engagement
- Active users: Growing
- Questions answered: Timely
- Channel growth: Positive

## Future Roadmap

### Short-term (1-2 weeks)
- Complete documentation
- Implement AI integration
- Refine changelog system
- Add GitHub automation

### Medium-term (1-2 months)
- Content management interface
- Advanced channel features
- Analytics dashboard
- Scheduling system

### Long-term (3-6 months)
- Multi-bot support
- Web Mini App
- Advanced AI features
- Community contributions

## Risk Assessment

### Technical Risks
- **Platform changes** - Telegram Serverless is new
  - Mitigation: Stay updated, adapt quickly
- **Execution limits** - Time/size constraints
  - Mitigation: Optimize operations, use DB for state

### Project Risks
- **Scope creep** - Too many features
  - Mitigation: Prioritize, phase releases
- **Documentation burden** - Keeping docs current
  - Mitigation: Docs-as-code, automate where possible

## Compliance & Ethics

### Data Privacy
- No personal data stored beyond Telegram ID/username
- Clear data retention policy
- User can request data deletion

### Open Source
- Code will be public on GitHub
- MIT License
- Contribution guidelines

### Transparency
- All limitations documented
- Workarounds explained
- Honest about capabilities

## Conclusion

Devin Tips Bot serves as both a functional product and a technical demonstration. It showcases modern bot development practices while providing genuine value to the Devin AI community. The project embraces platform limitations rather than fighting them, demonstrating creative problem-solving in constrained environments.

**Target Audience:**
- Developers interested in Telegram Serverless
- Devin AI users seeking tips
- Vibecoding practitioners
- Open source contributors

**Success Definition:**
- Educational value demonstrated
- Community engagement achieved
- Technical patterns documented
- Sustainable maintenance model established
