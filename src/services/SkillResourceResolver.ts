import * as Bun from 'bun';
import { resolve, join, sep } from 'path';
import type { Skill, SkillProvider } from '../types';

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
export function createSkillResourceResolver(provider: SkillProvider) {
  return async (args: {
    skill_name: string;
    type: 'script' | 'asset' | 'reference';
    relative_path: string;
  }): Promise<{
    absolute_path: string;
    content: string;
    mimeType: string;
  }> => {
    // Try to find skill by toolName first, then by name (backward compat)
    const skill = provider.registry.get(args.skill_name);
    if (!skill) {
      throw new Error(`Skill not found: ${args.skill_name}`);
    }

    const resourcePath = resolveSkillResourcePath({
      skill,
      type: args.type,
      relative_path: args.relative_path,
    });

    try {
      const file = Bun.file(resourcePath);
      const contents = await file.text();
      const mimeType = file.type || 'application/octet-stream';

      return {
        absolute_path: resourcePath,
        content: contents,
        mimeType,
      };
    } catch (error) {
      throw new Error(
        `Failed to read resource at ${resourcePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}
