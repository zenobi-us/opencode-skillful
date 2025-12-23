import { describe, it, expect } from 'vitest';
import { SkillSearcher } from './SkillSearcher';
import type { Skill } from '../types';

describe('SkillSearcher', () => {
  const createMockSkill = (overrides: Partial<Skill> = {}): Skill => ({
    name: 'test-skill',
    description: 'A test skill',
    fullPath: '/path/to/skill',
    toolName: 'test_skill',
    path: '/path/to/skill/SKILL.md',
    content: 'Test content',
    license: 'MIT',
    allowedTools: [],
    metadata: {},
    scripts: [],
    references: [],
    assets: [],
    ...overrides,
  });

  describe('Query parsing', () => {
    it('should parse simple query with single term', () => {
      const searcher = new SkillSearcher([createMockSkill({ name: 'writing' })]);
      const result = searcher.search('writing');

      expect(result.query.include).toContain('writing');
      expect(result.query.exclude).toHaveLength(0);
    });

    it('should parse query with multiple inclusion terms', () => {
      const searcher = new SkillSearcher([
        createMockSkill({ name: 'writing-git-commits', description: 'Learn to write git commits' }),
      ]);
      const result = searcher.search('writing git commit');

      expect(result.query.include).toContain('writing');
      expect(result.query.include).toContain('git');
      expect(result.query.include).toContain('commit');
      expect(result.query.exclude).toHaveLength(0);
    });

    it('should parse query with exclusion terms (minus prefix)', () => {
      const searcher = new SkillSearcher([
        createMockSkill({ name: 'writing', description: 'General writing' }),
        createMockSkill({ name: 'document-writing', description: 'Document writing' }),
      ]);
      const result = searcher.search('writing -document');

      expect(result.query.include).toContain('writing');
      expect(result.query.exclude).toContain('document');
    });

    it('should parse query with multiple exclusion terms', () => {
      const searcher = new SkillSearcher([]);
      const result = searcher.search('tool -python -javascript');

      expect(result.query.include).toContain('tool');
      expect(result.query.exclude).toContain('python');
      expect(result.query.exclude).toContain('javascript');
    });

    it('should parse mixed inclusion and exclusion terms', () => {
      const searcher = new SkillSearcher([]);
      const result = searcher.search('api -deprecated -legacy');

      expect(result.query.include).toContain('api');
      expect(result.query.exclude).toContain('deprecated');
      expect(result.query.exclude).toContain('legacy');
    });

    it('should handle quoted phrases with spaces', () => {
      const searcher = new SkillSearcher([
        createMockSkill({ name: 'git-commit-guide', description: 'git commit message guide' }),
      ]);
      const result = searcher.search('"git commit" -draft');

      expect(result.query.exclude).toContain('draft');
    });

    it('should handle empty string query', () => {
      const skills = [createMockSkill({ name: 'skill1' })];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('');

      expect(result.query.include).toHaveLength(0);
      expect(result.matches).toHaveLength(0);
    });

    it('should handle only whitespace', () => {
      const searcher = new SkillSearcher([]);
      const result = searcher.search('   ');

      expect(result.query.include).toHaveLength(0);
      expect(result.matches).toHaveLength(0);
    });

    it('should normalize query to lowercase', () => {
      const searcher = new SkillSearcher([
        createMockSkill({ name: 'writing', description: 'Writing skills' }),
      ]);
      const result = searcher.search('WRITING GIT');

      expect(result.query.include).toContain('writing');
      expect(result.query.include).toContain('git');
    });

    it('should handle special characters in query', () => {
      const searcher = new SkillSearcher([
        createMockSkill({ name: 'node.js-setup', description: 'Node.js configuration' }),
      ]);
      const result = searcher.search('node.js');

      expect(result.query.include.length).toBeGreaterThan(0);
    });

    it('should handle only exclusion terms', () => {
      const searcher = new SkillSearcher([]);
      const result = searcher.search('-python -javascript');

      expect(result.query.include).toHaveLength(0);
      expect(result.query.exclude).toHaveLength(2);
    });

    it('should track term count and exclusion flag', () => {
      const searcher = new SkillSearcher([]);
      const result = searcher.search('api -deprecated');

      expect(result.query.termCount).toBeGreaterThan(0);
      expect(result.query.hasExclusions).toBe(true);
    });

    it('should track original query string', () => {
      const queryString = 'writing git -deprecated';
      const searcher = new SkillSearcher([]);
      const result = searcher.search(queryString);

      expect(result.query.originalQuery).toBe(queryString);
    });
  });

  describe('Ranking algorithm', () => {
    it('should rank exact name match highest', () => {
      const skills = [
        createMockSkill({ name: 'git-commit', description: 'Write commits' }),
        createMockSkill({ name: 'documentation', description: 'git commit guide' }),
        createMockSkill({ name: 'api', description: 'git commit api' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git-commit');

      expect(result.matches[0].name).toBe('git-commit');
    });

    it('should rank name matches higher than description matches', () => {
      const skills = [
        createMockSkill({ name: 'blog-post', description: 'writing blog content' }),
        createMockSkill({ name: 'documentation-guide', description: 'Write good documentation' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('writing');

      // Only 'blog-post' matches because 'writing' is in its description
      // 'documentation-guide' doesn't contain 'writing' anywhere
      expect(result.matches[0].name).toBe('blog-post');
      expect(result.matches).toHaveLength(1);
    });

    it('should filter out skills with exclusion terms', () => {
      const skills = [
        createMockSkill({ name: 'python-guide', description: 'Python programming' }),
        createMockSkill({ name: 'javascript-guide', description: 'JavaScript programming' }),
        createMockSkill({ name: 'general-guide', description: 'General programming' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('guide -python');

      expect(result.matches).not.toContainEqual(expect.objectContaining({ name: 'python-guide' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'javascript-guide' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'general-guide' }));
    });

    it('should match on partial terms (substring matching)', () => {
      const skills = [
        createMockSkill({ name: 'git-workflow', description: 'Git workflow patterns' }),
        createMockSkill({ name: 'github-actions', description: 'GitHub Actions setup' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git');

      expect(result.matches.length).toBe(2);
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'git-workflow' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'github-actions' }));
    });

    it('should require ALL inclusion terms (AND logic)', () => {
      const skills = [
        createMockSkill({ name: 'git-commit', description: 'Writing commits' }),
        createMockSkill({ name: 'git-workflow', description: 'Workflow patterns' }),
        createMockSkill({ name: 'documentation', description: 'Writing guides' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git writing');

      // Only git-commit matches both terms
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'git-commit' }));
      // git-workflow has git but not writing
      expect(result.matches).not.toContainEqual(expect.objectContaining({ name: 'git-workflow' }));
      // documentation has writing but not git
      expect(result.matches).not.toContainEqual(expect.objectContaining({ name: 'documentation' }));
    });

    it('should exclude skills matching ANY exclusion term', () => {
      const skills = [
        createMockSkill({ name: 'python-basics', description: 'Python fundamentals' }),
        createMockSkill({ name: 'javascript-basics', description: 'JavaScript fundamentals' }),
        createMockSkill({ name: 'general-basics', description: 'General fundamentals' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('basics -python -javascript');

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].name).toBe('general-basics');
    });

    it('should return empty array when no skills match inclusion terms', () => {
      const skills = [
        createMockSkill({ name: 'python-guide', description: 'Python programming' }),
        createMockSkill({ name: 'javascript-guide', description: 'JavaScript programming' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('rust');

      expect(result.matches).toHaveLength(0);
    });

    it('should handle case-insensitive matching', () => {
      const skills = [
        createMockSkill({ name: 'Git-Commit', description: 'Writing Commits' }),
        createMockSkill({ name: 'DOCUMENTATION', description: 'Documentation Guide' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should prioritize skills matching more inclusion terms', () => {
      const skills = [
        createMockSkill({
          name: 'git-commit-workflow',
          description: 'Complete workflow guide',
        }),
        createMockSkill({ name: 'git-basics', description: 'Basic git commands' }),
        createMockSkill({ name: 'workflow-patterns', description: 'General patterns' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git workflow');

      // git-commit-workflow matches both terms in name
      expect(result.matches[0].name).toBe('git-commit-workflow');
    });

    it('should handle empty skills array', () => {
      const searcher = new SkillSearcher([]);
      const result = searcher.search('test');

      expect(result.matches).toHaveLength(0);
    });

    it('should handle empty query with multiple skills', () => {
      const skills = [
        createMockSkill({ name: 'skill1', description: 'Description 1' }),
        createMockSkill({ name: 'skill2', description: 'Description 2' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('');

      expect(result.matches).toHaveLength(0);
    });

    it('should break ties with name matches count', () => {
      const skills = [
        createMockSkill({
          name: 'git-workflow-git',
          description: 'Workflow patterns',
        }),
        createMockSkill({ name: 'workflow', description: 'git workflow patterns' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git workflow');

      // git-workflow-git has more name matches (2 vs 1)
      expect(result.matches[0].name).toBe('git-workflow-git');
    });

    it('should break final ties alphabetically by skill name', () => {
      const skills = [
        createMockSkill({ name: 'zebra', description: 'Test skill' }),
        createMockSkill({ name: 'apple', description: 'Test skill' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('test');

      expect(result.matches[0].name).toBe('apple');
      expect(result.matches[1].name).toBe('zebra');
    });

    it('should track totalMatches before exclusion filtering', () => {
      const skills = [
        createMockSkill({ name: 'python-guide', description: 'Python programming' }),
        createMockSkill({ name: 'javascript-guide', description: 'JavaScript programming' }),
        createMockSkill({ name: 'general-guide', description: 'General programming' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('guide -python');

      // totalMatches should be 3 (before exclusion)
      expect(result.totalMatches).toBe(3);
      // matches should be 2 (after exclusion)
      expect(result.matches).toHaveLength(2);
    });
  });

  describe('Feedback message generation', () => {
    it('should generate feedback for successful search', () => {
      const skills = [
        createMockSkill({ name: 'git-commit', description: 'Writing commits' }),
        createMockSkill({ name: 'git-workflow', description: 'Workflow patterns' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git');

      expect(result.feedback).toContain('2');
      expect(result.feedback).toContain('✅');
      expect(result.feedback).toContain('Found');
    });

    it('should generate feedback for no results', () => {
      const searcher = new SkillSearcher([]);
      const result = searcher.search('nonexistent');

      expect(result.feedback).toContain('❌');
      expect(result.feedback).toContain('No matches found');
    });

    it('should mention included terms in feedback', () => {
      const skills = [createMockSkill({ name: 'git-commit', description: 'Writing commits' })];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git commit');

      expect(result.feedback).toContain('git');
      expect(result.feedback).toContain('commit');
      expect(result.feedback).toContain('Searching for');
    });

    it('should mention excluded terms in feedback', () => {
      const skills = [createMockSkill({ name: 'general-guide', description: 'General guide' })];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('guide -python -javascript');

      expect(result.feedback).toContain('python');
      expect(result.feedback).toContain('javascript');
      expect(result.feedback).toContain('Excluding');
    });

    it('should include correct result count in feedback', () => {
      const skills = [
        createMockSkill({ name: 'rest-api', description: 'REST API design' }),
        createMockSkill({ name: 'graphql-api', description: 'GraphQL API design' }),
        createMockSkill({ name: 'api-testing', description: 'API testing strategies' }),
      ];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('api');

      expect(result.feedback).toContain('3');
      expect(result.feedback).toContain('Found');
    });

    it('should differentiate singular vs plural results', () => {
      const singleSkill = [createMockSkill({ name: 'testing', description: 'Test writing' })];
      const multipleSkills = [
        createMockSkill({ name: 'testing', description: 'Test writing' }),
        createMockSkill({ name: 'test-patterns', description: 'Patterns' }),
      ];

      const singleSearcher = new SkillSearcher(singleSkill);
      const multipleSearcher = new SkillSearcher(multipleSkills);

      const singleResult = singleSearcher.search('test');
      const multipleResult = multipleSearcher.search('test');

      expect(singleResult.feedback).toContain('1 match');
      expect(multipleResult.feedback).toContain('2 matches');
    });

    it('should handle empty query in feedback', () => {
      const searcher = new SkillSearcher([createMockSkill({ name: 'skill1' })]);
      const result = searcher.search('');

      expect(result.feedback).toBeDefined();
      expect(typeof result.feedback).toBe('string');
      expect(result.feedback).toContain('❌');
    });

    it('should format feedback with proper emoji indicators', () => {
      const skills = [createMockSkill({ name: 'test', description: 'test' })];
      const searcher = new SkillSearcher(skills);

      const successResult = searcher.search('test');
      expect(successResult.feedback).toContain('✅');

      const emptySearcher = new SkillSearcher([]);
      const emptyResult = emptySearcher.search('test');
      expect(emptyResult.feedback).toContain('❌');
    });

    it('should use pipe separator in feedback', () => {
      const skills = [createMockSkill({ name: 'git', description: 'git' })];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('git -python');

      expect(result.feedback).toContain('|');
    });
  });

  describe('Integration tests', () => {
    it('should handle complete search workflow: parse -> rank -> feedback', () => {
      const queryString = 'writing git -deprecated';
      const skills = [
        createMockSkill({
          name: 'writing-git-commits',
          description: 'Writing effective git commits',
        }),
        createMockSkill({ name: 'git-basics', description: 'Git fundamentals' }),
        createMockSkill({
          name: 'deprecated-git',
          description: 'Old git techniques (deprecated)',
        }),
        createMockSkill({ name: 'writing-docs', description: 'Documentation writing' }),
      ];

      const searcher = new SkillSearcher(skills);
      const result = searcher.search(queryString);

      expect(result.query.include).toContain('writing');
      expect(result.query.include).toContain('git');
      expect(result.query.exclude).toContain('deprecated');

      expect(result.matches).not.toContainEqual(
        expect.objectContaining({ name: 'deprecated-git' })
      );
      expect(result.matches[0].name).toBe('writing-git-commits');

      expect(result.feedback).toContain(result.matches.length.toString());
    });

    it('should maintain skill object structure through search pipeline', () => {
      const skill = createMockSkill({ name: 'test-skill', description: 'A test skill' });
      const searcher = new SkillSearcher([skill]);
      const result = searcher.search('test');

      expect(result.matches[0]).toEqual(skill);
    });

    it('should handle search with special characters in skill names', () => {
      const skills = [
        createMockSkill({ name: 'node.js-setup', description: 'Node.js configuration' }),
        createMockSkill({ name: 'c++-basics', description: 'C++ fundamentals' }),
        createMockSkill({
          name: '@typescript-patterns',
          description: 'TypeScript patterns',
        }),
      ];

      const searcher = new SkillSearcher(skills);
      const result = searcher.search('node');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should handle search with unicode characters', () => {
      const skills = [
        createMockSkill({
          name: 'writing-español',
          description: 'Spanish writing guide',
        }),
        createMockSkill({
          name: 'api-日本語',
          description: 'Japanese API guide',
        }),
      ];

      const searcher = new SkillSearcher(skills);
      const result = searcher.search('writing');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should handle complex multi-term queries with exclusions', () => {
      const skills = [
        createMockSkill({
          name: 'python-async-networking',
          description: 'Async networking in Python',
        }),
        createMockSkill({
          name: 'javascript-async-networking',
          description: 'Async networking in JavaScript',
        }),
        createMockSkill({
          name: 'async-patterns-guide',
          description: 'General async patterns and networking',
        }),
      ];

      const searcher = new SkillSearcher(skills);
      const result = searcher.search('async networking -python');

      // 'python-async-networking' excluded due to -python
      expect(result.matches).not.toContainEqual(
        expect.objectContaining({ name: 'python-async-networking' })
      );
      // 'javascript-async-networking' matches: has both 'async' and 'networking'
      expect(result.matches).toContainEqual(
        expect.objectContaining({ name: 'javascript-async-networking' })
      );
      // 'async-patterns-guide' matches: has both 'async' and 'networking' in description
      expect(result.matches).toContainEqual(
        expect.objectContaining({ name: 'async-patterns-guide' })
      );
      expect(result.matches).toHaveLength(2);
    });

    it('should return correct metadata with search results', () => {
      const skills = [createMockSkill({ name: 'test', description: 'test' })];
      const searcher = new SkillSearcher(skills);
      const result = searcher.search('test');

      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('totalMatches');
      expect(result).toHaveProperty('feedback');
      expect(result).toHaveProperty('query');
    });

    it('should handle large result sets efficiently', () => {
      const skills = Array.from({ length: 100 }, (_, i) =>
        createMockSkill({
          name: `skill-${i}`,
          description: 'General purpose skill',
        })
      );

      const searcher = new SkillSearcher(skills);
      const result = searcher.search('skill');

      expect(result.matches).toHaveLength(100);
      expect(result.totalMatches).toBe(100);
    });
  });
});
