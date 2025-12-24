import * as Bun from 'bun';
import { createSkillResourceResolver } from './SkillResourceResolver';
import { SkillProvider } from '../types';

export function createScriptResourceExecutor(provider: SkillProvider) {
  const skillResourceResolver = createSkillResourceResolver(provider);

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
