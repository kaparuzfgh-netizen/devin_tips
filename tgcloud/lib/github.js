import { fetch } from 'sdk';

export async function getLatestCommits(owner, repo, limit = 10) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch commits');
  return await res.json();
}

export async function createGitHubRelease(owner, repo, tag, title, body, token) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: fetch.body.json({ tag_name: tag, name: title, body }),
  });
  if (!res.ok) throw new Error('Failed to create release');
  return await res.json();
}

export async function getDiff(owner, repo, base, head, token) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`, {
    headers: {
      'Authorization': `token ${token}`,
    },
  });
  if (!res.ok) throw new Error('Failed to get diff');
  return await res.json();
}
