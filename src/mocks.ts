import type { Skill, SkillRegistry, SkillRegistryController, SkillSearchResult } from './types';
import { createSkillRegistry, createSkillRegistryController } from './services/SkillRegistry';
import { createLogger } from './services/logger';

/**
 * Creates a mock Skill object with sensible defaults
 * @param overrides Partial skill properties to override defaults
 * @returns A complete Skill object
 */
export function createMockSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    fullPath: '/path/to/skill',
    toolName: 'test_skill',
    path: '/path/to/skill/SKILL.md',
    content: 'Test content',
    scripts: new Map(),
    references: new Map(),
    assets: new Map(),
    ...overrides,
  };
}

/**
 * Creates a mock SkillRegistryController
 * @param skills Array of skills to include in the registry
 * @returns A mock registry controller
 */
export function createMockRegistryController(skills: Skill[] = []): SkillRegistryController {
  const controller = createSkillRegistryController();
  for (const skill of skills) {
    controller.set(skill.toolName, skill);
  }
  return controller;
}

/**
 * Creates a mock SkillProvider with a registry controller
 * @param skills Array of skills to include in the provider
 * @returns A mock skill provider
 */
export async function createMockRegistry(skills: Skill[] = []): Promise<SkillRegistry> {
  const config = createMockConfig();
  const logger = createLogger(config);

  const registry = await createSkillRegistry(config, logger);

  for (const skill of skills) {
    registry.controller.set(skill.toolName, skill);
  }

  return registry;
}

/**
 * Creates a mock SkillSearchResult
 * @param overrides Partial search result properties to override defaults
 * @returns A mock search result
 */
export function mockSearchResult(overrides: Partial<SkillSearchResult> = {}): SkillSearchResult {
  return {
    matches: [],
    totalMatches: 0,
    feedback: 'No results found',
    totalSkills: 0,
    query: {
      exclude: [],
      hasExclusions: false,
      include: [],
      originalQuery: [],
      termCount: 0,
    },
    ...overrides,
  };
}

/**
 * Creates a fully configured mock search result with skill matches and metadata
 * @param skills Array of skill matches to include in the result
 * @param overrides Additional overrides for search result properties
 * @returns A complete search result with proper structure
 */
export function mockFullSearchResult(
  skills: Skill[] = [],
  overrides: Partial<SkillSearchResult> = {}
): SkillSearchResult {
  return mockSearchResult({
    matches: skills,
    totalMatches: skills.length,
    totalSkills: skills.length,
    feedback: skills.length > 0 ? `Found ${skills.length} matches` : 'No results found',
    ...overrides,
  });
}

function createMockConfig() {
  return {
    debug: false,
    basePaths: ['/mock/path/to/skills'],
  };
}
