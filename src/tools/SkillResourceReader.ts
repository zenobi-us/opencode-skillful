/**
 * SkillResourceReader Tool - Safe Skill Resource Access
 *
 * WHY: Skills contain resources (scripts, assets, references) that need to be
 * retrieved safely. This tool:
 * 1. Validates the resource type (scripts|assets|references)
 * 2. Resolves the path safely (prevents path traversal attacks)
 * 3. Reads the file content and returns it for injection
 *
 * CRITICAL SECURITY: Resources are pre-indexed at parse time. This tool can only
 * retrieve resources that were explicitly registered in the skill's resource maps.
 * It cannot request arbitrary paths like "../../etc/passwd".
 *
 * PATH PARSING: Input path format is "type/relative/path"
 * - type: one of 'scripts', 'assets', 'references' (validated)
 * - relative/path: path within that type's directory
 *
 * EXAMPLE:
 * - Args: { skill_name: 'git-commit', relative_path: 'scripts/commit.sh' }
 * - Type: 'scripts', path: 'commit.sh'
 * - Resolves: skill.scripts.get('commit.sh') → reads file content
 *
 * RETURN VALUE: Object with:
 * - injection: contains skill_name, resource_path, MIME type, and content
 * The caller (index.ts) injects this content into the message body
 *
 * READY STATE: Must wait for registry initialization before accessing skills
 *
 * @param provider SkillRegistry instance (must be initialized first)
 * @returns Async function callable by OpenCode as skill_resource tool
 */

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
