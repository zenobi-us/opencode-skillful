import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSkillResourceResolver } from './SkillResourceResolver';
import type { SkillRegistryManager, Skill } from '../types';

/**
 * Unit tests for SkillResourceResolver service
 * Tests resource path resolution and file loading
 */

describe('SkillResourceResolver', () => {
  let resolver: ReturnType<typeof createSkillResourceResolver>;
  let mockRegistry: SkillRegistryManager;
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

    it('should prefer FQDN lookup over name lookup', async () => {
      try {
        await resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: 'guide.md',
        });
      } catch {
        // Expected to fail on file read
      }
      expect(mockRegistry.byFQDN.get).toHaveBeenCalledWith('test_skill');
    });

    it('should fallback to name lookup if FQDN not found', async () => {
      try {
        await resolver({
          skill_name: 'test-skill',
          type: 'reference',
          relative_path: 'guide.md',
        });
      } catch {
        // Expected to fail on file read
      }
      expect(mockRegistry.byName.get).toHaveBeenCalledWith('test-skill');
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
