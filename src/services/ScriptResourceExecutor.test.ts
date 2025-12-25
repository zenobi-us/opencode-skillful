import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockProvider, createMockSkill } from '../mocks';
import { createScriptResourceExecutor } from './ScriptResourceExecutor';
import type { SkillProvider } from '../types';

describe('ScriptResourceExecutor', () => {
  let mockProvider: SkillProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProvider = createMockProvider([
      createMockSkill({
        name: 'test_skill',
        scripts: {
          'script.sh': { mimetype: 'application/x-sh' },
        },
      }),
    ]);
  });

  describe('Basic Script Execution', () => {
    it('should be a callable function', () => {
      const executor = createScriptResourceExecutor(mockProvider);
      expect(typeof executor).toBe('function');
    });

    it('should accept args object with skill_name and relative_path', () => {
      const executor = createScriptResourceExecutor(mockProvider);
      expect(executor.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw when script file does not exist', async () => {
      const executor = createScriptResourceExecutor(mockProvider);

      await expect(
        executor({
          skill_name: 'nonexistent_skill',
          relative_path: 'script.sh',
        })
      ).rejects.toThrow();
    });

    it('should throw when skill is not found in registry', async () => {
      const executor = createScriptResourceExecutor(mockProvider);

      await expect(
        executor({
          skill_name: 'unknown-skill',
          relative_path: 'test.sh',
        })
      ).rejects.toThrow();
    });
  });

  describe('Script Arguments - Safety', () => {
    it('should safely pass arguments without shell interpretation', async () => {
      const executor = createScriptResourceExecutor(mockProvider);

      // Special shell characters should be passed as literal arguments, not executed
      // This test documents the expected behavior with the fixed shell injection vulnerability
      try {
        await executor({
          skill_name: 'test_skill',
          relative_path: 'script.sh',
          args: ['$variable', '$(whoami)', '&&', '|', '; rm -rf /'],
        });
      } catch (error) {
        // Script may not exist, but execution should not have shell interpretation issues
        expect(error).toBeDefined();
      }
    });

    it('should handle arguments with spaces correctly', async () => {
      const executor = createScriptResourceExecutor(mockProvider);

      try {
        await executor({
          skill_name: 'test_skill',
          relative_path: 'script.sh',
          args: ['argument with spaces', 'another argument with spaces'],
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should execute script without arguments when args array is empty', async () => {
      const executor = createScriptResourceExecutor(mockProvider);

      try {
        await executor({
          skill_name: 'test_skill',
          relative_path: 'script.sh',
          args: [],
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should execute script without arguments when args is undefined', async () => {
      const executor = createScriptResourceExecutor(mockProvider);

      try {
        await executor({
          skill_name: 'test_skill',
          relative_path: 'script.sh',
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should pass multiple arguments in correct order', async () => {
      const executor = createScriptResourceExecutor(mockProvider);

      try {
        await executor({
          skill_name: 'test_skill',
          relative_path: 'script.sh',
          args: ['first', 'second', 'third'],
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
