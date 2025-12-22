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

import { sep, join, dirname, basename } from 'node:path';
import os from 'os';

import type { Plugin, PluginInput, ToolContext, ToolDefinition } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import envPaths from 'env-paths';
import matter from 'gray-matter';
import { mergeDeepLeft } from 'ramda';
import SearchString from 'search-string';

// Types
type Skill = {
  name: string; // From frontmatter (e.g., "brand-guidelines")
  fullPath: string; // Full directory path to skill
  toolName: string; // Generated tool name (e.g., "skills_brand_guidelines")
  description: string; // From frontmatter
  allowedTools?: string[]; // Parsed but not enforced (agent-level restrictions instead)
  metadata?: Record<string, string>;
  license?: string;
  content: string; // Markdown body
  path: string; // Full path to SKILL.md
};

/**
 * Text segment from parsed search query
 */
type TextSegment = {
  text: string;
  negated: boolean;
};

/**
 * Parsed query structure from search-string
 */
type ParsedSkillQuery = {
  include: string[]; // Positive search terms
  exclude: string[]; // Negative search terms (-term)
  originalQuery: string; // Original query string
  hasExclusions: boolean; // Flag for user feedback
  termCount: number; // Total number of terms
};

/**
 * Search result with ranking and feedback
 */
type SkillSearchResult = {
  matches: Skill[]; // Ranked skill matches
  totalMatches: number; // Total count before exclusions
  feedback: string; // User-friendly interpretation message
  query: ParsedSkillQuery; // Parsed query structure
};

/**
 * Ranking metrics for a skill match
 */
type SkillRank = {
  skill: Skill;
  nameMatches: number; // How many terms matched the skill name
  descMatches: number; // How many terms matched the description
  totalScore: number; // Composite rank score
};
type PluginConfig = {
  debug: boolean;
  basePaths: string | string[];
};

/**
 * SkillSearcher - Natural Language Query Parser for Skills
 *
 * Provides clean abstraction over search-string library for skill discovery.
 * Handles query parsing, ranking, and result formatting with support for:
 * - Natural syntax (Gmail-style)
 * - Negation (-term)
 * - Quoted phrases
 * - Multiple search terms (AND logic)
 */
class SkillSearcher {
  private skills: Skill[];

  constructor(skills: Skill[]) {
    this.skills = skills;
  }

  /**
   * Parse a user query into structured search terms
   */
  private parseQuery(queryString: string): ParsedSkillQuery {
    const searchStringInstance = SearchString.parse(queryString);

    const textSegments = searchStringInstance.getTextSegments() as TextSegment[];
    const include = textSegments
      .filter((s: TextSegment) => !s.negated)
      .map((s: TextSegment) => s.text.toLowerCase())
      .filter((s: string) => s.length > 0);

    const exclude = textSegments
      .filter((s: TextSegment) => s.negated)
      .map((s: TextSegment) => s.text.toLowerCase())
      .filter((s: string) => s.length > 0);

    return {
      include,
      exclude,
      originalQuery: queryString,
      hasExclusions: exclude.length > 0,
      termCount: textSegments.length,
    };
  }

  /**
   * Calculate ranking score for a skill against query terms
   */
  private rankSkill(skill: Skill, includeTerms: string[]): SkillRank {
    const skillName = skill.name.toLowerCase();
    const skillDesc = skill.description.toLowerCase();

    let nameMatches = 0;
    let descMatches = 0;

    for (const term of includeTerms) {
      if (skillName.includes(term)) {
        nameMatches++;
      } else if (skillDesc.includes(term)) {
        descMatches++;
      }
    }

    let exactBonus = 0;
    if (includeTerms.length === 1 && skillName === includeTerms[0]) {
      exactBonus = 10;
    }

    const totalScore = nameMatches * 3 + descMatches * 1 + exactBonus;

    return { skill, nameMatches, descMatches, totalScore };
  }

