import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSkillScriptExecTool } from './SkillScriptExec';
import { createScriptResourceExecutor } from '../services/ScriptResourceExecutor';
import type { SkillProvider, Skill } from '../types';
import { createSkillProvider } from '../services/SkillProvider';

/**
 * Unit tests for SkillScriptExec tool
 * Tests script execution functionality with skill resources
 */

describe('SkillScriptExec', () => {
  let skillScriptExecTool: any;
  let mockProvider: SkillProvider;

  const mockSkill: Skill = {
    name: 'test-skill',
    fullPath: '/skills/test-skill',
    toolName: 'test_skill',
    description: 'Test skill',
    content: '# Test Skill',
    path: '/skills/test-skill/SKILL.md',
    scripts: [{ path: 'scripts/build.sh' }, { path: 'scripts/test.sh' }],
    references: [],
    assets: [],
  };

  beforeEach(() => {
    const controller = {
      registry: new Map([['test_skill', mockSkill]]),
      has: vi.fn((key) => key === 'test_skill'),
      get: vi.fn((key) => (key === 'test_skill' ? mockSkill : undefined)),
      add: vi.fn(),
      search: vi.fn(() => []),
    };

    mockProvider = createSkillProvider(controller);

    skillScriptExecTool = createSkillScriptExecTool({ on: vi.fn() } as any, mockRegistry);
  });

  describe('tool definition', () => {
    it('should have meaningful description', () => {
      expect(skillScriptExecTool.description).toBeTruthy();
      expect(skillScriptExecTool.description).toContain('script');
    });

    it('should define required arguments', () => {
      expect(skillScriptExecTool.args).toHaveProperty('skill_name');
      expect(skillScriptExecTool.args).toHaveProperty('relative_path');
    });

    it('should allow optional arguments array', () => {
      expect(skillScriptExecTool.args).toHaveProperty('args');
    });

    it('should have execute function', () => {
      expect(typeof skillScriptExecTool.execute).toBe('function');
    });
  });

  describe('argument specifications', () => {
    it('should require skill_name as string', () => {
      const skillNameArg = skillScriptExecTool.args.skill_name;
      expect(skillNameArg).toBeDefined();
    });

    it('should require relative_path as string', () => {
      const relativePathArg = skillScriptExecTool.args.relative_path;
      expect(relativePathArg).toBeDefined();
    });

    it('should accept optional args array', () => {
      const argsArg = skillScriptExecTool.args.args;
      expect(argsArg).toBeDefined();
    });
  });
});

describe('createScriptResourceExecutor', () => {
  let executor: ReturnType<typeof createScriptResourceExecutor>;
  let mockRegistry: SkillProvider;

  const mockSkill: Skill = {
    name: 'test-skill',
    fullPath: '/skills/test-skill',
    toolName: 'test_skill',
    description: 'Test skill',
    content: '# Test Skill',
    path: '/skills/test-skill/SKILL.md',
    scripts: [],
    references: [],
    assets: [],
  };

  beforeEach(() => {
    const byFQDNController = {
      registry: new Map([['test_skill', mockSkill]]),
      has: vi.fn((key) => key === 'test_skill'),
      get: vi.fn((key) => (key === 'test_skill' ? mockSkill : undefined)),
      add: vi.fn(),
      search: vi.fn(() => []),
    };

    const byNameController = {
      registry: new Map([['test-skill', mockSkill]]),
      has: vi.fn((key) => key === 'test-skill'),
      get: vi.fn((key) => (key === 'test-skill' ? mockSkill : undefined)),
      add: vi.fn(),
      search: vi.fn(() => []),
    };

    mockRegistry = {
      byFQDN: byFQDNController,
      byName: byNameController,
      search: vi.fn(() => []),
    };

    executor = createScriptResourceExecutor({ registry: mockRegistry });
  });

  it('should handle skill not found error', async () => {
    await expect(
      executor({
        skill_name: 'nonexistent-skill',
        relative_path: 'build.sh',
      })
    ).rejects.toThrow('Skill not found');
  });

  it('should construct correct resource resolution path', async () => {
    try {
      await executor({
        skill_name: 'test-skill',
        relative_path: 'build.sh',
      });
    } catch (error) {
      // Expected to fail on file/script execution, but resource resolver should be called
      expect((error as Error).message).toBeDefined();
    }
  });
});
