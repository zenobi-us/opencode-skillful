import path from 'node:path';
import { createSkillResourceResolver } from '../services/SkillResourceResolver';
import { assertIsValidResourceType, SkillRegistry } from '../types';

export function createSkillResourceReader(provider: SkillRegistry) {
  const skillResourceResolver = createSkillResourceResolver(provider);

  return async (args: { skill_name: string; relative_path: string }) => {
    await provider.controller.ready.whenReady();

    const [type, ...restPath] = args.relative_path.split('/');

    assertIsValidResourceType(type);

    const resource = await skillResourceResolver({
      skill_name: args.skill_name,
      type,
      relative_path: path.join(...restPath),
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
