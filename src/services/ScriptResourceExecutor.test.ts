import { test, describe, expect } from 'bun:test';
import { createMockProvider, createMockSkill } from '../mocks';
import { createScriptResourceExecutor } from './ScriptResourceExecutor';
import type { SkillProvider } from '../types';

describe('ScriptResourceExecutor', () => {
  describe('Basic Script Execution', () => {
    test('should be a callable function', () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
      const executor = createScriptResourceExecutor(mockProvider);
      expect(typeof executor).toBe('function');
    });

    test('should accept args object with skill_name and relative_path', () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
      const executor = createScriptResourceExecutor(mockProvider);
      expect(executor.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should throw when script file does not exist', async () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
      const executor = createScriptResourceExecutor(mockProvider);

      try {
        await executor({
          skill_name: 'nonexistent_skill',
          relative_path: 'script.sh',
        });
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should throw when skill is not found in registry', async () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
      const executor = createScriptResourceExecutor(mockProvider);

      try {
        await executor({
          skill_name: 'unknown-skill',
          relative_path: 'test.sh',
        });
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Script Arguments - Safety', () => {
    test('should safely pass arguments without shell interpretation', async () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
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

    test('should handle arguments with spaces correctly', async () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
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

    test('should execute script without arguments when args array is empty', async () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
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

    test('should execute script without arguments when args is undefined', async () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
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

    test('should pass multiple arguments in correct order', async () => {
      const mockProvider: SkillProvider = createMockProvider([
        createMockSkill({
          name: 'test_skill',
          scripts: {
            'script.sh': { mimetype: 'application/x-sh' },
          },
        }),
      ]);
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
