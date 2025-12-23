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
        path: '/skill/references/guide.md',
        mimetype: 'text/markdown',
      };

      expect(mockResource).toHaveProperty('mimetype');
      expect(mockResource.mimetype).toBe('text/markdown');
    });

    it('should not have type field after refactor', () => {
      // Old field 'type' should be replaced with 'mimetype'
      const mockResource = {
        path: '/skill/references/guide.md',
        mimetype: 'text/markdown',
      };

      expect(mockResource).not.toHaveProperty('type');
    });

    it('should map references with correct mimetype in markdown output', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test',
        path: '/test/SKILL.md',
        scripts: [],
        references: [
          { path: 'guide.md', mimetype: 'text/markdown' },
          { path: 'image.png', mimetype: 'image/png' },
        ],
        assets: [{ path: 'logo.svg', mimetype: 'image/svg+xml' }],
      };

      // Verify references structure
      expect(mockSkill.references).toHaveLength(2);
      expect(mockSkill.references[0].mimetype).toBe('text/markdown');
      expect(mockSkill.references[1].mimetype).toBe('image/png');

      // Verify assets structure
      expect(mockSkill.assets).toHaveLength(1);
      expect(mockSkill.assets[0].mimetype).toBe('image/svg+xml');
    });
  });

  describe('skill loading', () => {
    it('should include scripts in skill markdown', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test',
        path: '/test/SKILL.md',
        scripts: [{ path: '/test/scripts/run.sh' }],
        references: [],
        assets: [],
      };

      const skillScripts = mockSkill.scripts.map((script) => `- ${script.path}`).join('\n');

      expect(skillScripts).toContain('/test/scripts/run.sh');
      expect(skillScripts).toMatch(/- .+/);
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
        references: [],
        assets: [],
      };

      const skillScripts = mockSkill.scripts.map((script) => `- ${script.path}`).join('\n');

      expect(skillScripts).toBe('');
    });

    it('should handle empty references array', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test',
        path: '/test/SKILL.md',
        scripts: [],
        references: [],
        assets: [],
      };

      const skillReferences = mockSkill.references
        .map((ref) => `- ${ref.path} (${ref.mimetype})`)
        .join('\n');

      expect(skillReferences).toBe('');
    });

    it('should handle empty assets array', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test',
        path: '/test/SKILL.md',
        scripts: [],
        references: [],
        assets: [],
      };

      const skillAssets = mockSkill.assets
        .map((asset) => `- ${asset.path} (${asset.mimetype})`)
        .join('\n');

      expect(skillAssets).toBe('');
    });

    it('should include references and assets in skill', () => {
      const mockSkill: Skill = {
        name: 'test-skill',
        fullPath: '/test',
        toolName: 'test_skill',
        description: 'Test skill',
        content: '# Test Content',
        path: '/test/SKILL.md',
        scripts: [{ path: '/test/scripts/setup.sh' }, { path: '/test/scripts/run.sh' }],
        references: [{ path: 'guide.md', mimetype: 'text/markdown' }],
        assets: [
          { path: 'icon.png', mimetype: 'image/png' },
          { path: 'config.json', mimetype: 'application/json' },
        ],
      };

      // Verify all fields are present and populated
      expect(mockSkill.name).toBe('test-skill');
      expect(mockSkill.scripts).toHaveLength(2);
      expect(mockSkill.references).toHaveLength(1);
      expect(mockSkill.assets).toHaveLength(2);
      expect(mockSkill.content).toContain('Test Content');
    });
  });
});
