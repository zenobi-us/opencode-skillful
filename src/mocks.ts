import { vi } from 'vitest';
import type {
  Skill,
  SkillProvider,
  SkillRegistryController,
  SkillRegistryDebugInfo,
  SkillSearchResult,
} from './types';
import { createSkillProvider } from './services/SkillProvider';

/**
 * Creates a mock Skill object with sensible defaults
 * @param overrides Partial skill properties to override defaults
 * @returns A complete Skill object
 */
export function mockSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    fullPath: '/path/to/skill',
    toolName: 'test_skill',
    path: '/path/to/skill/SKILL.md',
    content: 'Test content',
    scripts: [],
    references: [],
    assets: [],
    ...overrides,
  };
}

/**
 * Creates a mock SkillRegistryController
 * @param skills Array of skills to include in the registry
 * @returns A mock registry controller
 */
export function mockRegistryController(skills: Skill[] = []): SkillRegistryController {
  return {
    skills,
    ids: skills.map((s) => s.toolName),
    has: vi.fn((key: string) => skills.some((s) => s.toolName === key)),
    get: vi.fn((key: string) => skills.find((s) => s.toolName === key)),
    add: vi.fn(),
  };
}

/**
 * Creates a mock SkillProvider with a registry controller
 * @param skills Array of skills to include in the provider
 * @returns A mock skill provider
 */
export async function mockProvider(skills: Skill[] = []): Promise<SkillProvider> {
  const controller = mockRegistryController(skills);
  const config = createMockConfig();
  const debug = createMockDebug();
  return await createSkillProvider({
    config,
    controller,
    debug,
  });
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
      originalQuery: '',
      termCount: 0,
    },
    ...overrides,
  };
}

function createMockDebug(): SkillRegistryDebugInfo {
  return {
    parsed: 0,
    discovered: 0,
    duplicates: 0,
    errors: [],
    rejected: 0,
  };
}

function createMockConfig() {
  return {
    debug: false,
    basePaths: ['/mock/path/to/skills'],
  };
}
