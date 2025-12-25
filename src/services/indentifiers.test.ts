import { describe, it, expect } from 'vitest';
import { sep } from 'path';
import { toolName, normalizePathQuery, stripSkillsPrefix } from './identifiers.ts';

describe('identifiers.ts', () => {
  describe('toolName()', () => {
    it('should remove SKILL.md suffix from path', () => {
      expect(toolName('skills/brand-guidelines/SKILL.md')).toContain('skills_brand_guidelines');
    });

    it('should convert path separators to underscores', () => {
      const result = toolName('skills/brand-guidelines/SKILL.md');
      expect(result).not.toContain(sep);
      expect(result).not.toContain('/');
    });

    it('should convert hyphens to underscores', () => {
      expect(toolName('skills/my-cool-skill/SKILL.md')).toBe('skills_my_cool_skill');
    });

    it('should not have trailing underscore', () => {
      const result = toolName('skills/test/SKILL.md');
      expect(result).not.toMatch(/_$/);
    });

    it('should handle nested paths', () => {
      expect(toolName('skills/document-skills/docx/SKILL.md')).toBe('skills_document_skills_docx');
    });

    it('should handle Windows paths correctly', () => {
      // On Windows, backslashes are path separators. On Linux, they're literal characters.
      // The toolName function uses sep from path module, so test with actual separators.
      const windowsPath = 'skills\\brand-guidelines\\SKILL.md';
      const result = toolName(windowsPath);
      // Either way, hyphens should be converted to underscores and SKILL.md removed
      expect(result).toContain('skills');
      expect(result).toContain('brand_guidelines');
      expect(result).not.toContain('SKILL');
    });

    it('should filter out empty segments', () => {
      // Path with trailing/leading separators should be cleaned
      const result = toolName('skills/test//SKILL.md');
      expect(result).not.toContain('__');
    });

    it('should work with deeply nested paths', () => {
      expect(toolName('skills/docs/nested/deep/SKILL.md')).toBe('skills_docs_nested_deep');
    });
  });

  describe('normalizePathQuery()', () => {
    it('should convert slashes to underscores', () => {
      expect(normalizePathQuery('skills/brand-guidelines')).toBe('skills_brand_guidelines');
    });

    it('should convert hyphens to underscores', () => {
      expect(normalizePathQuery('my-cool-skill')).toBe('my_cool_skill');
    });

    it('should convert both slashes and hyphens', () => {
      expect(normalizePathQuery('skills/my-cool-skill')).toBe('skills_my_cool_skill');
    });

    it('should lowercase the result', () => {
      expect(normalizePathQuery('Skills/BRAND-Guidelines')).toBe('skills_brand_guidelines');
    });
  });

  describe('stripSkillsPrefix()', () => {
    it('should remove skills_ prefix', () => {
      expect(stripSkillsPrefix('skills_brand_guidelines')).toBe('brand_guidelines');
    });

    it('should not affect names without prefix', () => {
      expect(stripSkillsPrefix('brand_guidelines')).toBe('brand_guidelines');
    });

    it('should only strip leading skills_ prefix', () => {
      expect(stripSkillsPrefix('skills_skills_nested')).toBe('skills_nested');
    });
  });
});
