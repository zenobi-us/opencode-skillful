import { type PluginInput, type ToolDefinition, tool, type ToolContext } from '@opencode-ai/plugin';
import type { Skill, SkillProvider, SkillRegistryController } from '../types';
import { createInstructionInjector } from '../services/OpenCodeChat';

const unorderedList = <T extends { path: string }>(items: T[], labelFn: (item: T) => string) => {
  return items.map((item) => `- ${labelFn(item)} `).join('\n');
};

/**
 * Tool to use (load) one or more skills
 */

export function createUseSkillsTool(ctx: PluginInput, provider: SkillProvider): ToolDefinition {
  const skillLoader = createSkillLoader(provider.registry);
  const sendPrompt = createInstructionInjector(ctx);

  return tool({
    description:
      'Load one or more skills into the chat. Provide an array of skill names to load them as user messages.',
    args: {
      skill_names: tool.schema
        .array(tool.schema.string())
        .min(1, 'Must provide at least one skill name'),
    },
    execute: async (args, toolCtx: ToolContext) => {
      const results = await skillLoader(args.skill_names, async (content: string) => {
        sendPrompt(content, { sessionId: toolCtx.sessionID });
      });

      return results;
    },
  });
}

function createSkillLoader(registry: SkillRegistryController) {
  /**
   * Load a single skill into the chat
   */
  function render(skill: Skill) {
    const skillScripts = unorderedList(skill.scripts, (script) => `${script.path}`);
    const skillReferences = unorderedList(
      skill.references,
      (reference) => `[${reference.mimetype}] ${reference.path} `
    );

    const content = `
# ${skill.name}

${skill.description}

${!skillReferences ? '' : `## References\n\n${skillReferences}\n\n`}
${!skillScripts ? '' : `## Scripts\n\n${skillScripts}\n\n`}
${skill.content}
`;
    return content;
  }

  /**
   * Load multiple skills into the chat
   */
  async function loadSkills(skillNames: string[], onLoad: (content: string) => Promise<void>) {
    const loaded: string[] = [];
    const notFound: string[] = [];

    for (const skillName of skillNames) {
      // Try to find skill by toolName first (primary key), then by name (backward compat)

      const skill = registry.get(skillName);

      if (!skill) {
        notFound.push(skillName);
        continue;
      }

      await onLoad(render(skill));
      loaded.push(skill.toolName);
    }

    return JSON.stringify({ loaded, notFound });
  }

  return loadSkills;
}
