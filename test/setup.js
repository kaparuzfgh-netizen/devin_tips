// Global test guard: any sendMessage that Telegram would reject with
// "can't parse entities" (invalid HTML) must fail the test, even if
// sendRichMessage's plain-text fallback would mask it. Tests that exercise
// the fallback on purpose use valid HTML + their own __onApi thrower, so no
// invalidHtml flag is recorded for them.
import { afterEach } from 'vitest';
import { apiCalls } from './mocks/sdk.js';

afterEach(() => {
  const invalid = apiCalls.filter((c) => c.invalidHtml);
  if (invalid.length) {
    throw new Error(
      `sendMessage called with invalid HTML: ${invalid.map((c) => JSON.stringify(c.params.text)).join(', ')}`,
    );
  }
});
