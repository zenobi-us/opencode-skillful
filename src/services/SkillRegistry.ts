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

import { dirname, basename, relative } from 'node:path';
import matter from 'gray-matter';
import { toolName } from '../lib/Identifiers';
import {
  doesPathExist,
  findSkillPaths,
  listSkillFiles,
  readSkillFile,
  detectMimeType,
} from '../lib/SkillFs';
import { createSkillSearcher } from './SkillSearcher';

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

export function createSkillRegistryController() {
  const store = new Map<string, Skill>();

  const controller: SkillRegistryController = {
    get skills() {
      return Array.from(store.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    get ids() {
      return Array.from(store.keys()).sort();
    },
    delete(_key) {
      store.delete(_key);
    },
    clear: () => store.clear(),
    has: (key) => store.has(key),
    get: (key) => store.get(key),
    set: (key, skill) => {
      store.set(key, skill);
    },
  };

  return controller;
}

/**
 * SkillRegistry manages skill discovery and parsing
 */
export async function createSkillRegistry(
  config: PluginConfig,
  logger: PluginLogger
): Promise<SkillRegistry> {
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
    errors: [],
  };

  const initialise = async () => {
    // Find all SKILL.md files recursively
    const paths: string[] = [];
    for (const basePath of config.basePaths.filter(doesPathExist)) {
      const found = await findSkillPaths(basePath);
      paths.push(...found);
    }
    logger.debug('[SkillRegistryController] skills.discovered', paths);
    debug.discovered = paths.length;

    const results = await register(...paths);

    debug.parsed = results.parsed;
    debug.rejected = results.rejected;
    debug.errors = results.errors;
  };

  const matchBasePath = (absolutePath: string): string | null => {
    for (const basePath of config.basePaths) {
      if (absolutePath.startsWith(basePath)) {
        return basePath;
      }
    }
    return null;
  };

  const register = async (...paths: string[]) => {
    logger.debug(`[SkillRegistryController] register [${paths.length}] skills`);
    const summary: SkillRegistryDebugInfo = {
      discovered: paths.length,
      parsed: 0,
      rejected: 0,
      errors: [],
    };

    for await (const path of paths) {
      try {
        logger.debug('[SkillRegistryController] readSkill', path);
        const content = await readSkillFile(path);

        logger.debug('[SkillRegistryController] parseSkill', path);
        const skill = await parseSkill({
          skillPath: path,
          basePath: matchBasePath(path) || '',
          content,
        });

        if (!skill) {
          summary.rejected++;
          summary.errors.push(`[NOSKILLERROR] Failed to parse skill at ${path}`);
          logger.debug('[SkillRegistryController] error [NOSKILLERROR]', path, '=> NO SKILL');
          continue;
        }

        // Register skill (or overwrite if same path)
        controller.set(skill.toolName, skill);
        logger.debug('[SkillRegistryController] registered skill', skill.toolName, 'at', path);
        summary.parsed++;
      } catch (error) {
        summary.rejected++;
        summary.errors.push(
          error instanceof Error ? error.message : `[UNKNOWNERROR] Unknown error at ${path}`
        );
        continue;
      }
    }
    logger.debug('errors', JSON.stringify(summary.errors, null, 2));
    return summary;
  };

  const search = createSkillSearcher(controller);

  return { controller, initialise, register, search, debug, logger };
}

/**
 * Parse a SKILL.md file and return structured skill data
 * Returns null if parsing fails (with error logging)
 */
async function parseSkill(args: {
  skillPath: string;
  basePath: string;
  content?: string;
}): Promise<Skill | null> {
  const relativePath = relative(args.basePath, args.skillPath);

  if (!relativePath) {
    throw new Error(`❌ Skill path does not match expected pattern: ${args.skillPath}`);
  }

  if (!args.content) {
    throw new Error(`❌ Unable to read skill file: ${args.skillPath}`);
  }

  // Parse YAML frontmatter
  const parsed = matter(args.content);

  // Validate frontmatter schema
  const frontmatter = SkillFrontmatterSchema.safeParse(parsed.data);
  if (!frontmatter.success) {
    throw new Error(
      `[FrontMatterInvalid] ${args.skillPath} [${JSON.stringify(frontmatter.error.issues)}]`,
      {
        cause: frontmatter.error,
      }
    );
  }

  // Use directory name as skill name (shortName)
  const shortName = basename(dirname(args.skillPath));

  // Generate tool name from path
  const skillFullPath = dirname(args.skillPath);

  const scriptPaths = listSkillFiles(skillFullPath, 'scripts');
  const referencePaths = listSkillFiles(skillFullPath, 'references');
  const assetPaths = listSkillFiles(skillFullPath, 'assets');

  return {
    allowedTools: frontmatter.data['allowed-tools'],
    content: parsed.content.trim(),
    description: frontmatter.data.description,
    fullPath: skillFullPath,
    toolName: toolName(relativePath),
    license: frontmatter.data.license,
    metadata: frontmatter.data.metadata,
    name: shortName,
    path: args.skillPath,
    scripts: createSkillResourceMap(skillFullPath, scriptPaths),
    references: createSkillResourceMap(skillFullPath, referencePaths),
    assets: createSkillResourceMap(skillFullPath, assetPaths),
  };
}

export function createSkillResourceMap(skillPath: string, filePaths: string[]): SkillResourceMap {
  const output: SkillResourceMap = new Map();

  for (const filePath of filePaths) {
    const relativePath = relative(skillPath, filePath);
    output.set(relativePath, {
      absolutePath: filePath,
      mimeType: detectMimeType(filePath),
    });
  }

  return output;
}
