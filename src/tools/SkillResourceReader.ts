import { type PluginInput, type ToolDefinition, tool, type ToolContext } from '@opencode-ai/plugin';
import * as Bun from 'bun';
import { join } from 'path/posix';
import type { SkillRegistryManager } from '../types';

/**
 *  Tool to read a resource file from a skill's directory
 */

export function createToolResourceReader(
  ctx: PluginInput,
  registry: SkillRegistryManager
): ToolDefinition {
  const sendPrompt = createInstructionInjector(ctx);

  return tool({
    description:
      "Read [[<relative_path>]] from a skill's resources and inject content silently. If loading skills, use the skills_<skillname> instead.",
    args: {
      skill_name: tool.schema.string(),
      relative_path: tool.schema.string(),
    },
    execute: async (args, toolCtx: ToolContext) => {
      // Try to find skill by toolName first, then by name (backward compat)
      let skill = registry.byFQDN.get(args.skill_name) || registry.byName.get(args.skill_name);
      if (!skill) {
        throw new Error(`Skill not found: ${args.skill_name}`);
      }

      const resourcePath = join(skill.fullPath, args.relative_path);
      try {
        const content = await Bun.file(resourcePath).text();

        // Inject content silently
        await sendPrompt(
          `Resource loaded from skill "${skill.name}": ${args.relative_path}\n\n${content}`,
          { sessionId: toolCtx.sessionID }
        );

        return `Resource "${args.relative_path}" from skill "${skill.name}" has been loaded successfully.`;
      } catch (error) {
        throw new Error(
          `Failed to read resource at ${resourcePath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  });
}
