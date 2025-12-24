import * as Bun from 'bun';
import { resolve, join, sep } from 'path';
import type { SkillRegistryManager } from '../types';

function resolveSkillResourcePath(args: {
  skill: Skill;
  type: 'script' | 'asset' | 'reference';
  relative_path: string;
}): string {
  try {
    // Normalise the resource path to avoid mishaps.
    const scriptPath = args.relative_path.replace(`$${sep}`, '').replace(`${args.type}${sep}`, '');
    const resourcePath = resolve(join(args.skill.fullPath, args.type, scriptPath));
    return resourcePath;
  } catch (error) {
    throw new Error(
      `Failed to resolve resource path: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
export function createSkillResourceResolver(registry: SkillRegistryManager) {
  return async (args: {
    skill_name: string;
    type: 'script' | 'asset' | 'reference';
    relative_path: string;
  }): Promise<{
    absolute_path: string;
    content: string;
  }> => {
    // Try to find skill by toolName first, then by name (backward compat)
    const skill = registry.byFQDN.get(args.skill_name) || registry.byName.get(args.skill_name);
    if (!skill) {
      throw new Error(`Skill not found: ${args.skill_name}`);
    }

    const resourcePath = resolveSkillResourcePath({
      skill,
      type: args.type,
      relative_path: args.relative_path,
    });

    try {
      const contents = await Bun.file(resourcePath).text();
      return {
        absolute_path: resourcePath,
        content: contents,
      };
    } catch (error) {
      throw new Error(
        `Failed to read resource at ${resourcePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}
