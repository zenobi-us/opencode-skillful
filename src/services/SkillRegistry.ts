import { PluginInput, tool } from '@opencode-ai/plugin';
import {
  PluginConfig,
  Skill,
  SkillRegistry,
  SkillRegistryController,
  SkillRegistryManager,
} from '../types';

import { dirname, basename, sep } from 'path';
import { lstat } from 'node:fs/promises';
import matter from 'gray-matter';

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
    registry,
    has: (key: string) => registry.has(key),
    get: (key: string) => registry.get(key),
    add: (key: string, skill: Skill) => {
      registry.set(key, skill);
    },
    search: (...args: string[]) => {
      const results: Skill[] = [];
      const query = args.map((a) => a.toLowerCase());
      for (const skill of registry.values()) {
        const haystack = `${skill.name} ${skill.description}`.toLowerCase();
        if (query.every((q) => haystack.includes(q))) {
          results.push(skill);
        }
      }
      return results;
    },
  };
}

/**
 * SkillRegistry manages skill discovery and parsing
 */
export async function createSkillRegistry(
  ctx: PluginInput,
  config: PluginConfig
): Promise<SkillRegistryManager> {
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
  const byFQDN = createSkillRegistryController();
  const byName = createSkillRegistryController();

  // Find all SKILL.md files recursively
  const matches = await findSkillPaths(config.basePaths);
  const dupes: string[] = [];

  for await (const match of matches) {
    const skill = await parseSkill(match);

    if (!skill) {
      continue;
    }

    if (byFQDN.has(skill.toolName)) {
      dupes.push(skill.toolName);
      continue;
    }
    byName.add(skill.name, skill);
    byFQDN.add(skill.toolName, skill);
  }

  if (dupes.length) {
    console.warn(`⚠️  Duplicate skills detected (skipped): ${dupes.join(', ')}`);
  }

  /**
   * search both registries for matching skills
   * then de-duplicate results
   */
  function search(query: string): Skill[] {
    const resultsByName = byName.search(query);
    const resultsByFQDN = byFQDN.search(query);

    const allResults = [...resultsByName, ...resultsByFQDN];
    const uniqueResultsMap: Map<string, Skill> = new Map();

    for (const skill of allResults) {
      uniqueResultsMap.set(skill.toolName, skill);
    }

    return Array.from(uniqueResultsMap.values());
  }

  return {
    byName,
    byFQDN,
    search,
  };
}

const SKILL_PATH_PATTERN = /skills\/.*\/SKILL.md$/;

/**
 * Infer resource type from file extension
 */
function inferResourceType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    md: 'markdown',
    txt: 'text',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    ts: 'typescript',
    js: 'javascript',
    sh: 'shell',
    py: 'python',
  };
  return typeMap[ext] || 'unknown';
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
    .replace(/\/SKILL\.md$/, '') // Remove trailing /SKILL.md
    .split(sep)
    .join('_')
    .replace(/-/g, '_'); // Replace hyphens with underscores
}

/**
 * Parse a SKILL.md file and return structured skill data
 * Returns null if parsing fails (with error logging)
 */
async function parseSkill(skillPath: string): Promise<Skill | null> {
  try {
    const relativePath = skillPath.match(SKILL_PATH_PATTERN)?.[0];
    if (!relativePath) {
      console.error(`❌ Skill path does not match expected pattern: ${skillPath}`);
      return null;
    }

    // Read file
    const content = await Bun.file(skillPath).text();

    // Parse YAML frontmatter
    const parsed = matter(content);

    // Validate frontmatter schema
    const frontmatter = SkillFrontmatterSchema.safeParse(parsed.data);
    if (!frontmatter.success) {
      console.error(`❌ Invalid frontmatter in ${skillPath}:`);
      frontmatter.error.flatten().formErrors.forEach((err) => {
        console.error(`   - ${err}`);
      });
      return null;
    }

    // Validate name matches directory
    const skillDir = basename(dirname(skillPath));
    if (frontmatter.data.name !== skillDir) {
      console.error(
        `❌ Name mismatch in ${skillPath}:`,
        `\n   Frontmatter name: "${frontmatter.data.name}"`,
        `\n   Directory name: "${skillDir}"`,
        `\n   Fix: Update the 'name' field in SKILL.md to match the directory name`
      );
      return null;
    }

    // Generate tool name from path
    const skillFullPath = dirname(skillPath);

    // Scan for scripts and resources
    const [scriptPaths, resourcePaths] = await Promise.all([
      listSkillFiles(skillFullPath, 'scripts'),
      listSkillFiles(skillFullPath, 'resources'),
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
      path: skillPath,
      scripts: scriptPaths.map((p) => ({ path: p })),
      resources: resourcePaths.map((p) => ({ path: p, type: inferResourceType(p) })),
    };
  } catch (error) {
    console.error(
      `❌ Error parsing skill ${skillPath}:`,
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
  const targetPath = `${skillPath}/${subdirectory}`;

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

async function findSkillPaths(basePaths: string | string[]): Promise<string[]> {
  const basePathsArray = Array.isArray(basePaths) ? basePaths : [basePaths];
  const results: string[] = [];

  try {
    const glob = new Bun.Glob('**/SKILL.md');

    for (const basePath of basePathsArray) {
      const stat = await lstat(basePath).catch(() => null);
      if (!stat?.isDirectory()) {
        continue;
      }

      for await (const match of glob.scan({ cwd: basePath, absolute: true })) {
        results.push(match);
      }
    }

    return results;
  } catch {
    return [];
  }
}
