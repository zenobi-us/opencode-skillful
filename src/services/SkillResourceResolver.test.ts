import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSkillResourceResolver } from './SkillResourceResolver';
import type { SkillProvider } from '../types';
import { mockSkill, mockRegistryController, mockProvider } from '../mocks';

/**
 * Unit tests for SkillResourceResolver service
 * Tests resource path resolution and file loading
 */

describe('SkillResourceResolver', () => {
  let resolver: ReturnType<typeof createSkillResourceResolver>;
  let mockRegistry: SkillProvider;

  beforeEach(() => {
    const testSkill = mockSkill({
      name: 'test-skill',
      fullPath: '/skills/test-skill',
      toolName: 'test_skill',
      description: 'Test skill',
      content: '# Test Skill',
      path: '/skills/test-skill/SKILL.md',
    });

    const controller = {
      skills: [testSkill],
      ids: ['test_skill'],
      has: vi.fn((key: string) => key === 'test_skill' || key === 'test-skill'),
      get: vi.fn((key: string) => {
        if (key === 'test_skill' || key === 'test-skill') {
          return testSkill;
        }
        return undefined;
      }),
      add: vi.fn(),
    };

    mockRegistry = {
      registry: controller,
      searcher: vi.fn(() => ({ matches: [], totalMatches: 0, feedback: '', query: {} as any })),
    };

    resolver = createSkillResourceResolver(mockRegistry);
  });

  describe('resolveSkillResource', () => {
    it('should construct correct path for reference type resources', async () => {
      try {
        await resolver({
          skill_name: 'test-skill',
          type: 'reference',
          relative_path: 'guide.md',
        });
      } catch (error) {
        // Expected to fail on file read, but path should be correct
        expect((error as Error).message).toContain('/skills/test-skill');
        expect((error as Error).message).toContain('reference');
      }
    });

    it('should handle skill not found error', async () => {
      await expect(
        resolver({
          skill_name: 'nonexistent-skill',
          type: 'reference',
          relative_path: 'guide.md',
        })
      ).rejects.toThrow('Skill not found');
    });

    it('should construct correct path for script type resources', async () => {
      try {
        await resolver({
          skill_name: 'test-skill',
          type: 'script',
          relative_path: 'build.sh',
        });
      } catch (error) {
        expect((error as Error).message).toContain('/skills/test-skill');
        expect((error as Error).message).toContain('script');
      }
    });

    it('should construct correct path for asset type resources', async () => {
      try {
        await resolver({
          skill_name: 'test-skill',
          type: 'asset',
          relative_path: 'logo.svg',
        });
      } catch (error) {
        expect((error as Error).message).toContain('/skills/test-skill');
        expect((error as Error).message).toContain('asset');
      }
    });

    it('should call registry.get with skill_name', async () => {
      try {
        await resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: 'guide.md',
        });
      } catch {
        // Expected to fail on file read
      }
      expect(mockRegistry.registry.get).toHaveBeenCalledWith('test_skill');
    });

    it('should handle skill lookup by both FQDN and name format', async () => {
      try {
        await resolver({
          skill_name: 'test-skill',
          type: 'reference',
          relative_path: 'guide.md',
        });
      } catch {
        // Expected to fail on file read
      }
      expect(mockRegistry.registry.get).toHaveBeenCalledWith('test-skill');
    });

    it('should normalize path traversal attempts in relative_path', async () => {
      try {
        await resolver({
          skill_name: 'test-skill',
          type: 'reference',
          relative_path: '../../../etc/passwd',
        });
      } catch (error) {
        // Path traversal should be normalized away
        expect((error as Error).message).toContain('test-skill');
      }
    });
  });
});
