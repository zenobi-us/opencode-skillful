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

/**
 * SkillRegistry - Central Skill Discovery, Parsing, and Cataloging
 *
 * WHY: This is the heart of the plugin system. It needs to:
 * 1. Discover all SKILL.md files across multiple base paths (e.g., project-local + user global)
 * 2. Parse each skill's YAML frontmatter (metadata, allowed-tools, etc.)
 * 3. Index all resources (scripts/assets/references) for safe path-based retrieval
 * 4. Coordinate async initialization with a ready state machine
 * 5. Provide search functionality via SkillSearcher
 *
 * DESIGN: Factory pattern with two controllers:
 * - createSkillRegistryController(): lightweight Map-based storage with ready state
 * - createSkillRegistry(): higher-level coordinator with discovery/parsing pipeline
 *
 * KEY RESPONSIBILITIES:
 * - Discovery: scans base paths for SKILL.md files recursively
 * - Parsing: validates YAML frontmatter against schema, extracts markdown content
 * - Resource Mapping: indexes all scripts/assets/references at parse time to prevent
 *   path traversal attacks (caller cannot request arbitrary paths)
 * - Initialization: async process with state tracking (idle → loading → ready/error)
 * - Search Integration: provides SkillSearcher for natural language queries
 *
 * DUPLICATE HANDLING: If the same skill appears in multiple base paths, the last one wins
 * (logged but not an error). Skills are keyed by toolName (derived from relative path).
 *
 * ERROR HANDLING: Parse errors are collected in debug info but don't halt initialization.
 * Malformed SKILL.md files are rejected with error logging, skill discovery continues.
 *
 * FRONTMATTER SCHEMA:
 *   - description: required, min 20 chars (enforced by Zod schema)
 *   - license: optional
 *   - allowed-tools: optional array of tool names
 *   - metadata: optional record of key-value strings
 *
 * EXAMPLE FLOW:
 *   const registry = await createSkillRegistry(config, logger);
 *   await registry.initialise(); // async discovery + parsing
 *   const results = registry.search('git commit');
 *   const skill = registry.controller.get('writing-git-commits');
 */

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
import { createReadyStateMachine } from '../lib/ReadyStateMachine';

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
    ready: createReadyStateMachine(),
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

  /**
   * Initialise - Async skill discovery and parsing pipeline
   *
   * WHY: Registry must scan the file system for all SKILL.md files, parse them,
   * and register them before tools can execute. This async process transitions
   * the ready state machine to signal when discovery is complete.
   *
   * FLOW:
   * 1. Filter base paths to only those that exist (avoid errors on missing dirs)
   * 2. Scan all base paths recursively for SKILL.md files
   * 3. Parse each file with register() helper
   * 4. Collect statistics (discovered, parsed, rejected) and errors
   * 5. Transition ready state to 'ready' or 'error'
   *
   * WHY NOT THROWN ERRORS: If one skill fails to parse, we log it and continue.
   * The plugin should remain usable even if 1 out of 100 skills is malformed.
   */
  const initialise = async () => {
    controller.ready.setStatus('loading');

    try {
      // Find all SKILL.md files recursively
      const paths: string[] = [];
      const existingBasePaths = config.basePaths.filter(doesPathExist);

      if (existingBasePaths.length === 0) {
        logger.warn(
          '[OpencodeSkillful] No valid base paths found for skill discovery:',
          config.basePaths
        );
        controller.ready.setStatus('ready');
        return;
      }

      logger.debug(
        '[SkillRegistryController] Discovering skills in base paths:',
        existingBasePaths
      );

      for (const basePath of existingBasePaths) {
        const found = await findSkillPaths(basePath);
        paths.push(...found);
      }

      logger.debug('[SkillRegistryController] skills.discovered', paths.length);
      debug.discovered = paths.length;

      if (paths.length === 0) {
        controller.ready.setStatus('ready');
        logger.debug('[SkillRegistryController] No skills found');
        return;
      }

      const results = await register(...paths);

      logger.debug('[SkillRegistryController] skills.initialise results', results);

      debug.parsed = results.parsed;
      debug.rejected = results.rejected;
      debug.errors = results.errors;

      controller.ready.setStatus('ready');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[SkillRegistryController] Initialization failed:', errorMessage);
      controller.ready.setStatus('error');
    }
  };

  const matchBasePath = (absolutePath: string): string | null => {
    for (const basePath of config.basePaths) {
      if (absolutePath.startsWith(basePath)) {
        return basePath;
      }
    }
    return null;
  };

  /**
   * Register - Parse and store multiple skill files
   *
   * WHY: Separated from initialise() to allow both initial discovery registration
   * and potential live registration of new skills (future feature).
   *
   * ALGORITHM:
   * 1. Read each skill file's content
   * 2. Parse it via parseSkill() helper (validates frontmatter, indexes resources)
   * 3. If parse succeeds, store in controller.skills Map by toolName
   * 4. If parse fails, log error and continue (resilient to corrupted files)
   * 5. Return summary for logging/debugging
   *
   * WHY AWAIT ON parseSkill: Each file read is async, no parallelization needed
   * since we're I/O bound and want strict ordering for consistent results.
   */
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
        const content = await readSkillFile(path);

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

  const isSkillPath = (path: string) => {
    return (
      path.endsWith('SKILL.md') && config.basePaths.some((basePath) => path.startsWith(basePath))
    );
  };
  const getToolnameFromSkillPath = (path: string): string | null => {
    if (!isSkillPath(path)) {
      return null;
    }
    const relativePath = relative(
      config.basePaths.find((basePath) => path.startsWith(basePath)) || '',
      path
    );
    return toolName(relativePath);
  };

  const search = createSkillSearcher(controller);

  return {
    config,
    controller,
    initialise,
    register,
    isSkillPath,
    getToolnameFromSkillPath,
    search,
    debug,
    logger,
  };
}

/**
 * Parse a SKILL.md file and return structured skill data
 *
 * WHY: Encapsulates the complex multi-step parsing pipeline to keep register() clean.
 * Each SKILL.md file has YAML frontmatter followed by markdown content. We need to:
 * 1. Extract and validate the YAML metadata
 * 2. Build the skill name from directory structure
 * 3. Index all resources (scripts, references, assets) for safe retrieval
 * 4. Return a complete Skill object or null on error
 *
 * CRITICAL SECURITY: All resource paths are computed at parse time and stored in
 * script/reference/asset Maps. Tools later retrieve by key, never by arbitrary path.
 * This prevents path traversal attacks (no way to request ../../../etc/passwd).
 *
 * WHY YAML FRONTMATTER: Standard markdown pattern (used by Jekyll, Next.js, etc).
 * Allows skill metadata to be human-readable and editable alongside content.
 *
 * TOOL NAME DERIVATION: Takes relative path from base path and converts to tool name.
 * Example: "skills/writing/git-commits/SKILL.md" → "writing_git_commits"
 *
 * @returns Skill object on success, null on error (with error logging)
 * @throws Error with detailed message if parsing fails validation
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
