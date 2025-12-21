import { type PluginInput, type ToolDefinition, tool, type ToolContext } from '@opencode-ai/plugin';
import type { SkillRegistryManager } from '../types';
import type { Skill } from '../types';
import { createShellExecutor } from '../services/SkillShellProcessor';

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
 *
 * Processes any shell commands (!`command`) in the skill content before sending.
 * Shell commands execute in parallel and their output replaces the command syntax.
 */
export async function loadSkill(skill: Skill, options: { ctx: PluginInput; sessionID: string }) {
  const sendPrompt = createInstructionInjector(options.ctx);

  await sendPrompt(`The "${skill.name}" skill is loading\n${skill.name}`, {
    sessionId: options.sessionID,
  });
  try {
    // Process shell commands in skill content (!`command` syntax)
    const processShellCommands = createShellExecutor(skill.content);
    const processedContent = await processShellCommands();
    const skillScripts = skill.scripts.map((skill) => `<Script path="${skill.path}" />`).join('\n');
    const skillResources = skill.resources
      .map((resource) => `<Resource path="${resource.path}" type="${resource.type}" />`)
      .join('\n');

    await sendPrompt(
      `<Skill name="${skill.name}" description="${skill.description}" baseDirectory="${skill.fullPath}">
        <SkillUsage>
Skill scripts can be invoked via "skill_exec(skillname, scriptname, ...arguments)"
Skill resources can be accessed via "skill_resource(skillname, resourcename)"
        </SkillUsage>
        <SkillScripts>${skillScripts}</SkillScripts>
        <SkillResource>${skillResources}</SkillResources>
        <SkillContent>${processedContent}</SkillContent>
      </Skill>`,
      {
        sessionId: options.sessionID,
      }
    );
  } catch (error) {
    await sendPrompt(`Error loading skill "${skill.name}": ${(error as Error).message}`, {
      sessionId: options.sessionID,
    });
  }
}

function createInstructionInjector(ctx: PluginInput) {
  // Message 1: Skill loading header (silent insertion - no AI response)
  const sendPrompt = async (text: string, props: { sessionId: string }) => {
    ctx.client.session.prompt({
      path: { id: props.sessionId },
      body: {
        noReply: true,
        parts: [{ type: 'text', text }],
      },
    });
  };
  return sendPrompt;
}
