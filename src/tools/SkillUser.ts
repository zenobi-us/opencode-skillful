import { type PluginInput, type ToolDefinition, tool, type ToolContext } from '@opencode-ai/plugin';
import type { Skill, SkillRegistryManager } from '../types';

/**
 * Escape XML special characters to prevent injection
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const unorderedList = <T extends { path: string }>(items: T[], labelFn: (item: T) => string) => {
  return items.map((item) => `- ${labelFn(item)} `).join('\n');
};

/**
 * Tool to use (load) one or more skills
 */

export function createUseSkillsTool(
  ctx: PluginInput,
  registry: SkillRegistryManager
): ToolDefinition {
  /**
   * Load multiple skills into the chat
   */
  async function loadSkills(
    skillNames: string[],
    manager: SkillRegistryManager,
    options: { ctx: PluginInput; sessionID: string }
  ) {
    const loaded: string[] = [];
    const notFound: string[] = [];

    for (const skillName of skillNames) {
      // Try to find skill by toolName first (primary key), then by name (backward compat)
      let skill = manager.byFQDN.get(skillName);
      if (!skill) {
        skill = manager.byName.get(skillName);
      }

      if (!skill) {
        notFound.push(skillName);
        continue;
      }

      await loadSkill(skill, {
        ctx: options.ctx,
        sessionID: options.sessionID,
      });
      loaded.push(skill.toolName);
    }

    return { loaded, notFound };
  }

  return tool({
    description:
      'Load one or more skills into the chat. Provide an array of skill names to load them as user messages.',
    args: {
      skill_names: tool.schema
        .array(tool.schema.string())
        .min(1, 'Must provide at least one skill name'),
    },
    execute: async (args, toolCtx: ToolContext) => {
      const response = await loadSkills(args.skill_names, registry, {
        ctx,
        sessionID: toolCtx.sessionID,
      });

      let result = `Loaded ${response.loaded.length} skill(s): ${response.loaded.join(', ')}`;
      if (response.notFound.length > 0) {
        result += `\n\nSkills not found: ${response.notFound.join(', ')}`;
      }
      return result;
    },
  });
}
/**
 * Load a single skill into the chat
 */
export async function loadSkill(skill: Skill, options: { ctx: PluginInput; sessionID: string }) {
  const sendPrompt = createInstructionInjector(options.ctx);
  await sendPrompt(`The "${skill.name}" skill is loading\n${skill.name}`, {
    sessionId: options.sessionID,
  });

  try {
    const skillScripts = unorderedList(skill.scripts, (script) => `${script.path}`);
    const skillReferences = unorderedList(
      skill.references,
      (reference) => `[${reference.mimetype}] ${reference.path} `
    );

    await sendPrompt(
      `
# ${skill.name}

${skill.description}

${!skillReferences ? '' : `## References\n\n${skillReferences}\n\n`}
${!skillScripts ? '' : `## Scripts\n\n${skillScripts}\n\n`}
${skill.content}
`,
      {
        sessionId: options.sessionID,
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await sendPrompt(`Error loading skill "${escapeXml(skill.name)}": ${escapeXml(errorMsg)}`, {
      sessionId: options.sessionID,
    });
  }
}

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
