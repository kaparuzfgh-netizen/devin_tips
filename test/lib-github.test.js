import { describe, it, expect, beforeEach } from 'vitest';
import { getLatestCommits, createGitHubRelease, getDiff } from '../tgcloud/lib/github.js';
import { __onFetch, __resetFetch, fetchCalls } from './mocks/sdk.js';

beforeEach(__resetFetch);

const okJson = (data) => ({ ok: true, status: 200, json: async () => data });

describe('lib/github.js', () => {
  it('getLatestCommits hits the commits endpoint with per_page', async () => {
    __onFetch(() => okJson([{ sha: 'abc' }]));
    const commits = await getLatestCommits('owner', 'repo', 5);
    expect(commits).toEqual([{ sha: 'abc' }]);
    expect(fetchCalls[0].url).toBe('https://api.github.com/repos/owner/repo/commits?per_page=5');
  });

  it('getLatestCommits throws on non-ok response', async () => {
    __onFetch(() => ({ ok: false, status: 403 }));
    await expect(getLatestCommits('o', 'r')).rejects.toThrow('Failed to fetch commits');
  });

  it('createGitHubRelease posts with token auth', async () => {
    __onFetch(() => okJson({ id: 1 }));
    await createGitHubRelease('o', 'r', 'v1', 'Title', 'Body', 'TOKEN');
    expect(fetchCalls[0].url).toBe('https://api.github.com/repos/o/r/releases');
    expect(fetchCalls[0].opts.method).toBe('POST');
    expect(fetchCalls[0].opts.headers.Authorization).toBe('token TOKEN');
    const body = fetchCalls[0].opts.body;
    expect(body.value).toEqual({ tag_name: 'v1', name: 'Title', body: 'Body' });
  });

  it('createGitHubRelease throws on failure', async () => {
    __onFetch(() => ({ ok: false }));
    await expect(createGitHubRelease('o', 'r', 'v', 't', 'b', 'T')).rejects.toThrow('Failed to create release');
  });

  it('getDiff hits compare endpoint', async () => {
    __onFetch(() => okJson({ files: [] }));
    await getDiff('o', 'r', 'a', 'b', 'T');
    expect(fetchCalls[0].url).toBe('https://api.github.com/repos/o/r/compare/a...b');
    expect(fetchCalls[0].opts.headers.Authorization).toBe('token T');
  });

  it('getDiff throws on failure', async () => {
    __onFetch(() => ({ ok: false }));
    await expect(getDiff('o', 'r', 'a', 'b', 'T')).rejects.toThrow('Failed to get diff');
  });
});
