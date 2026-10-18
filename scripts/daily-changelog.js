#!/usr/bin/env node

/**
 * Daily Changelog Script for GitHub Action
 * Fetches commits from GitHub API and sends draft to admin via Telegram Bot API
 */

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Input parameters
const INPUT_DATE = process.env.INPUT_DATE; // Optional: YYYY-MM-DD
const INPUT_TEST = process.env.INPUT_TEST === 'true'; // Optional: test mode flag
const INPUT_SIMULATE_AI_FAILURE = process.env.INPUT_SIMULATE_AI_FAILURE === 'true'; // For Z5

if (!GITHUB_REPOSITORY || !GITHUB_TOKEN || !TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Calculate date window (yesterday 07:00 UTC to today 07:00 UTC)
function getDateWindow(inputDate) {
  const today = inputDate ? new Date(inputDate + 'T00:00:00Z') : new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Set times to 07:00 UTC
  const start = new Date(yesterday);
  start.setUTCHours(7, 0, 0, 0);

  const end = new Date(today);
  end.setUTCHours(7, 0, 0, 0);

  return { start, end, targetDate: yesterday };
}

// Fetch commits from GitHub API
async function fetchCommits(since, until) {
  const sinceStr = since.toISOString();
  const untilStr = until.toISOString();

  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/commits?since=${sinceStr}&until=${untilStr}&per_page=100`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const commits = await response.json();
  return commits;
}

// Filter commits (skip merge, docs:, chore:, [skip changelog])
function filterCommits(commits) {
  return commits.filter(commit => {
    const message = commit.commit.message || '';
    const firstLine = message.split('\n')[0];

    // Skip merge commits
    if (commit.parents && commit.parents.length > 1) {
      return false;
    }

    // Skip docs:, chore:
    if (firstLine.startsWith('docs:') || firstLine.startsWith('chore:')) {
      return false;
    }

    // Skip [skip changelog]
    if (firstLine.includes('[skip changelog]')) {
      return false;
    }

    return true;
  });
}

// Generate changelog text
function generateChangelog(commits, date, isTest) {
  if (commits.length === 0) {
    return null;
  }

  const lines = commits.map(commit => {
    const message = commit.commit.message || '';
    const firstLine = message.split('\n')[0];
    return `— ${firstLine}`;
  });

  let text = (isTest ? '[ТЕСТ] ' : '') + `Что нового за ${date}\n\n`;
  text += lines.join('\n');

  // Limit to 3500 characters
  const maxLength = 3500;
  if (text.length > maxLength) {
    let truncated = '';
    let totalLength = 0;
    let includedCount = 0;

    for (const line of lines) {
      if (totalLength + line.length + 1 > maxLength - 50) {
        // Not enough space for this line and "и ещё N изменений"
        break;
      }
      truncated += line + '\n';
      totalLength += line.length + 1;
      includedCount++;
    }

    const remaining = lines.length - includedCount;
    text = (isTest ? '[ТЕСТ] ' : '') + `Что нового за ${date}\n\n` + truncated;
    if (remaining > 0) {
      text += `\nи ещё ${remaining} изменений`;
    }
  }

  return text;
}

// Send message to Telegram
async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      text: text,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram API error: ${error.code} - ${error.description}`);
  }

  const result = await response.json();
  return result.result.message_id;
}

// Send message with inline keyboard
async function sendTelegramButtons(date, draftMessageId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      text: 'Опубликовать этот changelog?',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Опубликовать', callback_data: `pub:${date}:${draftMessageId}` },
            { text: '❌ Отклонить', callback_data: `rej:${date}` },
          ],
        ],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram API error: ${error.code} - ${error.description}`);
  }

  return response.json();
}

// Main function
async function main() {
  try {
    const { start, end, targetDate } = getDateWindow(INPUT_DATE);
    const dateStr = targetDate.toISOString().split('T')[0];

    console.log(`Fetching commits from ${start.toISOString()} to ${end.toISOString()}`);

    const commits = await fetchCommits(start, end);
    console.log(`Total commits: ${commits.length}`);

    const filtered = filterCommits(commits);
    console.log(`Filtered commits: ${filtered.length}`);

    if (filtered.length === 0) {
      console.log('No commits to process');
      return;
    }

    const changelog = generateChangelog(filtered, dateStr, INPUT_TEST);
    if (!changelog) {
      console.log('No changelog generated');
      return;
    }

    console.log('Sending draft to admin...');
    const draftMessageId = await sendTelegramMessage(changelog);
    console.log('Draft sent, message_id:', draftMessageId);

    console.log('Sending buttons...');
    await sendTelegramButtons(dateStr, draftMessageId);
    console.log('Buttons sent, ok');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
