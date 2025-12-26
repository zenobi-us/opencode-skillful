import { type PluginInput, type ToolDefinition, tool, type ToolContext } from '@opencode-ai/plugin';
import { createInstructionInjector } from '../services/OpenCodeChat';
import { createSkillResourceResolver } from '../services/SkillResourceResolver';
import { SkillProvider } from '../types';

/**
 *  Tool to read a resource file from a skill's directory
 */

export function createToolResourceReader(
  ctx: PluginInput,
  provider: SkillProvider
): ToolDefinition {
  const sendPrompt = createInstructionInjector(ctx);
  const skillResourceResolver = createSkillResourceResolver(provider);

  return tool({
    description: `Read a resource file from a skill.`,
    args: {
      skill_name: tool.schema.string().describe('The skill id to read the resource from.'),
      relative_path: tool.schema
        .string()
        .describe('The relative path to the resource file within the skill directory.'),
    },
    execute: async (args, toolCtx: ToolContext) => {
      const resource = await skillResourceResolver({
        skill_name: args.skill_name,
        type: 'reference',
        relative_path: args.relative_path,
      });

      // Inject content silently
      await sendPrompt(
        `<Resource skill="${args.skill_name}" path="${args.relative_path}" type="${resource.mimeType}">${resource.content}</Resource>`,
        { sessionId: toolCtx.sessionID }
      );

      return `
Load Skill Resource

  skill: ${args.skill_name}
  resource: ${args.relative_path}
  type: ${resource.mimeType}
    `;
    },
  });
}
