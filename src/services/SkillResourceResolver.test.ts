import { test, describe } from 'bun:test';
import { expect } from 'bun:test';
import { createSkillResourceResolver } from './SkillResourceResolver';
import { createSkillProvider } from './SkillProvider';
import { createSkillRegistry } from './SkillRegistry';
/**
 * Unit tests for SkillResourceResolver service
 * Tests resource path resolution and file loading with memfs
 */

describe('SkillResourceResolver', () => {
  async function createMockResolver() {
    const config = { basePaths: ['/skills'], debug: false };
    const controller = await createSkillRegistry(config, console);
    const provider = createSkillProvider({
      controller: controller.controller,
      debug: controller.debug,
      logger: console,
      config,
    });
    return createSkillResourceResolver(provider);
  }

  describe('resolveSkillResource', () => {
    test('should successfully read reference type resources from memfs', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'test_skill',
        type: 'reference',
        relative_path: 'guide.md',
      });
      expect(resource.content).toBe('# Guide\nThis is a guide.');
    });
    //
    // test('should successfully read script type resources from memfs', async () => {
    //   const resolver = await createMockResolver();
    //   const resource = await resolver({
    //     skill_name: 'test_skill',
    //     type: 'script',
    //     relative_path: 'build.sh',
    //   });
    //   expect(resource.content).toBe('#!/bin/bash\necho "Building..."');
    // });
    //
    // test('should successfully read asset type resources from memfs', async () => {
    //   const resolver = await createMockResolver();
    //   const resource = await resolver({
    //     skill_name: 'test_skill',
    //     type: 'asset',
    //     relative_path: 'logo.svg',
    //   });
    //   expect(resource.content).toBe('<svg></svg>');
    // });
    //
    // test('should handle skill not found error', async () => {
    //   const resolver = await createMockResolver();
    //   try {
    //     await resolver({
    //       skill_name: 'nonexistent-skill',
    //       type: 'reference',
    //       relative_path: 'guide.md',
    //     });
    //     expect.unreachable('Should have thrown');
    //   } catch (error) {
    //     expect((error as Error).message).toContain('Skill not found');
    //   }
    // });
    //
    // test('should safely prevent path traversal attempts with ../', async () => {
    //   const resolver = await createMockResolver();
    //   try {
    //     await resolver({
    //       skill_name: 'test_skill',
    //       type: 'reference',
    //       relative_path: '../../../etc/passwd',
    //     });
    //     expect.unreachable('Should have thrown');
    //   } catch (error) {
    //     expect((error as Error).message).toContain('Path traversal attempt detected');
    //   }
    // });
    //
    // test('should prevent multiple path traversal escape attempts', async () => {
    //   const resolver = await createMockResolver();
    //   const traversalAttempts = ['../../../etc/passwd', '../../secrets.txt', '../.ssh/id_rsa'];
    //
    //   for (const attempt of traversalAttempts) {
    //     try {
    //       await resolver({
    //         skill_name: 'test_skill',
    //         type: 'reference',
    //         relative_path: attempt,
    //       });
    //       expect.unreachable('Should have thrown');
    //     } catch (error) {
    //       expect((error as Error).message).toContain('Path traversal attempt detected');
    //     }
    //   }
    // });
    //
    // test('should handle missing resource files with clear error', async () => {
    //   const resolver = await createMockResolver();
    //   try {
    //     await resolver({
    //       skill_name: 'test_skill',
    //       type: 'reference',
    //       relative_path: 'nonexistent.md',
    //     });
    //     expect.unreachable('Should have thrown');
    //   } catch (error) {
    //     expect((error as Error).message).toContain('ENOENT');
    //   }
    // });
    //
    // test('should safely handle absolute paths (normalized to skill dir)', async () => {
    //   const resolver = await createMockResolver();
    //   try {
    //     await resolver({
    //       skill_name: 'test_skill',
    //       type: 'reference',
    //       relative_path: '/etc/passwd',
    //     });
    //     expect.unreachable('Should have thrown');
    //   } catch (error) {
    //     expect((error as Error).message).toContain('ENOENT');
    //   }
    // });
    //
    // test('should validate that resolved path stays within skill boundary', async () => {
    //   const resolver = await createMockResolver();
    //   try {
    //     await resolver({
    //       skill_name: 'test_skill',
    //       type: 'reference',
    //       relative_path: '../other-skill/file.md',
    //     });
    //     expect.unreachable('Should have thrown');
    //   } catch (error) {
    //     expect((error as Error).message).toContain('Path traversal attempt detected');
    //   }
    // });
  });
});
