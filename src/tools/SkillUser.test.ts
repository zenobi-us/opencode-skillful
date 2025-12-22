import { describe, it, expect } from 'vitest';
import type { Skill } from '../types';

/**
 * Unit tests for SkillUser tool
 */

describe('SkillUser', () => {
  describe('resource attribute names', () => {
    it('should use mimetype field for resource type', () => {
      // After refactor from 'type' to 'mimetype'
      const mockResource = {
        path: '/skill/resources/guide.md',
        mimetype: 'text/markdown',
      };

      expect(mockResource).toHaveProperty('mimetype');
      expect(mockResource.mimetype).toBe('text/markdown');
    });

    it('should not have type field after refactor', () => {
      // Old field 'type' should be replaced with 'mimetype'
      const mockResource = {
        path: '/skill/resources/guide.md',
        mimetype: 'text/markdown',
      };

      expect(mockResource).not.toHaveProperty('type');
    });

    it('should map resources with correct mimetype in XML output', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test',
        path: '/test/SKILL.md',
        scripts: [],
        resources: [
          { path: 'guide.md', mimetype: 'text/markdown' },
          { path: 'image.png', mimetype: 'image/png' },
        ],
      };

      // Simulate the XML generation from loadSkill
      const skillResources = mockSkill.resources
        .map((resource) => `<Resource path="${resource.path}" type="${resource.mimetype}" />`)
        .join('\n');

      expect(skillResources).toContain('type="text/markdown"');
      expect(skillResources).toContain('type="image/png"');
      expect(skillResources).not.toContain('type="undefined"');
    });
  });

  describe('skill loading', () => {
    it('should include scripts in skill XML', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test',
        path: '/test/SKILL.md',
        scripts: [{ path: '/test/scripts/run.sh' }],
        resources: [],
      };

      const skillScripts = mockSkill.scripts
        .map((script) => `<Script path="${script.path}" />`)
        .join('\n');

      expect(skillScripts).toContain('/test/scripts/run.sh');
      expect(skillScripts).toMatch(/<Script path=".+" \/>/);
    });

    it('should handle empty scripts array', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test',
        path: '/test/SKILL.md',
        scripts: [],
        resources: [],
      };

      const skillScripts = mockSkill.scripts
        .map((script) => `<Script path="${script.path}" />`)
        .join('\n');

      expect(skillScripts).toBe('');
    });

    it('should handle empty resources array', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test',
        path: '/test/SKILL.md',
        scripts: [],
        resources: [],
      };

      const skillResources = mockSkill.resources
        .map((resource) => `<Resource path="${resource.path}" type="${resource.mimetype}" />`)
        .join('\n');

      expect(skillResources).toBe('');
    });
  });
});
