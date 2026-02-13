import type { PluginInput } from '@opencode-ai/plugin';
import { describe, expect, it, vi } from 'vitest';
import { createInstructionInjector } from './OpenCodeChat';

type PromptPayload = {
  path: { id: string };
  body: {
    agent?: string;
    noReply?: boolean;
    parts: Array<{ type: string; text: string }>;
  };
};

describe('createInstructionInjector', () => {
  it('sends silent prompt using the original agent', async () => {
    const promptMock = vi.fn<(...args: [PromptPayload]) => Promise<void>>(async () => undefined);

    const ctx = {
      client: {
        session: {
          prompt: promptMock,
        },
      },
    } as unknown as PluginInput;

    const sendPrompt = createInstructionInjector(ctx);

    await sendPrompt('skill payload', {
      sessionId: 'session-123',
      agent: 'frontend-developer',
    });

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(promptMock).toHaveBeenCalledWith({
      path: { id: 'session-123' },
      body: {
        agent: 'frontend-developer',
        noReply: true,
        parts: [{ type: 'text', text: 'skill payload' }],
      },
    });
  });
});
