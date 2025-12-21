/**
 * OpenCode Skills Plugin
 *
 * Implements Anthropic's Agent Skills Specification (v1.0) for OpenCode.
 *
 * Features:
 * - Discovers SKILL.md files from .opencode/skills/, ~/.opencode/skills/, and ~/.config/opencode/skills/
 * - Validates skills against Anthropic's spec (YAML frontmatter + Markdown)
 * - Provides unified skill discovery and loading via two main tools:
 *   - use_skills(): Load one or more skills by name
 *   - find_skills(): Search for skills by free-text query
 * - Delivers skill content via silent message insertion (noReply pattern)
 * - Supports nested skills with proper naming
 *
 * Design Decisions:
 * - Consolidates 50+ individual skill tools into 2 unified tools (cleaner namespace)
 * - Skills are discovered resources, not always-on capabilities
 * - Lazy loading: skills only inject when explicitly requested
 * - Tool restrictions handled at agent level (not skill level)
 * - Message insertion pattern ensures skill content persists (user messages not purged)
 * - Base directory context enables relative path resolution
 * - Skills require restart to reload (acceptable trade-off)
 *
 * @see https://github.com/anthropics/skills
 */

import { join } from 'path';
import os from 'os';

import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import envPaths from 'env-paths';
import { mergeDeepLeft } from 'ramda';

import type { PluginConfig } from './types';
import { createSkillRegistry } from './services/SkillRegistry';
import { createToolResourceReader } from './tools/SkillResourceReader';
import { createUseSkillsTool } from './tools/SkillUser';
import { createFindSkillsTool } from './tools/SkillFinder';

// Re-export types for external consumers
export type {
  Skill,
  TextSegment,
  ParsedSkillQuery,
  SkillSearchResult,
  SkillRank,
  PluginConfig,
  SkillRegistry,
  SkillRegistryController,
  SkillRegistryManager,
} from './types';

const OpenCodePaths = envPaths('opencode', { suffix: '' });

async function getPluginConfig(ctx: PluginInput): Promise<PluginConfig> {
  // const config = await ctx.client.config.get();
  // const resolved = config.data.plugins?.find(skill => skill.name === "opencode-skills");
  const base = {
    debug: false,
    basePaths: [
      join(os.homedir(), '.opencode', 'skills'), // Lowest priority: Non standard user config
      join(OpenCodePaths.config, 'skills'), // Lowest priority: Standard User Config (windows)
      join(ctx.directory, '.opencode', 'skills'), // Highest priority: Project-local
    ],
  };

  return mergeDeepLeft({}, base);
}

export const SkillsPlugin: Plugin = async (ctx) => {
  const config = await getPluginConfig(ctx);
  // Discovery order: lowest to highest priority (last wins on duplicate tool names)
  const registry = await createSkillRegistry(ctx, config);

  return {
    tool: {
      skill_use: createUseSkillsTool(ctx, registry),
      skill_find: createFindSkillsTool(ctx, registry),
      skill_resource: createToolResourceReader(ctx, registry),
    },
  };
};
