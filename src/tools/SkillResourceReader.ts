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

    const injection = {
      skill_name: args.skill_name,
      resource_path: args.relative_path,
      resource_mimetype: resource.mimeType,
      content: resource.content,
    };

    return {
      injection,
    };
  };
}