  /**
   * Filter out skills matching exclusion terms
   */
  private shouldIncludeSkill(skill: Skill, excludeTerms: string[]): boolean {
    if (excludeTerms.length === 0) {
      return true;
    }

    const haystack = `${skill.name} ${skill.description}`.toLowerCase();
    return !excludeTerms.some((term) => haystack.includes(term));
  }

  /**
   * Generate user-friendly feedback about query interpretation
   */
  private generateFeedback(query: ParsedSkillQuery, matchCount: number): string {
    const parts: string[] = [];

    if (query.include.length > 0) {
      parts.push(`📝 Searching for: **${query.include.join(', ')}**`);
    }

    if (query.hasExclusions) {
      parts.push(`🚫 Excluding: **${query.exclude.join(', ')}**`);
    }

    if (matchCount === 0) {
      parts.push(`❌ No matches found`);
    } else if (matchCount === 1) {
      parts.push(`✅ Found 1 match`);
    } else {
      parts.push(`✅ Found ${matchCount} matches`);
    }

    return parts.join(' | ');
  }

  /**
   * Execute a search query and return ranked results
   */
  public search(queryString: string): SkillSearchResult {
    const query = this.parseQuery(queryString);

    if (query.include.length === 0) {
      return {
        matches: [],
        totalMatches: 0,
        feedback: this.generateFeedback(query, 0),
        query,
      };
    }

    let results = this.skills.filter((skill) => {
      const haystack = `${skill.name} ${skill.description}`.toLowerCase();
      return query.include.every((term) => haystack.includes(term));
    });

    const totalMatches = results.length;

    results = results.filter((skill) => this.shouldIncludeSkill(skill, query.exclude));

    const ranked: SkillRank[] = results
      .map((skill) => this.rankSkill(skill, query.include))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (b.nameMatches !== a.nameMatches) {
          return b.nameMatches - a.nameMatches;
        }
        return a.skill.name.localeCompare(b.skill.name);
      });

    const matches = ranked.map((r) => r.skill);
    const feedback = this.generateFeedback(query, matches.length);

    return {
      matches,
      totalMatches,
      feedback,
      query,
    };
  }
}

type SkillRegistry = Map<string, Skill>;
type SkillRegistryController = {
  registry: SkillRegistry;
  has: (_key: string) => boolean;
  get: (_key: string) => Skill | undefined;
  add: (_key: string, _skill: Skill) => void;
  search: (..._args: string[]) => Skill[];
};
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

