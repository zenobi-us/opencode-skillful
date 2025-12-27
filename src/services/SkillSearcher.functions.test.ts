import { test, describe, expect } from 'bun:test';
import { parseQuery, rankSkill, shouldIncludeSkill, generateFeedback } from './SkillSearcher';
import { createMockSkill } from '../mocks';
import type { Skill } from '../types';

describe('parseQuery', () => {
  test('should parse empty string', () => {
    const result = parseQuery('');
    expect(result.include).toHaveLength(0);
    expect(result.exclude).toHaveLength(0);
    expect(result.originalQuery).toEqual([]);
    expect(result.hasExclusions).toBe(false);
    expect(result.termCount).toBe(0);
  });

  test('should parse single positive term', () => {
    const result = parseQuery('api');
    expect(result.include).toContain('api');
    expect(result.exclude).toHaveLength(0);
    expect(result.originalQuery).toEqual(['api']);
    expect(result.hasExclusions).toBe(false);
    expect(result.termCount).toBe(1);
  });

  test('should parse multiple positive terms', () => {
    const result = parseQuery('git commit workflow');
    expect(result.include).toEqual(['git', 'commit', 'workflow']);
    expect(result.exclude).toHaveLength(0);
    expect(result.hasExclusions).toBe(false);
    expect(result.termCount).toBe(3);
  });

  test('should parse negative terms with minus prefix', () => {
    const result = parseQuery('-python -deprecated');
    expect(result.exclude).toContain('python');
    expect(result.exclude).toContain('deprecated');
    expect(result.include).toHaveLength(0);
    expect(result.hasExclusions).toBe(true);
  });

  test('should parse mixed positive and negative terms', () => {
    const result = parseQuery('api -python -legacy');
    expect(result.include).toContain('api');
    expect(result.exclude).toContain('python');
    expect(result.exclude).toContain('legacy');
    expect(result.hasExclusions).toBe(true);
    expect(result.termCount).toBe(3);
  });

  test('should convert terms to lowercase', () => {
    const result = parseQuery('API TESTING -PYTHON');
    expect(result.include).toContain('api');
    expect(result.include).toContain('testing');
    expect(result.exclude).toContain('python');
  });

  test('should filter out empty terms', () => {
    const result = parseQuery('   api   testing   ');
    expect(result.include).toContain('api');
    expect(result.include).toContain('testing');
    expect(result.include).not.toContain('');
  });

  test('should handle quoted phrases', () => {
    const result = parseQuery('"git commit" message');
    expect(result.include.length).toBeGreaterThan(0);
    expect(result.originalQuery).toEqual(['"git commit" message']);
  });

  test('should preserve original query string', () => {
    const queryString = 'Git Workflow -Deprecated';
    const result = parseQuery(queryString);
    expect(result.originalQuery).toEqual([queryString]);
  });

  test('should track term count including negations', () => {
    const result = parseQuery('api gateway -python');
    expect(result.termCount).toBe(3);
  });

  test('should handle only negation terms', () => {
    const result = parseQuery('-old -deprecated');
    expect(result.exclude).toHaveLength(2);
    expect(result.include).toHaveLength(0);
    expect(result.hasExclusions).toBe(true);
  });

  test('should handle special characters in terms', () => {
    const result = parseQuery('node.js c++ @typescript');
    expect(result.include.length).toBeGreaterThan(0);
  });
});

