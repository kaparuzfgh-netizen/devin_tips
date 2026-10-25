import { describe, it, expect } from 'vitest';
import { VERSION } from '../tgcloud/lib/version.js';

describe('lib/version.js', () => {
  it('VERSION follows the <stage><number> scheme', () => {
    expect(VERSION).toMatch(/^(kit|cat|tom)\d+$/);
  });
});
