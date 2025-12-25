import * as Bun from 'bun';
import type { Skill, SkillProvider } from '../types';
import path from 'node:path';

/**
 * Skill resources are mapped on startup as a dictionary of relative paths to resource metadata.
 *
 * This resolver uses that mapping to solve several things:
 *
 * - locate and read the actual resource files.
 * - ensure the requested path isn't outside the skill directory (security).
 * - return the content and mime type of the resource.
 */
export function createSkillResourceResolver(provider: SkillProvider) {
  const resolveResourceMap = (skill: Skill, type: 'script' | 'asset' | 'reference') => {
    if (type === 'script') {
      return skill.scripts;
    } else if (type === 'asset') {
      return skill.assets;
    } else if (type === 'reference') {
      return skill.references;
    } else {
      throw new Error(`Unknown resource type: ${type}`);
    }
  };

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

    const resourceMap = resolveResourceMap(skill, args.type);
    const resource = resourceMap[args.relative_path];

    if (!resource) {
      throw new Error(
        `Resource not found: Skill "${args.skill_name}" does not have a ${args.type} at path "${args.relative_path}"`
      );
    }

    const resourcePath = path.join(skill.fullPath, args.relative_path);

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
