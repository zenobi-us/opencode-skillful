import { describe, expect, it } from 'vitest';
import { stripTrailingPathSeparators, suggestSkillsDirectoryPath } from './SkillRegistry';

describe('stripTrailingPathSeparators', () => {
  it('removes trailing forward slashes', () => {
    expect(stripTrailingPathSeparators('/tmp/skill///')).toBe('/tmp/skill');
  });

  it('removes trailing backslashes', () => {
    expect(stripTrailingPathSeparators('C:\\tmp\\skill\\\\')).toBe('C:\\tmp\\skill');
  });

  it('keeps paths without trailing separators unchanged', () => {
    expect(stripTrailingPathSeparators('/tmp/skill')).toBe('/tmp/skill');
  });
});

describe('suggestSkillsDirectoryPath', () => {
  it('handles uppercase SKILL suffix case-insensitively', () => {
    const result = suggestSkillsDirectoryPath('/tmp/SKILL');
    expect(result).toBe('/tmp/skills');
  });

  it('returns "skills" when path is only "skill"', () => {
    expect(suggestSkillsDirectoryPath('skill')).toBe('skills');
  });

  it('returns "skills" when path is only "SKILL"', () => {
    expect(suggestSkillsDirectoryPath('SKILL')).toBe('skills');
  });

  it('supports trailing separators before checking suffix', () => {
    expect(suggestSkillsDirectoryPath('/tmp/skill/')).toBe('/tmp/skills');
    expect(suggestSkillsDirectoryPath('C:\\tmp\\skill\\')).toBe('C:\\tmp\\skills');
  });

  it('returns null when path does not end with skill', () => {
    expect(suggestSkillsDirectoryPath('/tmp/skills')).toBeNull();
    expect(suggestSkillsDirectoryPath('/tmp/project')).toBeNull();
  });

  it('returns null for empty path', () => {
    expect(suggestSkillsDirectoryPath('')).toBeNull();
  });
});
