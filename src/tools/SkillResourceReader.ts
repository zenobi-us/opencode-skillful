import { createSkillResourceResolver } from '../services/SkillResourceResolver';
import { SkillRegistry } from '../types';

export function createSkillResourceReader(provider: SkillRegistry) {
  const skillResourceResolver = createSkillResourceResolver(provider);

  return async (args: { skill_name: string; relative_path: string }) => {
    const resource = await skillResourceResolver({
      skill_name: args.skill_name,
      type: 'reference',
      relative_path: args.relative_path,
    });

    // Inject content silently
    const injection = `<Resource skill="${args.skill_name}" path="${args.relative_path}" type="${resource.mimeType}">${resource.content}</Resource>`;
    const summary = `
Load Skill Resource

  skill: ${args.skill_name}
  resource: ${args.relative_path}
  type: ${resource.mimeType}
    `;

    return { injection, summary };
  };
}
