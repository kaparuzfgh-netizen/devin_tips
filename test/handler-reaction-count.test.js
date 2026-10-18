import { describe, it, expect, vi } from 'vitest';

vi.mock('../tgcloud/lib/channel.js', () => ({
  checkReactionTriggers: vi.fn(async () => {}),
}));

import handler from '../tgcloud/handlers/message_reaction_count.js';
import { checkReactionTriggers } from '../tgcloud/lib/channel.js';

describe('handlers/message_reaction_count.js', () => {
  it('delegates to checkReactionTriggers with chat and message ids', async () => {
    await handler({ chat: { id: -100 }, message_id: 77 }, {});
    expect(checkReactionTriggers).toHaveBeenCalledTimes(1);
    expect(checkReactionTriggers).toHaveBeenCalledWith(-100, 77);
  });
});
