/**
 * SkillScriptExec Tool
 *
 * Executes scripts from skill resources.
 * - Locates script files within skill directories
 * - Executes with proper error handling
 * - Returns execution results (stdout, stderr, exit code)
 */

import { PluginInput } from '@opencode-ai/plugin';
import { SkillProvider } from '../types';
import { createScriptResourceExecutor } from '../services/ScriptResourceExecutor';

export function createSkillExecutor(ctx: PluginInput, provider: SkillProvider) {
  const scriptResourceExecutor = createScriptResourceExecutor(provider);

  return async (args: { skill_name: string; relative_path: string; args?: string[] }) => {
    const execResult = await scriptResourceExecutor({
      skill_name: args.skill_name,
      relative_path: args.relative_path,
      args: args.args,
    });

    // Inject execution result silently
    const injection = `Executed script from skill "${args.skill_name}": ${args.relative_path}\n\nExit Code: ${execResult.exitCode}\nSTDOUT: ${execResult.stdout}\nSTDERR: ${execResult.stderr}`;

    const summary = execResult.text();

    return { injection, summary };
  };
}