describe('rankSkill', () => {
  test('should give exact name match maximum score', () => {
    const skill: Skill = createMockSkill({
      name: 'git',
      description: 'version control',
    });
    const result = rankSkill(skill, ['git']);

    expect(result.totalScore).toBe(13); // 1 name match * 3 + exact bonus 10
    expect(result.nameMatches).toBe(1);
    expect(result.descMatches).toBe(0);
  });

  test('should not give exact bonus for multi-term queries', () => {
    const skill: Skill = createMockSkill({
      name: 'git',
      description: 'version control',
    });
    const result = rankSkill(skill, ['git', 'control']);

    expect(result.totalScore).toBe(4); // 1 name match * 3 + 1 desc match * 1, no bonus
    expect(result.nameMatches).toBe(1);
    expect(result.descMatches).toBe(1);
  });

  test('should score name matches higher than description matches', () => {
    const skill: Skill = createMockSkill({
      name: 'git-commit',
      description: 'writing guides',
    });
    const result = rankSkill(skill, ['git']);

    expect(result.nameMatches).toBe(1);
    expect(result.descMatches).toBe(0);
    expect(result.totalScore).toBe(3); // 1 * 3 + 0 * 1
  });

  test('should count one match per term regardless of occurrences', () => {
    const skill: Skill = createMockSkill({
      name: 'git-git-git-workflow',
      description: 'patterns',
    });
    const result = rankSkill(skill, ['git']);

    // Each term in query counts once if found (anywhere in name)
    expect(result.nameMatches).toBe(1);
    expect(result.descMatches).toBe(0);
    expect(result.totalScore).toBe(3); // 1 * 3
  });

  test('should count description matches when term not in name', () => {
    const skill: Skill = createMockSkill({
      name: 'workflow',
      description: 'git patterns and git control',
    });
    const result = rankSkill(skill, ['git']);

    // 'git' not in name, so checks description
    expect(result.nameMatches).toBe(0);
    expect(result.descMatches).toBe(1); // Counted once per term
    expect(result.totalScore).toBe(1); // 1 * 1
  });

  test('should handle multiple search terms', () => {
    const skill: Skill = createMockSkill({
      name: 'git-commit-workflow',
      description: 'guide for version control',
    });
    const result = rankSkill(skill, ['git', 'commit', 'workflow']);

    expect(result.nameMatches).toBe(3);
    expect(result.descMatches).toBe(0);
    expect(result.totalScore).toBe(9); // 3 * 3
  });

  test('should handle no matching terms', () => {
    const skill: Skill = createMockSkill({
      name: 'testing',
      description: 'test patterns',
    });
    const result = rankSkill(skill, ['git', 'commit']);

    expect(result.nameMatches).toBe(0);
    expect(result.descMatches).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  test('should perform case-insensitive matching', () => {
    const skill: Skill = createMockSkill({
      name: 'Git-Commit',
      description: 'Git Workflow',
    });
    const result = rankSkill(skill, ['git']);

    expect(result.nameMatches).toBe(1);
    expect(result.descMatches).toBe(0);
  });

  test('should handle partial term matching', () => {
    const skill: Skill = createMockSkill({
      name: 'github-actions',
      description: 'version control automation',
    });
    const result = rankSkill(skill, ['git']);

    // 'git' is a substring of 'github' in name, so it matches there
    expect(result.nameMatches).toBe(1);
    expect(result.descMatches).toBe(0); // Not in description
    expect(result.totalScore).toBe(3); // 1 * 3
  });

  test('should return skill object in result', () => {
    const skill: Skill = createMockSkill({
      name: 'test',
      description: 'test desc',
    });
    const result = rankSkill(skill, ['test']);

    expect(result.skill).toBe(skill);
  });

  test('should handle empty include terms array', () => {
    const skill: Skill = createMockSkill({
      name: 'git',
      description: 'version control',
    });
    const result = rankSkill(skill, []);

    expect(result.nameMatches).toBe(0);
    expect(result.descMatches).toBe(0);
    expect(result.totalScore).toBe(0);
  });

  test('should count only first match per term', () => {
    const skill: Skill = createMockSkill({
      name: 'git workflow',
      description: 'git is used in workflow',
    });
    const result = rankSkill(skill, ['git']);

    // 'git' appears in both name and description, but only counts as name match
    expect(result.nameMatches).toBe(1);
    expect(result.descMatches).toBe(0);
  });
});

describe('shouldIncludeSkill', () => {
  test('should include skill when no exclusions', () => {
    const skill: Skill = createMockSkill({
      name: 'python-guide',
      description: 'Python basics',
    });
    const result = shouldIncludeSkill(skill, []);

    expect(result).toBe(true);
  });

  test('should exclude skill matching single exclusion term in name', () => {
    const skill: Skill = createMockSkill({
      name: 'python-guide',
      description: 'guide',
    });
    const result = shouldIncludeSkill(skill, ['python']);

    expect(result).toBe(false);
  });

  test('should exclude skill matching exclusion term in description', () => {
    const skill: Skill = createMockSkill({
      name: 'guide',
      description: 'Python programming',
    });
    const result = shouldIncludeSkill(skill, ['python']);

    expect(result).toBe(false);
  });

  test('should exclude skill matching any exclusion term', () => {
    const skill: Skill = createMockSkill({
      name: 'python-javascript-guide',
      description: 'Multi-language guide',
    });
    const result = shouldIncludeSkill(skill, ['python', 'javascript']);

    expect(result).toBe(false);
  });

  test('should perform case-insensitive matching', () => {
    const skill: Skill = createMockSkill({
      name: 'Python-Guide',
      description: 'Guide content',
    });
    const result = shouldIncludeSkill(skill, ['python']);

    expect(result).toBe(false);
  });

  test('should match partial terms (substrings)', () => {
    const skill: Skill = createMockSkill({
      name: 'deprecated-guide',
      description: 'Old patterns',
    });
    const result = shouldIncludeSkill(skill, ['deprecated']);

    expect(result).toBe(false);
  });

  test('should include skill not matching any exclusion', () => {
    const skill: Skill = createMockSkill({
      name: 'rust-guide',
      description: 'Rust programming',
    });
    const result = shouldIncludeSkill(skill, ['python', 'javascript']);

    expect(result).toBe(true);
  });

  test('should handle multiple exclusion terms correctly', () => {
    const skill: Skill = createMockSkill({
      name: 'general-guide',
      description: 'General programming patterns',
    });
    const result = shouldIncludeSkill(skill, ['python', 'javascript', 'legacy']);

    expect(result).toBe(true);
  });

  test('should check both name and description together', () => {
    const skill: Skill = createMockSkill({
      name: 'api-guide',
      description: 'deprecated patterns',
    });
    const result = shouldIncludeSkill(skill, ['deprecated']);

    expect(result).toBe(false);
  });

  test('should handle empty skill name and description', () => {
    const skill: Skill = createMockSkill({
      name: '',
      description: '',
    });
    const result = shouldIncludeSkill(skill, ['test']);

    expect(result).toBe(true);
  });

  test('should handle special characters in exclusion terms', () => {
    const skill: Skill = createMockSkill({
      name: 'c++-guide',
      description: 'C++ programming',
    });
    const result = shouldIncludeSkill(skill, ['c++']);

    expect(result).toBe(false);
  });
});

describe('generateFeedback', () => {
  test('should show included terms in feedback', () => {
    const query = parseQuery('api testing');
    const feedback = generateFeedback(query, 2);

    expect(feedback).toContain('api');
    expect(feedback).toContain('testing');
    expect(feedback).toContain('Searching for');
  });

  test('should show excluded terms in feedback', () => {
    const query = parseQuery('guide -python');
    const feedback = generateFeedback(query, 1);

    expect(feedback).toContain('python');
    expect(feedback).toContain('Excluding');
  });

  test('should show match count for zero results', () => {
    const query = parseQuery('nonexistent');
    const feedback = generateFeedback(query, 0);

    expect(feedback).toContain('No matches found');
  });

  test('should show singular "match" for one result', () => {
    const query = parseQuery('git');
    const feedback = generateFeedback(query, 1);

    expect(feedback).toContain('Found 1 match');
  });

  test('should show plural "matches" for multiple results', () => {
    const query = parseQuery('api');
    const feedback = generateFeedback(query, 5);

    expect(feedback).toContain('Found 5 matches');
  });

  test('should use pipe separator between sections', () => {
    const query = parseQuery('api -python');
    const feedback = generateFeedback(query, 2);

    expect(feedback.split('|').length).toBeGreaterThan(1);
  });

  test('should handle query with only inclusions', () => {
    const query = parseQuery('git commit');
    const feedback = generateFeedback(query, 3);

    expect(feedback).toContain('git');
    expect(feedback).toContain('commit');
    expect(feedback).not.toContain('Excluding');
    expect(feedback).toContain('Found 3');
  });

  test('should handle query with only exclusions', () => {
    const query = parseQuery('-python');
    const feedback = generateFeedback(query, 2);

    expect(feedback).toContain('Excluding');
    expect(feedback).toContain('Found 2');
  });

  test('should indicate success for matches', () => {
    const query = parseQuery('test');
    const feedback = generateFeedback(query, 1);

    expect(feedback).toContain('Found 1 match');
  });

  test('should indicate error for no matches', () => {
    const query = parseQuery('test');
    const feedback = generateFeedback(query, 0);

    expect(feedback).toContain('No matches found');
  });

  test('should format multiple included terms as comma-separated list', () => {
    const query = parseQuery('git commit workflow');
    const feedback = generateFeedback(query, 2);

    expect(feedback).toContain('git');
    expect(feedback).toContain('commit');
    expect(feedback).toContain('workflow');
  });

  test('should format multiple excluded terms as comma-separated list', () => {
    const query = parseQuery('guide -old -deprecated');
    const feedback = generateFeedback(query, 1);

    expect(feedback).toContain('old');
    expect(feedback).toContain('deprecated');
  });

  test('should handle empty query gracefully', () => {
    const query = parseQuery('');
    const feedback = generateFeedback(query, 5);

    expect(typeof feedback).toBe('string');
    expect(feedback.length).toBeGreaterThan(0);
  });

  test('should always include match count in feedback', () => {
    const testCases = [
      { query: parseQuery('test'), matchCount: 0 },
      { query: parseQuery('test'), matchCount: 1 },
      { query: parseQuery('test'), matchCount: 10 },
    ];

    testCases.forEach(({ query, matchCount }) => {
      const feedback = generateFeedback(query, matchCount);
      if (matchCount === 0) {
        expect(feedback).toContain('No matches');
      } else {
        expect(feedback).toContain(matchCount.toString());
      }
    });
  });
});

describe('SkillSearcher - Edge Cases', () => {
  describe('Exact phrase matching (quoted)', () => {
    test('should handle quoted phrases in parseQuery', () => {
      const result = parseQuery('"git commit" workflow');
      expect(result.include.length).toBeGreaterThan(0);
      expect(result.originalQuery).toEqual(['"git commit" workflow']);
    });

    test('should parse single quoted term', () => {
      const result = parseQuery('"nodejs"');
      expect(result.include.length).toBeGreaterThan(0);
    });

    test('should handle quoted negation', () => {
      const result = parseQuery('-"deprecated feature"');
      expect(result.exclude.length).toBeGreaterThan(0);
    });

    test('should handle multiple quoted phrases', () => {
      const result = parseQuery('"git workflow" "best practices"');
      expect(result.include.length).toBeGreaterThan(0);
    });

    test('should handle mismatched quotes', () => {
      const result = parseQuery('"git workflow');
      // Should parse gracefully even with unmatched quotes
      expect(result).toHaveProperty('include');
      expect(result).toHaveProperty('exclude');
    });
  });

  describe('Query normalization - Unicode and emoji', () => {
    test('should handle Unicode characters in query', () => {
      const result = parseQuery('café typescript');
      expect(result.include.length).toBeGreaterThan(0);
      expect(result.include.some((t) => t.includes('caf'))).toBe(true);
    });

    test('should handle emoji in query', () => {
      const result = parseQuery('🚀 rocket launch');
      expect(result.include.length).toBeGreaterThan(0);
    });

    test('should handle mixed Unicode and ASCII', () => {
      const result = parseQuery('Überschrift title élève');
      expect(result.include.length).toBeGreaterThan(0);
    });

    test('should normalize accented characters', () => {
      const result = parseQuery('naïve résumé');
      expect(result.include.length).toBeGreaterThan(0);
    });

    test('should handle RTL characters', () => {
      const result = parseQuery('مرحبا hello');
      expect(result.include.length).toBeGreaterThan(0);
    });

    test('should handle zero-width characters gracefully', () => {
      const result = parseQuery('test\u200Bskill');
      expect(result).toHaveProperty('include');
    });

    test('should handle combining diacriticals', () => {
      const result = parseQuery('e\u0301 data'); // é as e + combining acute
      expect(result.include.length).toBeGreaterThan(0);
    });
  });

  describe('Ranking tie-breaking', () => {
    test('should sort by name alphabetically when scores equal', () => {
      const skills: Skill[] = [
        createMockSkill({ name: 'zebra-api', description: 'api reference' }),
        createMockSkill({ name: 'api-guide', description: 'api reference' }),
        createMockSkill({ name: 'api-design', description: 'api reference' }),
      ];

      const results = skills
        .map((skill) => rankSkill(skill, ['api']))
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          if (b.nameMatches !== a.nameMatches) {
            return b.nameMatches - a.nameMatches;
          }
          return a.skill.name.localeCompare(b.skill.name);
        });

      // All have same score and name matches, should sort alphabetically
      expect(results[0].skill.name).toBe('api-design');
      expect(results[1].skill.name).toBe('api-guide');
      expect(results[2].skill.name).toBe('zebra-api');
    });

    test('should prioritize higher scores over alphabetical order', () => {
      const skills: Skill[] = [
        createMockSkill({ name: 'aaa-skill', description: 'no match' }),
        createMockSkill({ name: 'zzzapi', description: 'no match' }),
      ];

      const results = skills
        .map((skill) => rankSkill(skill, ['api']))
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          return a.skill.name.localeCompare(b.skill.name);
        });

      // zzzapi has higher score (api in name = 3 vs 0), should come first despite alphabetical order
      expect(results[0].skill.name).toBe('zzzapi');
      expect(results[0].totalScore).toBe(3); // name match
      expect(results[1].totalScore).toBe(0); // no match
    });

    test('should handle exact match bonus in tie-breaking', () => {
      const skills: Skill[] = [
        createMockSkill({ name: 'git', description: 'version control' }),
        createMockSkill({ name: 'github', description: 'git hosting' }),
      ];

      const results = skills
        .map((skill) => rankSkill(skill, ['git']))
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          return a.skill.name.localeCompare(b.skill.name);
        });

      // 'git' exact match should have higher score
      expect(results[0].skill.name).toBe('git');
      expect(results[0].totalScore).toBeGreaterThan(results[1].totalScore);
    });
  });

  describe('Path prefix edge cases', () => {
    test('should handle case sensitivity in tool names', () => {
      const result = parseQuery('Git');
      expect(result.include).toContain('git');
      // Normalized to lowercase
      expect(result.include).not.toContain('Git');
    });

    test('should handle mixed case query terms', () => {
      const result = parseQuery('GitHUB TypeScript');
      expect(result.include).toContain('github');
      expect(result.include).toContain('typescript');
    });

    test('should handle path separators in search', () => {
      const result = parseQuery('skills/git');
      expect(result.include.length).toBeGreaterThan(0);
    });

    test('should handle dots in tool names', () => {
      const result = parseQuery('node.js');
      expect(result.include).toContain('node.js');
    });

    test('should handle hyphens in tool names', () => {
      const result = parseQuery('git-flow workflow');
      expect(result.include).toContain('git-flow');
      expect(result.include).toContain('workflow');
    });

    test('should handle underscores in tool names', () => {
      const result = parseQuery('test_framework');
      expect(result.include).toContain('test_framework');
    });

    test('should handle special characters in paths', () => {
      const result = parseQuery('c++ rust');
      expect(result.include).toContain('c++');
      expect(result.include).toContain('rust');
    });
  });

  describe('Query edge cases - empty and whitespace', () => {
    test('should handle tabs and newlines', () => {
      const result = parseQuery('git\t\nworkflow');
      expect(result.include.length).toBeGreaterThan(0);
    });

    test('should handle multiple spaces between terms', () => {
      const result = parseQuery('git    workflow    design');
      expect(result.include.length).toBe(3);
    });

    test('should handle leading and trailing whitespace', () => {
      const result = parseQuery('   git workflow   ');
      expect(result.include).toContain('git');
      expect(result.include).toContain('workflow');
    });

    test('should handle only whitespace', () => {
      const result = parseQuery('   \t\n  ');
      // search-string parses whitespace as a segment, but filtering removes it
      expect(result.include).toHaveLength(0);
      expect(result.exclude).toHaveLength(0);
      // termCount counts the raw segment before filtering
      expect(result.termCount).toBe(1);
    });

    test('should handle very long queries', () => {
      const longQuery = Array(100).fill('term').join(' ');
      const result = parseQuery(longQuery);
      expect(result.include.length).toBeGreaterThan(0);
      expect(result.termCount).toBe(100);
    });
  });

  describe('Ranking with special cases', () => {
    test('should handle skills with empty descriptions', () => {
      const skill = createMockSkill({ name: 'test', description: '' });
      const result = rankSkill(skill, ['test']);

      expect(result.nameMatches).toBe(1);
      expect(result.totalScore).toBe(13); // 1 * 3 + exact bonus 10
    });

    test('should handle very long skill names', () => {
      const longName = 'a'.repeat(500);
      const skill = createMockSkill({ name: longName, description: 'description' });
      const result = rankSkill(skill, ['a']);

      expect(result.nameMatches).toBe(1);
    });

    test('should handle numeric terms in queries', () => {
      const skill = createMockSkill({ name: 'python3-guide', description: 'Python 3 tutorial' });
      const result = rankSkill(skill, ['3']);

      expect(result.totalScore).toBeGreaterThan(0);
    });

    test('should handle scores with many matches', () => {
      const skill = createMockSkill({
        name: 'api-api-api',
        description: 'api api api api',
      });
      const result = rankSkill(skill, ['api']);

      // One match per term (3 in name)
      expect(result.nameMatches).toBe(1);
      expect(result.totalScore).toBe(3);
    });
  });
});
