import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSkillResourceResolver } from './SkillResourceResolver';
import type { SkillProvider } from '../types';
import { createMockProvider, createMockSkill } from '../mocks';

/**
 * Unit tests for SkillResourceResolver service
 * Tests resource path resolution and file loading
 */

describe('SkillResourceResolver', () => {
  let resolver: ReturnType<typeof createSkillResourceResolver>;
  let mockRegistry: SkillProvider;

  beforeEach(() => {
    const testSkill = createMockSkill({
      name: 'test-skill',
      fullPath: '/skills/test-skill',
      toolName: 'test_skill',
      description: 'Test skill',
      content: '# Test Skill',
      path: '/skills/test-skill/SKILL.md',
      scripts: {
        'build.sh': { mimetype: 'application/x-sh' },
      },
      references: {
        'guide.md': { mimetype: 'text/markdown' },
      },
      assets: {
        'logo.svg': { mimetype: 'image/svg+xml' },
      },
    });

    mockRegistry = createMockProvider([testSkill]);
    // Update the registry.get mock to handle both formats
    vi.mocked(mockRegistry.registry.get).mockImplementation((key: string) => {
      if (key === 'test_skill' || key === 'test-skill') {
        return testSkill;
      }
      return undefined;
    });

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

    it('should safely contain path traversal attempts with ../', async () => {
      try {
        await resolver({
          skill_name: 'test-skill',
          type: 'reference',
          relative_path: '../../../etc/passwd',
        });
      } catch (error) {
        // Path traversal is now blocked by validation
        expect((error as Error).message).toContain('Path traversal attempt detected');
      }
    });

    it('should prevent path traversal from escaping skill directory', async () => {
      // Multiple attempts to escape should all be rejected
      const traversalAttempts = ['../../../etc/passwd', '../../secrets.txt', '../.ssh/id_rsa'];

      for (const attempt of traversalAttempts) {
        await expect(
          resolver({
            skill_name: 'test-skill',
            type: 'reference',
            relative_path: attempt,
          })
        ).rejects.toThrow('Path traversal attempt detected');
      }
    });

    it('should handle missing resource files with clear error', async () => {
      await expect(
        resolver({
          skill_name: 'test-skill',
          type: 'reference',
          relative_path: 'nonexistent.md',
        })
      ).rejects.toThrow('ENOENT');
    });

    it('should safely handle absolute paths (normalized to skill dir)', async () => {
      // Absolute paths are normalized relative to the skill directory
      // /etc/passwd becomes /skills/test-skill/reference/etc/passwd
      await expect(
        resolver({
          skill_name: 'test-skill',
          type: 'reference',
          relative_path: '/etc/passwd',
        })
      ).rejects.toThrow('ENOENT');
    });

    it('should validate that resolved path stays within skill boundary', async () => {
      await expect(
        resolver({
          skill_name: 'test-skill',
          type: 'reference',
          relative_path: '../other-skill/file.md',
        })
      ).rejects.toThrow('Path traversal attempt detected');
    });
  });
});
