import { tool } from '@opencode-ai/plugin';
import {
  PluginConfig,
  PluginLogger,
  Skill,
  SkillRegistry,
  SkillRegistryController,
  SkillRegistryDebugInfo,
  SkillResourceMap,
} from '../types';

import { dirname, basename, sep } from 'node:path';
import matter from 'gray-matter';
import { toolName } from './identifiers';
import { DiscoveredSkillPath, findSkillPaths, listSkillFiles, readSkillFile } from './SkillFs';

// Validation Schema
const SkillFrontmatterSchema = tool.schema.object({
  name: tool.schema.string().optional(),
  description: tool.schema
    .string()
    .min(20, 'Description must be at least 20 characters for discoverability'),
  license: tool.schema.string().optional(),
  'allowed-tools': tool.schema.array(tool.schema.string()).optional(),
  metadata: tool.schema.record(tool.schema.string(), tool.schema.string()).optional(),
});

export function createSkillRegistryController(skills?: Skill[]): SkillRegistryController {
  const registry: SkillRegistry = new Map(
    !skills ? [] : skills.map((skill) => [skill.toolName, skill])
  );

  return {
    get skills() {
      return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    get ids() {
      return Array.from(registry.keys()).sort();
    },
    has: (key: string) => registry.has(key),
    get: (key: string) => registry.get(key),
    add: (key: string, skill: Skill) => {
      registry.set(key, skill);
    },
  };
}

/**
 * SkillRegistry manages skill discovery and parsing
 */
export async function createSkillRegistry(
  config: PluginConfig,
  logger: PluginLogger
): Promise<{ controller: SkillRegistryController; debug: SkillRegistryDebugInfo }> {
  /**
   * Skill Registry Map
   *
   * Key: skill name (e.g., "writing-git-commits")
   * Value: Skill object
   *
   * - Handles duplicate skill names by logging and skipping
   * - Skills loaded from multiple base paths (last one wins)
   * - Stored as Map for metadata access by tool resource reader
   */
  const controller = createSkillRegistryController();
  const debug: SkillRegistryDebugInfo = {
    discovered: 0,
    parsed: 0,
    rejected: 0,
    duplicates: 0,
    errors: [],
  };

  // Find all SKILL.md files recursively
  const basePaths = Array.isArray(config.basePaths) ? config.basePaths : [config.basePaths];
  const matches: DiscoveredSkillPath[] = [];
  for await (const basePath of basePaths) {
    const found = await findSkillPaths(basePath);
    matches.push(...found);
  }
  logger.debug(
    'discovered',
    matches.map((m) => m.absolutePath)
  );

  debug.discovered = matches.length;

  const dupes: string[] = [];

  for await (const match of matches) {
    try {
      const content = await readSkillFile(match.absolutePath);
      const skill = await parseSkill(match, content);

      if (!skill) {
        debug.rejected++;
        debug.errors.push(`[NOSKILLERROR] Failed to parse skill at ${match.absolutePath}`);
        continue;
      }

      if (controller.has(skill.toolName)) {
        dupes.push(skill.toolName);
        debug.rejected++;
        debug.errors.push(`[DUPESKILL] Duplicate skill name: ${skill.toolName}`);
        continue;
      }
      controller.add(skill.toolName, skill);
      debug.parsed++;
    } catch (error) {
      debug.rejected++;
      debug.errors.push(`[ERROR] ${(error as Error).message}`);
    }
  }

  return { controller, debug };
}

/**
 * Parse a SKILL.md file and return structured skill data
 * Returns null if parsing fails (with error logging)
 */
async function parseSkill(skillPath: DiscoveredSkillPath, content?: string): Promise<Skill | null> {
  const relativePath = skillPath.absolutePath.replace(skillPath.basePath + sep, '');

  if (!relativePath) {
    throw new Error(`❌ Skill path does not match expected pattern: ${skillPath.absolutePath}`);
  }

  if (!content) {
    throw new Error(`❌ Unable to read skill file: ${skillPath.absolutePath}`);
  }

  // Parse YAML frontmatter
  const parsed = matter(content);

  // Validate frontmatter schema
  const frontmatter = SkillFrontmatterSchema.safeParse(parsed.data);
  if (!frontmatter.success) {
    const error = [
      `❌ Invalid frontmatter in ${skillPath.absolutePath}:`,

      ...frontmatter.error.flatten().formErrors.map((err) => {
        return `   - ${err}`;
      }),
    ].join('\n');

    throw new Error(error);
  }

  // Use directory name as skill name (shortName)
  const shortName = basename(dirname(skillPath.absolutePath));

  // Generate tool name from path
  const skillFullPath = dirname(skillPath.absolutePath);

  // Scan for scripts and resources
  const [scriptPaths, referencePaths, assetPaths] = await Promise.all([
    listSkillFiles(skillFullPath, 'scripts'),
    listSkillFiles(skillFullPath, 'references'),
    listSkillFiles(skillFullPath, 'assets'),
  ]);

  return {
    allowedTools: frontmatter.data['allowed-tools'],
    content: parsed.content.trim(),
    description: frontmatter.data.description,
    fullPath: skillFullPath,
    toolName: toolName(relativePath),
    license: frontmatter.data.license,
    metadata: frontmatter.data.metadata,
    name: shortName,
    path: skillPath.absolutePath,
    scripts: createSkillResourceMap(skillFullPath, scriptPaths),
    references: createSkillResourceMap(skillFullPath, referencePaths),
    assets: createSkillResourceMap(skillFullPath, assetPaths),
  };
}

export function createSkillResourceMap(skillPath: string, filePaths: string[]): SkillResourceMap {
  const output: SkillResourceMap = {};

  for (const filePath of filePaths) {
    const relativePath = filePath.replace(skillPath + sep, '');
    output[relativePath] = filePath;
  }

  return output;
}
