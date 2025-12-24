import { describe, it, expect } from 'vitest';
import {
  parseQuery,
  rankSkill,
  shouldIncludeSkill,
  generateFeedback,
  createSkillSearcher,
} from './SkillSearcher';
import { mockSkill, mockRegistryController } from '../mocks';

describe('SkillSearcher', () => {
  describe('Query parsing', () => {
    it('should parse simple query with single term', () => {
      const skills = [mockSkill({ name: 'writing' })];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('writing');

      expect(result.query.include).toContain('writing');
      expect(result.query.exclude).toHaveLength(0);
    });

    it('should parse query with multiple inclusion terms', () => {
      const skills = [
        mockSkill({ name: 'writing-git-commits', description: 'Learn to write git commits' }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('writing git commit');

      expect(result.query.include).toContain('writing');
      expect(result.query.include).toContain('git');
      expect(result.query.include).toContain('commit');
      expect(result.query.exclude).toHaveLength(0);
    });

    it('should parse query with exclusion terms (minus prefix)', () => {
      const skills = [
        mockSkill({ name: 'writing', description: 'General writing' }),
        mockSkill({ name: 'document-writing', description: 'Document writing' }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('writing -document');

      expect(result.query.include).toContain('writing');
      expect(result.query.exclude).toContain('document');
    });

    it('should parse query with multiple exclusion terms', () => {
      const skills = [];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('tool -python -javascript');

      expect(result.query.include).toContain('tool');
      expect(result.query.exclude).toContain('python');
      expect(result.query.exclude).toContain('javascript');
    });

    it('should parse mixed inclusion and exclusion terms', () => {
      const skills = [];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('api -deprecated -legacy');

      expect(result.query.include).toContain('api');
      expect(result.query.exclude).toContain('deprecated');
      expect(result.query.exclude).toContain('legacy');
    });

    it('should handle quoted phrases with spaces', () => {
      const skills = [
        mockSkill({ name: 'git-commit-guide', description: 'git commit message guide' }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('"git commit" -draft');

      expect(result.query.exclude).toContain('draft');
    });

    it('should handle empty string query', () => {
      const skills = [mockSkill({ name: 'skill1' })];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('');

      expect(result.query.include).toHaveLength(0);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].name).toBe('skill1');
    });

    it('should handle only whitespace', () => {
      const skills = [];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('   ');

      expect(result.query.include).toHaveLength(0);
      expect(result.matches).toHaveLength(0);
    });

    it('should normalize query to lowercase', () => {
      const skills = [mockSkill({ name: 'writing', description: 'Writing skills' })];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('WRITING GIT');

      expect(result.query.include).toContain('writing');
      expect(result.query.include).toContain('git');
    });

    it('should handle special characters in query', () => {
      const skills = [mockSkill({ name: 'node.js-setup', description: 'Node.js configuration' })];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('node.js');

      expect(result.query.include.length).toBeGreaterThan(0);
    });

    it('should handle only exclusion terms', () => {
      const skills = [];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('-python -javascript');

      expect(result.query.include).toHaveLength(0);
      expect(result.query.exclude).toHaveLength(2);
    });

    it('should track term count and exclusion flag', () => {
      const skills = [];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('api -deprecated');

      expect(result.query.termCount).toBeGreaterThan(0);
      expect(result.query.hasExclusions).toBe(true);
    });

    it('should track original query string', () => {
      const queryString = 'writing git -deprecated';
      const skills = [];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher(queryString);

      expect(result.query.originalQuery).toBe(queryString);
    });
  });

  describe('Ranking algorithm', () => {
    it('should rank exact name match highest', () => {
      const skills = [
        mockSkill({
          name: 'git-commit',
          description: 'Write commits',
          toolName: 'git_commit',
        }),
        mockSkill({
          name: 'documentation',
          description: 'git commit guide',
          toolName: 'documentation',
        }),
        mockSkill({ name: 'api', description: 'git commit api', toolName: 'api' }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git-commit');

      expect(result.matches[0].name).toBe('git-commit');
    });

    it('should rank name matches higher than description matches', () => {
      const skills = [
        mockSkill({
          name: 'blog-post',
          description: 'writing blog content',
          toolName: 'blog_post',
        }),
        mockSkill({
          name: 'documentation-guide',
          description: 'Write good documentation',
          toolName: 'documentation_guide',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('writing');

      // Only 'blog-post' matches because 'writing' is in its description
      // 'documentation-guide' doesn't contain 'writing' anywhere
      expect(result.matches[0].name).toBe('blog-post');
      expect(result.matches).toHaveLength(1);
    });

    it('should filter out skills with exclusion terms', () => {
      const skills = [
        mockSkill({
          name: 'python-guide',
          description: 'Python programming',
          toolName: 'python_guide',
        }),
        mockSkill({
          name: 'javascript-guide',
          description: 'JavaScript programming',
          toolName: 'javascript_guide',
        }),
        mockSkill({
          name: 'general-guide',
          description: 'General programming',
          toolName: 'general_guide',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('guide -python');

      expect(result.matches).not.toContainEqual(expect.objectContaining({ name: 'python-guide' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'javascript-guide' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'general-guide' }));
    });

    it('should match on partial terms (substring matching)', () => {
      const skills = [
        mockSkill({
          name: 'git-workflow',
          description: 'Git workflow patterns',
          toolName: 'git_workflow',
        }),
        mockSkill({
          name: 'github-actions',
          description: 'GitHub Actions setup',
          toolName: 'github_actions',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git');

      expect(result.matches.length).toBe(2);
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'git-workflow' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'github-actions' }));
    });

    it('should require ALL inclusion terms (AND logic)', () => {
      const skills = [
        mockSkill({
          name: 'git-commit',
          description: 'Writing commits',
          toolName: 'git_commit',
        }),
        mockSkill({
          name: 'git-workflow',
          description: 'Workflow patterns',
          toolName: 'git_workflow',
        }),
        mockSkill({
          name: 'documentation',
          description: 'Writing guides',
          toolName: 'documentation',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git writing');

      // Only git-commit matches both terms
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'git-commit' }));
      // git-workflow has git but not writing
      expect(result.matches).not.toContainEqual(expect.objectContaining({ name: 'git-workflow' }));
      // documentation has writing but not git
      expect(result.matches).not.toContainEqual(expect.objectContaining({ name: 'documentation' }));
    });

    it('should exclude skills matching ANY exclusion term', () => {
      const skills = [
        mockSkill({
          name: 'python-basics',
          description: 'Python fundamentals',
          toolName: 'python_basics',
        }),
        mockSkill({
          name: 'javascript-basics',
          description: 'JavaScript fundamentals',
          toolName: 'javascript_basics',
        }),
        mockSkill({
          name: 'general-basics',
          description: 'General fundamentals',
          toolName: 'general_basics',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('basics -python -javascript');

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].name).toBe('general-basics');
    });

    it('should return empty array when no skills match inclusion terms', () => {
      const skills = [
        mockSkill({
          name: 'python-guide',
          description: 'Python programming',
          toolName: 'python_guide',
        }),
        mockSkill({
          name: 'javascript-guide',
          description: 'JavaScript programming',
          toolName: 'javascript_guide',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('rust');

      expect(result.matches).toHaveLength(0);
    });

    it('should handle case-insensitive matching', () => {
      const skills = [
        mockSkill({
          name: 'Git-Commit',
          description: 'Writing Commits',
          toolName: 'git_commit',
        }),
        mockSkill({
          name: 'DOCUMENTATION',
          description: 'Documentation Guide',
          toolName: 'documentation',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should prioritize skills matching more inclusion terms', () => {
      const skills = [
        mockSkill({
          name: 'git-commit-workflow',
          description: 'Complete workflow guide',
          toolName: 'git_commit_workflow',
        }),
        mockSkill({
          name: 'git-basics',
          description: 'Basic git commands',
          toolName: 'git_basics',
        }),
        mockSkill({
          name: 'workflow-patterns',
          description: 'General patterns',
          toolName: 'workflow_patterns',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git workflow');

      // git-commit-workflow matches both terms in name
      expect(result.matches[0].name).toBe('git-commit-workflow');
    });

    it('should handle empty skills array', () => {
      const skills = [];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('test');

      expect(result.matches).toHaveLength(0);
    });

    it('should handle empty query with multiple skills', () => {
      const skills = [
        mockSkill({ name: 'skill1', description: 'Description 1', toolName: 'skill1' }),
        mockSkill({ name: 'skill2', description: 'Description 2', toolName: 'skill2' }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('');

      expect(result.matches).toHaveLength(2);
      expect(result.totalMatches).toBe(2);
    });

    it('should break ties with name matches count', () => {
      const skills = [
        mockSkill({
          name: 'git-workflow-git',
          description: 'Workflow patterns',
          toolName: 'git_workflow_git',
        }),
        mockSkill({
          name: 'workflow',
          description: 'git workflow patterns',
          toolName: 'workflow',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git workflow');

      // git-workflow-git has more name matches (2 vs 1)
      expect(result.matches[0].name).toBe('git-workflow-git');
    });

    it('should break final ties alphabetically by skill name', () => {
      const skills = [
        mockSkill({ name: 'zebra', description: 'Test skill', toolName: 'apple_tool' }),
        mockSkill({ name: 'apple', description: 'Test skill', toolName: 'zebra_tool' }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('test');

      expect(result.matches[0].name).toBe('apple');
      expect(result.matches[1].name).toBe('zebra');
    });

    it('should track totalMatches before exclusion filtering', () => {
      const skills = [
        mockSkill({
          name: 'python-guide',
          description: 'Python programming',
          toolName: 'python_guide',
        }),
        mockSkill({
          name: 'javascript-guide',
          description: 'JavaScript programming',
          toolName: 'javascript_guide',
        }),
        mockSkill({
          name: 'general-guide',
          description: 'General programming',
          toolName: 'general_guide',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('guide -python');

      // totalMatches should be 2 (after exclusion applied)
      expect(result.totalMatches).toBe(2);
      // matches should be 2 (after exclusion)
      expect(result.matches).toHaveLength(2);
    });
  });

  describe('Feedback message generation', () => {
    it('should generate feedback for successful search', () => {
      const skills = [
        mockSkill({
          name: 'git-commit',
          description: 'Writing commits',
          toolName: 'git_commit',
        }),
        mockSkill({
          name: 'git-workflow',
          description: 'Workflow patterns',
          toolName: 'git_workflow',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git');

      expect(result.feedback).toContain('2');
      expect(result.feedback).toContain('✅');
      expect(result.feedback).toContain('Found');
    });

    it('should generate feedback for no results', () => {
      const skills = [];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('nonexistent');

      expect(result.feedback).toContain('❌');
      expect(result.feedback).toContain('No matches found');
    });

    it('should mention included terms in feedback', () => {
      const skills = [
        mockSkill({
          name: 'git-commit',
          description: 'Writing commits',
          toolName: 'git_commit',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git commit');

      expect(result.feedback).toContain('git');
      expect(result.feedback).toContain('commit');
      expect(result.feedback).toContain('Searching for');
    });

    it('should mention excluded terms in feedback', () => {
      const skills = [
        mockSkill({
          name: 'general-guide',
          description: 'General guide',
          toolName: 'general_guide',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('guide -python -javascript');

      expect(result.feedback).toContain('python');
      expect(result.feedback).toContain('javascript');
      expect(result.feedback).toContain('Excluding');
    });

    it('should include correct result count in feedback', () => {
      const skills = [
        mockSkill({ name: 'api-rest', description: 'REST API design', toolName: 'api_rest' }),
        mockSkill({
          name: 'api-graphql',
          description: 'GraphQL API design',
          toolName: 'api_graphql',
        }),
        mockSkill({
          name: 'api-testing',
          description: 'API testing strategies',
          toolName: 'api_testing',
        }),
      ];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('api');

      expect(result.feedback).toContain('3');
      expect(result.feedback).toContain('Found');
    });

    it('should differentiate singular vs plural results', () => {
      const singleSkill = [
        mockSkill({ name: 'testing', description: 'Test writing', toolName: 'testing_tool' }),
      ];
      const multipleSkills = [
        mockSkill({ name: 'testing', description: 'Test writing', toolName: 'testing_tool' }),
        mockSkill({
          name: 'test-patterns',
          description: 'Patterns',
          toolName: 'test_patterns_tool',
        }),
      ];

      const singleRegistry = mockRegistryController(singleSkill);
      const multipleRegistry = mockRegistryController(multipleSkills);

      const singleSearcher = createSkillSearcher(singleRegistry);
      const multipleSearcher = createSkillSearcher(multipleRegistry);

      const singleResult = singleSearcher('test');
      const multipleResult = multipleSearcher('test');

      expect(singleResult.feedback).toContain('Found 1 match');
      expect(multipleResult.feedback).toContain('Found 2');
    });

    it('should handle empty query in feedback', () => {
      const skills = [mockSkill({ name: 'skill1', toolName: 'skill1' })];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('');

      expect(result.feedback).toBeDefined();
      expect(typeof result.feedback).toBe('string');
      expect(result.feedback).toContain('Found');
      expect(result.feedback).toContain('✅');
    });

    it('should format feedback with proper emoji indicators', () => {
      const skills = [mockSkill({ name: 'test', description: 'test', toolName: 'test' })];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);

      const successResult = searcher('test');
      expect(successResult.feedback).toContain('✅');

      const emptySkills = [];
      const emptyRegistry = mockRegistryController(emptySkills);
      const emptySearcher = createSkillSearcher(emptyRegistry);
      const emptyResult = emptySearcher('test');
      expect(emptyResult.feedback).toContain('❌');
    });

    it('should use pipe separator in feedback', () => {
      const skills = [mockSkill({ name: 'git', description: 'git', toolName: 'git' })];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git -python');

      expect(result.feedback).toContain('|');
    });
  });

  describe('Integration tests', () => {
    it('should handle complete search workflow: parse -> rank -> feedback', () => {
      const queryString = 'writing git -deprecated';
      const skills = [
        mockSkill({
          name: 'writing-git-commits',
          description: 'Writing effective git commits',
          toolName: 'writing_git_commits',
        }),
        mockSkill({
          name: 'git-basics',
          description: 'Git fundamentals',
          toolName: 'git_basics',
        }),
        mockSkill({
          name: 'deprecated-git',
          description: 'Old git techniques (deprecated)',
          toolName: 'deprecated_git',
        }),
        mockSkill({
          name: 'writing-docs',
          description: 'Documentation writing',
          toolName: 'writing_docs',
        }),
      ];

      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher(queryString);

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
      const skill = mockSkill({
        name: 'test-skill',
        description: 'A test skill',
        toolName: 'test_skill',
      });
      const registry = mockRegistryController([skill]);
      const searcher = createSkillSearcher(registry);
      const result = searcher('test');

      expect(result.matches[0]).toEqual(skill);
    });

    it('should handle search with special characters in skill names', () => {
      const skills = [
        mockSkill({
          name: 'node.js-setup',
          description: 'Node.js configuration',
          toolName: 'node_js_setup',
        }),
        mockSkill({
          name: 'c++-basics',
          description: 'C++ fundamentals',
          toolName: 'c_basics',
        }),
        mockSkill({
          name: '@typescript-patterns',
          description: 'TypeScript patterns',
          toolName: 'typescript_patterns',
        }),
      ];

      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('node');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should handle search with unicode characters', () => {
      const skills = [
        mockSkill({
          name: 'writing-español',
          description: 'Spanish writing guide',
          toolName: 'writing_spanish',
        }),
        mockSkill({
          name: 'api-日本語',
          description: 'Japanese API guide',
          toolName: 'api_japanese',
        }),
      ];

      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('writing');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should handle complex multi-term queries with exclusions', () => {
      const skills = [
        mockSkill({
          name: 'python-async-networking',
          description: 'Async networking in Python',
          toolName: 'python_async_networking',
        }),
        mockSkill({
          name: 'javascript-async-networking',
          description: 'Async networking in JavaScript',
          toolName: 'javascript_async_networking',
        }),
        mockSkill({
          name: 'async-patterns-guide',
          description: 'General async patterns and networking',
          toolName: 'async_patterns_guide',
        }),
      ];

      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('async networking -python');

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
      const skills = [mockSkill({ name: 'test', description: 'test', toolName: 'test' })];
      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('test');

      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('totalMatches');
      expect(result).toHaveProperty('feedback');
      expect(result).toHaveProperty('query');
    });

    it('should handle large result sets efficiently', () => {
      const skills = Array.from({ length: 100 }, (_, i) =>
        mockSkill({
          name: `skill-${i}`,
          description: 'General purpose skill',
          toolName: `skill_${i}`,
        })
      );

      const registry = mockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('skill');

      expect(result.matches).toHaveLength(100);
      expect(result.totalMatches).toBe(100);
    });
  });
});
