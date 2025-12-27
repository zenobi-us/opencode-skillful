import { test, describe } from 'bun:test';
import { expect } from 'bun:test';
import { createSkillResourceResolver } from './SkillResourceResolver';
import { createSkillRegistry } from './SkillRegistry';

/**
 * Unit tests for SkillResourceResolver service
 * Tests resource path resolution and file loading with memfs
 */

describe('SkillResourceResolver', () => {
  async function createMockResolver() {
    const config = { basePaths: ['/skills', '/place/that/doesnt/exist'], debug: false };
    const registry = await createSkillRegistry(config, console);
    await registry.initialise();
    return createSkillResourceResolver(registry);
  }

  describe('resolveSkillResource', () => {
    /**
     * Test: Successfully read reference type resources from memfs
     *
     * - Setup mock resolver with in-memory file system
     * - Request a reference resource from a test skill
     * - Verify the content matches expected data
     *
     * @note relative references to resource files must
     * be relative to the SKILL.md location
     */
    test('should successfully read reference type resources from memfs', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'test_skill',
        type: 'reference',
        relative_path: 'references/guide.md',
      });
      expect(resource.content).toBe('# Guide\nThis is a guide.');
    });

    test('should successfully read script type resources from memfs', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'test_skill',
        type: 'script',
        relative_path: 'scripts/build.sh',
      });
      expect(resource.content).toBe('#!/bin/bash\necho "Building..."');
    });

    test('should successfully read asset type resources from memfs', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'test_skill',
        type: 'asset',
        relative_path: 'assets/logo.svg',
      });
      expect(resource.content).toBe('<svg></svg>');
      expect(resource.mimeType).toBe('image/svg+xml');
    });

    test('should handle skill not found error', async () => {
      const resolver = await createMockResolver();
      try {
        await resolver({
          skill_name: 'nonexistent-skill',
          type: 'reference',
          relative_path: 'references/guide.md',
        });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Skill not found');
      }
    });

    test('should prevent path traversal attempts with ../', async () => {
      const resolver = await createMockResolver();
      try {
        await resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: '../../../etc/passwd',
        });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Resource not found');
      }
    });

    test('should prevent multiple path traversal escape attempts', async () => {
      const resolver = await createMockResolver();
      const traversalAttempts = ['../../../etc/passwd', '../../secrets.txt', '../.ssh/id_rsa'];

      for (const attempt of traversalAttempts) {
        try {
          await resolver({
            skill_name: 'test_skill',
            type: 'reference',
            relative_path: attempt,
          });
          expect.unreachable('Should have thrown');
        } catch (error) {
          expect((error as Error).message).toContain('Resource not found');
        }
      }
    });

    test('should handle missing resource files with clear error', async () => {
      const resolver = await createMockResolver();
      try {
        await resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: 'references/nonexistent.md',
        });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Resource not found');
      }
    });

    test('should safely handle absolute paths (normalized to skill dir)', async () => {
      const resolver = await createMockResolver();
      try {
        await resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: '/etc/passwd',
        });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Resource not found');
      }
    });

    test('should validate that resolved path stays within skill boundary', async () => {
      const resolver = await createMockResolver();
      try {
        await resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: '../other-skill/file.md',
        });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Resource not found');
      }
    });
  });
});
