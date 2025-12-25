import type { PluginInput } from '@opencode-ai/plugin';

export function createInstructionInjector(ctx: PluginInput) {
  // Message 1: Skill loading header (silent insertion - no AI response)
  const sendPrompt = async (text: string, props: { sessionId: string }) => {
    await ctx.client.session.prompt({
      path: { id: props.sessionId },
      body: {
        noReply: true,
        parts: [{ type: 'text', text }],
      },
    });
  };
  return sendPrompt;
}