type SkillRegistryManager = {
  byFQDN: SkillRegistryController;
  byName: SkillRegistryController;
  search: (_query: string) => Skill[];
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

/**
 * Generate tool name from skill path
 * Examples:
 *   skills/brand-guidelines/SKILL.md → skills_brand_guidelines
 *   skills/document-skills/docx/SKILL.md → skills_document_skills_docx
 *   skills/image-processing/SKILL.md → skills_image_processing
 */
function toolName(skillPath: string): string {
  return skillPath
    .split(sep)
    .join('_')
    .replace(/SKILL\.md$/, '') // Remove trailing /SKILL.md or \SKILL.md
    .replace(/-/g, '_'); // Replace hyphens with underscores
}

type DiscoveredSkillPath = {
  basePath: string;
  absolutePath: string;
};

async function findSkillPaths(basePaths: string | string[]) {
  const basePathsArray = Array.isArray(basePaths) ? basePaths : [basePaths];
  const glob = new Bun.Glob('**/SKILL.md');
  const skills: DiscoveredSkillPath[] = [];
  try {
    for (const basePath of basePathsArray) {
      for await (const skill of glob.scan({
        cwd: basePath,
        absolute: true,
        onlyFiles: true,
        followSymlinks: true,
      })) {
        skills.push({
          basePath,
          absolutePath: skill,
        });
      }
    }
  } catch (error) {
    //
    console.error(
      `❌ Error finding skill paths:`,
      error instanceof Error ? error.message : String(error)
    );
    //
  }

  return skills;
}

/**
 * Parse a SKILL.md file and return structured skill data
 * Returns null if parsing fails (with error logging)
 */
async function parseSkill(skillPath: DiscoveredSkillPath): Promise<Skill | null> {
  try {
    const relativePath = skillPath.absolutePath.replace(skillPath.basePath + sep, '');

    if (!relativePath) {
      console.error(`❌ Skill path does not match expected pattern: ${skillPath}`);
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
    const skillDir = basename(dirname(skillPath.absolutePath));
    if (frontmatter.data.name !== skillDir) {
      console.error(
        `❌ Name mismatch in ${skillPath.absolutePath}:`,
        `\n   Frontmatter name: "${frontmatter.data.name}"`,
        `\n   Directory name: "${skillDir}"`,
        `\n   Fix: Update the 'name' field in SKILL.md to match the directory name`
      );
      return null;
    }

    // Generate tool name from path

    return {
      allowedTools: frontmatter.data['allowed-tools'],
      content: parsed.content.trim(),
      description: frontmatter.data.description,
      fullPath: dirname(skillPath.absolutePath),
      toolName: toolName(relativePath),
      license: frontmatter.data.license,
      metadata: frontmatter.data.metadata,
      name: frontmatter.data.name,
      path: skillPath.absolutePath,
    };
  } catch (error) {
    console.error(
      `❌ Error parsing skill ${skillPath.absolutePath}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

function createInstructionInjector(ctx: PluginInput) {
  // Message 1: Skill loading header (silent insertion - no AI response)
  const sendPrompt = async (text: string, props: { sessionId: string }) => {
    ctx.client.session.prompt({
      path: { id: props.sessionId },
      body: {
        noReply: true,
        parts: [{ type: 'text', text }],
      },
    });
  };
  return sendPrompt;
}

/**
 * Load a single skill into the chat
 */
async function loadSkill(skill: Skill, options: { ctx: PluginInput; sessionID: string }) {
  const sendPrompt = createInstructionInjector(options.ctx);
  await sendPrompt(`The "${skill.name}" skill is loading\n${skill.name}`, {
    sessionId: options.sessionID,
  });
  await sendPrompt(`Base directory for this skill: ${skill.fullPath}\n\n${skill.content}`, {
    sessionId: options.sessionID,
  });
}

/**
 * Load multiple skills into the chat
 */
async function loadSkills(
  skillNames: string[],
  manager: SkillRegistryManager,
  options: { ctx: PluginInput; sessionID: string }
) {
  const loaded: string[] = [];
  const notFound: string[] = [];

  for (const skillName of skillNames) {
    // Try to find skill by toolName first (primary key), then by name (backward compat)
    let skill = manager.byFQDN.get(skillName);
    if (!skill) {
      skill = manager.byName.get(skillName);
    }

    if (!skill) {
      notFound.push(skillName);
      continue;
    }

    await loadSkill(skill, {
      ctx: options.ctx,
      sessionID: options.sessionID,
    });
    loaded.push(skill.toolName);
  }

  return { loaded, notFound };
}

/**
 * Tool to use (load) one or more skills
 */
function createUseSkillsTool(ctx: PluginInput, registry: SkillRegistryManager): ToolDefinition {
  return tool({
    description:
      'Load one or more skills into the chat. Provide an array of skill names to load them as user messages.',
    args: {
      skill_names: tool.schema
        .array(tool.schema.string())
        .min(1, 'Must provide at least one skill name'),
    },
    execute: async (args, toolCtx: ToolContext) => {
      const response = await loadSkills(args.skill_names, registry, {
        ctx,
        sessionID: toolCtx.sessionID,
      });

      let result = `Loaded ${response.loaded.length} skill(s): ${response.loaded.join(', ')}`;
      if (response.notFound.length > 0) {
        result += `\n\nSkills not found: ${response.notFound.join(', ')}`;
      }
      return result;
    },
  });
}

/**
 * Normalize a query string to match against toolName paths
 * Converts slashes and hyphens to underscores for prefix matching
 */
function normalizePathQuery(query: string): string {
  return query.replace(/[/-]/g, '_').toLowerCase();
}

/**
 * Strip the "skills_" prefix from toolName for user-facing matching
 */
function stripSkillsPrefix(toolName: string): string {
  return toolName.replace(/^skills_/, '');
}

/**
 * Tool to search for skills using natural language query syntax
 *
 * The SkillSearcher handles query parsing with support for:
 * - Natural syntax (Gmail-style): "api design"
 * - Negation: "testing -performance"
 * - Quoted phrases: "git commits"
 * - Multiple terms (AND logic): "typescript react testing"
 *
 * Additionally supports path prefix matching:
 * - "experts" → all skills under skills/experts/*
 * - "experts/data-ai" → all skills under that subtree
 * - "*" or empty → list all skills
 */
function createFindSkillsTool(ctx: PluginInput, registry: SkillRegistryManager): ToolDefinition {
  return tool({
    description:
      "Search for skills using natural query syntax. Supports path prefixes (e.g., 'experts', 'superpowers/writing'), negation (-term), quoted phrases, and free text. Use '*' to list all skills.",
    args: {
      query: tool.schema.string(),
    },
    execute: async (args) => {
      const allSkills = Array.from(registry.byName.registry.values());
      const query = args.query.trim();

      // List all skills if query is empty or "*"
      if (query === '' || query === '*') {
        const resultsList = allSkills
          .sort((a, b) => a.toolName.localeCompare(b.toolName))
          .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
          .join('\n');
        return `Found ${allSkills.length} skill(s):\n\n${resultsList}`;
      }

      // Try path prefix matching first
      const normalizedQuery = normalizePathQuery(query);
      const prefixMatches = allSkills.filter((skill) => {
        const shortName = stripSkillsPrefix(skill.toolName);
        return shortName.startsWith(normalizedQuery);
      });

      if (prefixMatches.length > 0) {
        const resultsList = prefixMatches
          .sort((a, b) => a.toolName.localeCompare(b.toolName))
          .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
          .join('\n');
        return `Found ${prefixMatches.length} skill(s) matching path "${query}":\n\n${resultsList}`;
      }

      // Fall back to text search
      const searcher = new SkillSearcher(allSkills);
      const result = searcher.search(query);

      if (result.matches.length === 0) {
        return `${result.feedback}\n\nNo skills found matching "${query}"`;
      }

      const resultsList = result.matches
        .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
        .join('\n');

      return `${result.feedback}\n\n${resultsList}`;
    },
  });
}

/**
 *  Tool to read a resource file from a skill's directory
 */
function createToolResourceReader(
  ctx: PluginInput,
  registry: SkillRegistryManager
): ToolDefinition {
  const sendPrompt = createInstructionInjector(ctx);

  return tool({
    description:
      "Read [[<relative_path>]] from a skill's resources and inject content silently. If loading skills, use the skills_<skillname> instead.",
    args: {
      skill_name: tool.schema.string(),
      relative_path: tool.schema.string(),
    },
    execute: async (args, toolCtx: ToolContext) => {
      // Try to find skill by toolName first, then by name (backward compat)
      let skill = registry.byFQDN.get(args.skill_name) || registry.byName.get(args.skill_name);
      if (!skill) {
        throw new Error(`Skill not found: ${args.skill_name}`);
      }

      const resourcePath = join(skill.fullPath, args.relative_path);
      try {
        const content = await Bun.file(resourcePath).text();

        // Inject content silently
        await sendPrompt(
          `Resource loaded from skill "${skill.name}": ${args.relative_path}\n\n${content}`,
          { sessionId: toolCtx.sessionID }
        );

        return `Resource "${args.relative_path}" from skill "${skill.name}" has been loaded successfully.`;
      } catch (error) {
        throw new Error(
          `Failed to read resource at ${resourcePath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  });
}

/**
 * SkillRegistry manages skill discovery and parsing
 */
async function createSkillRegistry(
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
  const discovered = await findSkillPaths(config.basePaths);
  const dupes: string[] = [];

  for await (const match of discovered) {
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
