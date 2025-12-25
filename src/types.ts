/**
 * Type definitions for OpenCode Skills Plugin
 */

/**
 * Skill resource map type
 * Key: relative path
 * Value: object with mimetype
 */
export type SkillResourceMap = Record<string, { mimetype: string }>;

/**
 * Skill definition parsed from SKILL.md
 */
export type Skill = {
  name: string; // From frontmatter (e.g., "brand-guidelines")
  fullPath: string; // Full directory path to skill
  toolName: string; // Generated tool name (e.g., "skills_brand_guidelines")
  description: string; // From frontmatter
  allowedTools?: string[]; // Parsed but not enforced (agent-level restrictions instead)
  metadata?: Record<string, string>;
  license?: string;
  content: string; // Markdown body
  path: string; // Full path to SKILL.md
  scripts: Record<string, { mimetype: string }>; // Script resources
  references: Record<string, { mimetype: string }>; // Other resources
  assets: Record<string, { mimetype: string }>; // Other resources
};

/**
 * Text segment from parsed search query
 */
export type TextSegment = {
  text: string;
  negated: boolean;
};

/**
 * Parsed query structure from search-string
 */
export type ParsedSkillQuery = {
  include: string[]; // Positive search terms
  exclude: string[]; // Negative search terms (-term)
  originalQuery: string; // Original query string
  hasExclusions: boolean; // Flag for user feedback
  termCount: number; // Total number of terms
};

/**
 * Search result with ranking and feedback
 */
export type SkillSearchResult = {
  matches: Skill[]; // Ranked skill matches
  totalMatches: number; // Total count before exclusions
  totalSkills: number; // Total skills in registry
  feedback: string; // User-friendly interpretation message
  query: ParsedSkillQuery; // Parsed query structure
};

/**
 * Ranking metrics for a skill match
 */
export type SkillRank = {
  skill: Skill;
  nameMatches: number; // How many terms matched the skill name
  descMatches: number; // How many terms matched the description
  totalScore: number; // Composite rank score
};

/**
 * Plugin configuration
 */
export type PluginConfig = {
  debug: boolean;
  basePaths: string | string[];
};

export type PluginLogger = {
  debug: (...message: unknown[]) => void;
  log: (...message: unknown[]) => void;
  error: (...message: unknown[]) => void;
  warn: (...message: unknown[]) => void;
};

/**
 * Skill registry map type
 */
export type SkillRegistry = Map<string, Skill>;

/**
 * Skill searcher function type
 */
export type SkillSearcher = (_query: string) => SkillSearchResult;

/**
 * Skill registry controller interface
 */
export type SkillRegistryController = {
  skills: Skill[];
  ids: string[];
  has: (_key: string) => boolean;
  get: (_key: string) => Skill | undefined;
  add: (_key: string, _skill: Skill) => void;
};

export type SkillRegistryDebugInfo = {
  discovered: number;
  parsed: number;
  rejected: number;
  errors: string[];
  duplicates: number;
};

export type SkillProvider = {
  registry: SkillRegistryController;
  searcher: SkillSearcher;
  debug?: SkillRegistryDebugInfo;
  logger: PluginLogger;
};
