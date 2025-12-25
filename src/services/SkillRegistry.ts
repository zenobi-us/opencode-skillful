import { tool } from '@opencode-ai/plugin';
import {
  PluginConfig,
  Skill,
  SkillRegistry,
  SkillRegistryController,
  SkillRegistryDebugInfo,
} from '../types';

import { dirname, basename, sep, join } from 'node:path';
import { lstat } from 'node:fs/promises';
import matter from 'gray-matter';
import mime from 'mime';
import { log } from './logger';

type DiscoveredSkillPath = {
  basePath: string;
  absolutePath: string;
};
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

function createSkillRegistryController(): SkillRegistryController {
  const registry: SkillRegistry = new Map();

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
  config: PluginConfig
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
  const matches = await findSkillPaths(config.basePaths);
  log(
    'discovered',
    matches.map((m) => m.absolutePath)
  );

  debug.discovered = matches.length;

  const dupes: string[] = [];

  for await (const match of matches) {
    try {
      const skill = await parseSkill(match);

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
 * Infer resource type from file path using mime package
 */
function inferResourceType(filePath: string): string {
  return mime.getType(filePath) || 'application/octet-stream';
}

/**
 * Generate tool name from skill path
 * Examples:
 *   skills/brand-guidelines/SKILL.md → skills_brand_guidelines
 *   skills/document-skills/docx/SKILL.md → skills_document_skills_docx
 *   skills/image-processing/SKILL.md → skills_image_processing
 */
function toolName(skillPath: string): string {
  return skillPath
    .replace(/SKILL\.md$/, '')
    .split(sep)
    .filter(Boolean)
    .join('_')
    .replace(/-/g, '_');
}

/**
 * Parse a SKILL.md file and return structured skill data
 * Returns null if parsing fails (with error logging)
 */
async function parseSkill(skillPath: DiscoveredSkillPath): Promise<Skill | null> {
  const relativePath = skillPath.absolutePath.replace(skillPath.basePath + sep, '');

  if (!relativePath) {
    throw new Error(`❌ Skill path does not match expected pattern: ${skillPath.absolutePath}`);
  }

  // Read file
  const content = await Bun.file(skillPath.absolutePath).text();

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
    scripts: scriptPaths.map((p) => ({ path: p })),
    references: referencePaths.map((p) => ({ path: p, mimetype: inferResourceType(p) })),
    assets: assetPaths.map((p) => ({ path: p, mimetype: inferResourceType(p) })),
  };
}

/**
 * List all files in a skill subdirectory (e.g., scripts/, resources/)
 * Returns a flat array of absolute file paths
 *
 * @param skillPath - Base path to the skill directory
 * @param subdirectory - Subdirectory to scan (e.g., 'scripts', 'resources')
 * @returns Array of absolute file paths
 */
export async function listSkillFiles(skillPath: string, subdirectory: string): Promise<string[]> {
  const targetPath = join(skillPath, subdirectory);

  const stat = await lstat(targetPath).catch(() => null);
  if (!stat?.isDirectory()) {
    return [];
  }

  const glob = new Bun.Glob('**/*');
  const results: string[] = [];

  for await (const match of glob.scan({ cwd: targetPath, absolute: true })) {
    const fileStat = await lstat(match).catch(() => null);
    if (fileStat?.isFile()) {
      results.push(match);
    }
  }

  return results;
}

async function findSkillPaths(basePaths: string | string[]): Promise<DiscoveredSkillPath[]> {
  const basePathsArray = Array.isArray(basePaths) ? basePaths : [basePaths];
  const results: DiscoveredSkillPath[] = [];

  const glob = new Bun.Glob('**/SKILL.md');

  for (const basePath of basePathsArray) {
    log('scanning', basePath);
    let count = results.length;
    try {
      for await (const match of glob.scan({ cwd: basePath, absolute: true })) {
        results.push({
          basePath,
          absolutePath: match,
        });
      }
      log('foundSkills', { basePath, count: results.length - count });
    } catch (error) {
      log('errorScanningSkills', { basePath, error });
      continue;
    }
  }

  log('totalSkillsFound', results.length);

  return results;
}
