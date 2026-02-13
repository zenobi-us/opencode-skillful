import { describe, expect, it } from 'vitest';
import { suggestSkillsDirectoryPath } from './SkillRegistry';

describe('suggestSkillsDirectoryPath', () => {
  it('handles uppercase SKILL suffix case-insensitively', () => {
    const result = suggestSkillsDirectoryPath('/tmp/SKILL');
    expect(result).toBe('/tmp/skills');
  });
});
