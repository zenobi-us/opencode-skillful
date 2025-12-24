import { type PluginInput, type ToolDefinition, tool, type ToolContext } from '@opencode-ai/plugin';
import type { SkillRegistryManager } from '../types';
import { createInstructionInjector } from './SkillUser';
import { createSkillResourceResolver } from '../services/SkillResourceResolver';

/**
 *  Tool to read a resource file from a skill's directory
 */

export function createToolResourceReader(
  ctx: PluginInput,
  registry: SkillRegistryManager
): ToolDefinition {
  const sendPrompt = createInstructionInjector(ctx);
  const skillResourceResolver = createSkillResourceResolver(registry);

  return tool({
    description:
      "Read [[<relative_path>]] from a skill's resources and inject content silently. If loading skills, use the skills_<skillname> instead.",
    args: {
      skill_name: tool.schema.string(),
      relative_path: tool.schema.string(),
    },
    execute: async (args, toolCtx: ToolContext) => {
      const resource = await skillResourceResolver({
        skill_name: args.skill_name,
      });

      // Inject content silently
      await sendPrompt(
        `Resource loaded from skill "${args.skill_name}": ${args.relative_path}\n\n${resource}`,
        { sessionId: toolCtx.sessionID }
      );

      return `Resource "${args.relative_path}" from skill "${args.skill_name}" has been loaded successfully.`;
    },
  });
}
