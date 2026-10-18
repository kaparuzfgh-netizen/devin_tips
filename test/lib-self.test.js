import { describe, it, expect, vi } from 'vitest';

vi.mock('../tgcloud/lib/content.js', () => ({
  storeCodeSnippet: vi.fn(async () => ({ id: 1 })),
}));

import { botCodeSnippets, initializeCodeSnippets } from '../tgcloud/lib/self.js';
import { storeCodeSnippet } from '../tgcloud/lib/content.js';

describe('lib/self.js', () => {
  it('botCodeSnippets entries have all required fields', () => {
    expect(botCodeSnippets.length).toBeGreaterThan(0);
    for (const s of botCodeSnippets) {
      expect(s).toMatchObject({
        name: expect.any(String),
        code: expect.any(String),
        filePath: expect.any(String),
        language: expect.any(String),
      });
    }
  });

  it('initializeCodeSnippets stores every snippet', async () => {
    await initializeCodeSnippets();
    expect(storeCodeSnippet).toHaveBeenCalledTimes(botCodeSnippets.length);
    expect(storeCodeSnippet).toHaveBeenCalledWith(
      botCodeSnippets[0].name,
      botCodeSnippets[0].description,
      botCodeSnippets[0].code,
      botCodeSnippets[0].filePath,
      botCodeSnippets[0].language,
    );
  });
});
