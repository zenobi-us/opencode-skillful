/**
 * SkillScriptExec Tool
 *
 * Executes scripts from skill resources.
 * - Locates script files within skill directories
 * - Executes with proper error handling
 * - Returns execution results (stdout, stderr, exit code)
 */

import { PluginInput, tool, ToolContext } from '@opencode-ai/plugin';
import { createInstructionInjector } from '../services/OpenCodeChat';
import { SkillProvider } from '../types';
import { createScriptResourceExecutor } from '../services/ScriptResourceExecutor';

/**
 * Creates a tool function that executes scripts from skills
 */
export function createSkillScriptExecTool(ctx: PluginInput, provider: SkillProvider) {
  const sendPrompt = createInstructionInjector(ctx);
  const scriptResourceExecutor = createScriptResourceExecutor(provider);

  return tool({
    description: 'Execute scripts from skill resources with arguments',
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
