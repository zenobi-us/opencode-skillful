/**
 * SkillScriptExec Tool
 *
 * Executes scripts from skill resources.
 * - Locates script files within skill directories
 * - Executes with proper error handling
 * - Returns execution results (stdout, stderr, exit code)
 */

import { createSkillResourceResolver } from '../services/SkillResourceResolver';
import { PluginInput, tool, ToolContext } from '@opencode-ai/plugin';
import { createInstructionInjector } from './SkillUser';
import { SkillRegistryManager } from '../types';

/**
 * Creates a tool function that executes scripts from skills
 */
export function createSkillScriptExecTool(ctx: PluginInput, registry: SkillRegistryManager) {
  const sendPrompt = createInstructionInjector(ctx);
  const scriptResourceExecutor = createScriptResourceExecutor({ registry });

  return tool({
    description: '',
    args: {
      skill_name: tool.schema.string(),
      relative_path: tool.schema.string(),
      args: tool.schema.array(tool.schema.string()).optional(),
    },
    execute: async (args, toolCtx: ToolContext) => {
      const execResult = await scriptResourceExecutor({
        skill_name: args.skill_name,
        relative_path: args.relative_path,
        args: args.args,
      });

      // Inject execution result silently
      await sendPrompt(
        `Executed script from skill "${args.skill_name}": ${args.relative_path}\n\nExit Code: ${execResult.exitCode}\nSTDOUT: ${execResult.stdout}\nSTDERR: ${execResult.stderr}`,
        { sessionId: toolCtx.sessionID }
      );

      return execResult.text();
    },
  });
}

export function createScriptResourceExecutor(args: { registry: SkillRegistryManager }) {
  const skillResourceResolver = createSkillResourceResolver(args.registry);

  return async function (args: { skill_name: string; relative_path: string; args?: string[] }) {
    const script = await skillResourceResolver({
      skill_name: args.skill_name,
      type: 'script',
      relative_path: args.relative_path,
    });

    const result = await Bun.$`${script.absolute_path} ${args.args ? args.args.join(' ') : ''}`;
    return result;
  };
}
