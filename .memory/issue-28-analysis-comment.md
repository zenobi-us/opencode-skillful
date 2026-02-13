## Analysis

Thanks for the detailed report — I validated this in code and agree with the root cause.

### Summary

- `skill_use` / skill prompt injection can reset to the default agent.
- The injection path currently sends a silent prompt without `agent`, so OpenCode may fall back to default agent selection.

### CodeMapper findings

- `createInstructionInjector` is defined in `src/lib/OpenCodeChat.ts`.
- `sendPrompt` currently calls `ctx.client.session.prompt(...)` with:
  - `noReply: true`
  - `parts: [{ type: 'text', text }]`
  - **no `agent` field**
- Callers of this injection path are in `src/index.ts`:
  - `skill_use` execution path
  - `skill_resource` execution path

### LSP / type-level evidence

- `ToolContext` includes `agent: string` (`@opencode-ai/plugin/dist/tool.d.ts`).
- Session prompt request body supports `agent?: string` (`@opencode-ai/sdk/dist/gen/types.gen.d.ts`).

So the agent value is available at tool execution time and can be forwarded safely.

### Proposed fix

1. Update injector props in `src/lib/OpenCodeChat.ts`:
   - from `{ sessionId: string }`
   - to `{ sessionId: string; agent: string }`
2. Include `agent: props.agent` in `ctx.client.session.prompt({ body: ... })`.
3. Update call sites in `src/index.ts` (`skill_use`, `skill_resource`) to pass `toolCtx.agent`.
4. Add regression test for injector to ensure silent injected messages preserve agent.

This should preserve the original/current agent during skill loading and prevent fallback to default agent.
