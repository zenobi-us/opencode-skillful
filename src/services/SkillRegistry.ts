import { PluginInput, tool } from '@opencode-ai/plugin';
import { PluginConfig, Skill, SkillRegistry, SkillRegistryController } from '../types';

import { dirname, basename, sep, join } from 'node:path';
import { lstat } from 'node:fs/promises';
import matter from 'gray-matter';
import mime from 'mime';

type DiscoveredSkillPath = {
  basePath: string;
  absolutePath: string;
};

// Validation Schema
const SkillFrontmatterSchema = tool.schema.object({
  name: tool.schema
    .string()
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens')
    .min(1, 'Name cannot be empty'),
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
  ctx: PluginInput,
  config: PluginConfig
): Promise<SkillRegistryController> {
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

  // Find all SKILL.md files recursively
  const matches = await findSkillPaths(config.basePaths);
  const dupes: string[] = [];

  for await (const match of matches) {
    const skill = await parseSkill(match);

    if (!skill) {
      continue;
    }

    if (controller.has(skill.toolName)) {
      dupes.push(skill.toolName);
      continue;
    }
    controller.add(skill.toolName, skill);
  }

  if (dupes.length) {
    console.warn(`⚠️  Duplicate skills detected (skipped): ${dupes.join(', ')}`);
  }

  return controller;
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
  try {
    const relativePath = skillPath.absolutePath.replace(skillPath.basePath + sep, '');

    if (!relativePath) {
      console.error(`❌ Skill path does not match expected pattern: ${skillPath.absolutePath}`);
      return null;
    }

    // Read file
    const content = await Bun.file(skillPath.absolutePath).text();

    // Parse YAML frontmatter
    const parsed = matter(content);

    // Validate frontmatter schema
    const frontmatter = SkillFrontmatterSchema.safeParse(parsed.data);
    if (!frontmatter.success) {
      console.error(`❌ Invalid frontmatter in ${skillPath.absolutePath}:`);
      frontmatter.error.flatten().formErrors.forEach((err) => {
        console.error(`   - ${err}`);
      });
      return null;
    }

    // Validate name matches directory
    const skillDirName = basename(dirname(skillPath.absolutePath));
    if (frontmatter.data.name !== skillDirName) {
      console.error(
        `❌ Name mismatch in ${skillPath.absolutePath}:`,
        `\n   Frontmatter name: "${frontmatter.data.name}"`,
        `\n   Directory name: "${skillDirName}"`,
        `\n   Fix: Update the 'name' field in SKILL.md to match the directory name`
      );
      return null;
    }

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
      name: frontmatter.data.name,
      path: skillPath.absolutePath,
      scripts: scriptPaths.map((p) => ({ path: p })),
      references: referencePaths.map((p) => ({ path: p, mimetype: inferResourceType(p) })),
      assets: assetPaths.map((p) => ({ path: p, mimetype: inferResourceType(p) })),
    };
  } catch (error) {
    console.error(
      `❌ Error parsing skill ${skillPath.absolutePath}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
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
    try {
      const stat = await lstat(basePath).catch(() => null);
      if (!stat?.isDirectory()) {
        continue;
      }

      for await (const match of glob.scan({ cwd: basePath, absolute: true })) {
        results.push({
          basePath,
          absolutePath: match,
        });
      }
    } catch (error) {
      console.error(
        `❌ Error scanning skill path ${basePath}:`,
        error instanceof Error ? error.message : String(error)
      );
      continue;
    }
  }

  return results;
}
