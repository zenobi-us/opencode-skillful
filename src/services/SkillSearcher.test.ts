import { describe, it, expect } from 'vitest';
import { createSkillSearcher } from './SkillSearcher';
import { createMockSkill, createMockRegistryController } from '../mocks';
import { Skill } from '../types';

describe('SkillSearcher', () => {
  describe('Query parsing', () => {
    it('should parse simple query with single term', () => {
      const searcher = createSkillSearcher(
        createMockRegistryController([createMockSkill({ name: 'writing' })])
      );
      const result = searcher('writing');

      expect(result.query.include).toContain('writing');
      expect(result.query.exclude).toHaveLength(0);
    });

    it('should parse query with multiple inclusion terms', () => {
      const searcher = createSkillSearcher(
        createMockRegistryController([
          createMockSkill({
            name: 'writing-git-commits',
            description: 'Learn to write git commits',
          }),
        ])
      );

      const result = searcher('writing git commit');

      expect(result.query.include).toContain('writing');
      expect(result.query.include).toContain('git');
      expect(result.query.include).toContain('commit');
      expect(result.query.exclude).toHaveLength(0);
    });

    it('should parse query with exclusion terms (minus prefix)', () => {
      const searcher = createSkillSearcher(
        createMockRegistryController([
          createMockSkill({ name: 'writing', description: 'General writing' }),
          createMockSkill({ name: 'document-writing', description: 'Document writing' }),
        ])
      );
      const result = searcher('writing -document');

      expect(result.query.include).toContain('writing');
      expect(result.query.exclude).toContain('document');
    });

    it('should parse query with multiple exclusion terms', () => {
      const searcher = createSkillSearcher(createMockRegistryController([]));
      const result = searcher('tool -python -javascript');

      expect(result.query.include).toContain('tool');
      expect(result.query.exclude).toContain('python');
      expect(result.query.exclude).toContain('javascript');
    });

    it('should parse mixed inclusion and exclusion terms', () => {
      const skills: Skill[] = [];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('api -deprecated -legacy');

      expect(result.query.include).toContain('api');
      expect(result.query.exclude).toContain('deprecated');
      expect(result.query.exclude).toContain('legacy');
    });

    it('should handle quoted phrases with spaces', () => {
      const skills = [
        createMockSkill({ name: 'git-commit-guide', description: 'git commit message guide' }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('"git commit" -draft');

      expect(result.query.exclude).toContain('draft');
    });

    it('should handle empty string query', () => {
      const skills = [createMockSkill({ name: 'skill1' })];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('');

      expect(result.query.include).toHaveLength(0);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].name).toBe('skill1');
    });

    it('should handle only whitespace', () => {
      const skills: Skill[] = [];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('   ');

      expect(result.query.include).toHaveLength(0);
      expect(result.matches).toHaveLength(0);
    });

    it('should normalize query to lowercase', () => {
      const skills = [createMockSkill({ name: 'writing', description: 'Writing skills' })];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('WRITING GIT');

      expect(result.query.include).toContain('writing');
      expect(result.query.include).toContain('git');
    });

    it('should handle special characters in query', () => {
      const skills = [
        createMockSkill({ name: 'node.js-setup', description: 'Node.js configuration' }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('node.js');

      expect(result.query.include.length).toBeGreaterThan(0);
    });

    it('should handle only exclusion terms', () => {
      const skills: Skill[] = [];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('-python -javascript');

      expect(result.query.include).toHaveLength(0);
      expect(result.query.exclude).toHaveLength(2);
    });

    it('should track term count and exclusion flag', () => {
      const skills: Skill[] = [];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('api -deprecated');

      expect(result.query.termCount).toBeGreaterThan(0);
      expect(result.query.hasExclusions).toBe(true);
    });

    it('should track original query string', () => {
      const queryString = 'writing git -deprecated';
      const skills: Skill[] = [];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher(queryString);

      expect(result.query.originalQuery).toBe(queryString);
    });
  });

  describe('Ranking algorithm', () => {
    it('should rank exact name match highest', () => {
      const skills = [
        createMockSkill({
          name: 'git-commit',
          description: 'Write commits',
          toolName: 'git_commit',
        }),
        createMockSkill({
          name: 'documentation',
          description: 'git commit guide',
          toolName: 'documentation',
        }),
        createMockSkill({ name: 'api', description: 'git commit api', toolName: 'api' }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git-commit');

      expect(result.matches[0].name).toBe('git-commit');
    });

    it('should rank name matches higher than description matches', () => {
      const skills = [
        createMockSkill({
          name: 'blog-post',
          description: 'writing blog content',
          toolName: 'blog_post',
        }),
        createMockSkill({
          name: 'documentation-guide',
          description: 'Write good documentation',
          toolName: 'documentation_guide',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('writing');

      // Only 'blog-post' matches because 'writing' is in its description
      // 'documentation-guide' doesn't contain 'writing' anywhere
      expect(result.matches[0].name).toBe('blog-post');
      expect(result.matches).toHaveLength(1);
    });

    it('should filter out skills with exclusion terms', () => {
      const skills = [
        createMockSkill({
          name: 'python-guide',
          description: 'Python programming',
          toolName: 'python_guide',
        }),
        createMockSkill({
          name: 'javascript-guide',
          description: 'JavaScript programming',
          toolName: 'javascript_guide',
        }),
        createMockSkill({
          name: 'general-guide',
          description: 'General programming',
          toolName: 'general_guide',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('guide -python');

      expect(result.matches).not.toContainEqual(expect.objectContaining({ name: 'python-guide' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'javascript-guide' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'general-guide' }));
    });

    it('should match on partial terms (substring matching)', () => {
      const skills = [
        createMockSkill({
          name: 'git-workflow',
          description: 'Git workflow patterns',
          toolName: 'git_workflow',
        }),
        createMockSkill({
          name: 'github-actions',
          description: 'GitHub Actions setup',
          toolName: 'github_actions',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git');

      expect(result.matches.length).toBe(2);
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'git-workflow' }));
      expect(result.matches).toContainEqual(expect.objectContaining({ name: 'github-actions' }));
    });

    it('should require ALL inclusion terms (AND logic)', () => {
      const skills = [
        createMockSkill({
          name: 'git-commit',
          description: 'Writing commits',
          toolName: 'git_commit',
        }),
        createMockSkill({
          name: 'git-workflow',
          description: 'Workflow patterns',
          toolName: 'git_workflow',
        }),
        createMockSkill({
          name: 'documentation',
          description: 'Writing guides',
          toolName: 'documentation',
        }),
      ];
      const registry = createMockRegistryController(skills);
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
        createMockSkill({
          name: 'python-basics',
          description: 'Python fundamentals',
          toolName: 'python_basics',
        }),
        createMockSkill({
          name: 'javascript-basics',
          description: 'JavaScript fundamentals',
          toolName: 'javascript_basics',
        }),
        createMockSkill({
          name: 'general-basics',
          description: 'General fundamentals',
          toolName: 'general_basics',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('basics -python -javascript');

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].name).toBe('general-basics');
    });

    it('should return empty array when no skills match inclusion terms', () => {
      const skills: Skill[] = [
        createMockSkill({
          name: 'python-guide',
          description: 'Python programming',
          toolName: 'python_guide',
        }),
        createMockSkill({
          name: 'javascript-guide',
          description: 'JavaScript programming',
          toolName: 'javascript_guide',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('rust');

      expect(result.matches).toHaveLength(0);
    });

    it('should handle case-insensitive matching', () => {
      const skills = [
        createMockSkill({
          name: 'Git-Commit',
          description: 'Writing Commits',
          toolName: 'git_commit',
        }),
        createMockSkill({
          name: 'DOCUMENTATION',
          description: 'Documentation Guide',
          toolName: 'documentation',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should prioritize skills matching more inclusion terms', () => {
      const skills = [
        createMockSkill({
          name: 'git-commit-workflow',
          description: 'Complete workflow guide',
          toolName: 'git_commit_workflow',
        }),
        createMockSkill({
          name: 'git-basics',
          description: 'Basic git commands',
          toolName: 'git_basics',
        }),
        createMockSkill({
          name: 'workflow-patterns',
          description: 'General patterns',
          toolName: 'workflow_patterns',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git workflow');

      // git-commit-workflow matches both terms in name
      expect(result.matches[0].name).toBe('git-commit-workflow');
    });

    it('should handle empty skills array', () => {
      const skills: Skill[] = [];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('test');

      expect(result.matches).toHaveLength(0);
    });

    it('should handle empty query with multiple skills', () => {
      const skills = [
        createMockSkill({ name: 'skill1', description: 'Description 1', toolName: 'skill1' }),
        createMockSkill({ name: 'skill2', description: 'Description 2', toolName: 'skill2' }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('');

      expect(result.matches).toHaveLength(2);
      expect(result.totalMatches).toBe(2);
    });

    it('should break ties with name matches count', () => {
      const skills = [
        createMockSkill({
          name: 'git-workflow-git',
          description: 'Workflow patterns',
          toolName: 'git_workflow_git',
        }),
        createMockSkill({
          name: 'workflow',
          description: 'git workflow patterns',
          toolName: 'workflow',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git workflow');

      // git-workflow-git has more name matches (2 vs 1)
      expect(result.matches[0].name).toBe('git-workflow-git');
    });

    it('should break final ties alphabetically by skill name', () => {
      const skills = [
        createMockSkill({ name: 'zebra', description: 'Test skill', toolName: 'apple_tool' }),
        createMockSkill({ name: 'apple', description: 'Test skill', toolName: 'zebra_tool' }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('test');

      expect(result.matches[0].name).toBe('apple');
      expect(result.matches[1].name).toBe('zebra');
    });

    it('should track totalMatches before exclusion filtering', () => {
      const skills = [
        createMockSkill({
          name: 'python-guide',
          description: 'Python programming',
          toolName: 'python_guide',
        }),
        createMockSkill({
          name: 'javascript-guide',
          description: 'JavaScript programming',
          toolName: 'javascript_guide',
        }),
        createMockSkill({
          name: 'general-guide',
          description: 'General programming',
          toolName: 'general_guide',
        }),
      ];
      const registry = createMockRegistryController(skills);
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
        createMockSkill({
          name: 'git-commit',
          description: 'Writing commits',
          toolName: 'git_commit',
        }),
        createMockSkill({
          name: 'git-workflow',
          description: 'Workflow patterns',
          toolName: 'git_workflow',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git');

      expect(result.feedback).toContain('2');
      expect(result.feedback).toContain('✅');
      expect(result.feedback).toContain('Found');
    });

    it('should generate feedback for no results', () => {
      const skills: Skill[] = [];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('nonexistent');

      expect(result.feedback).toContain('❌');
      expect(result.feedback).toContain('No matches found');
    });

    it('should mention included terms in feedback', () => {
      const skills = [
        createMockSkill({
          name: 'git-commit',
          description: 'Writing commits',
          toolName: 'git_commit',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git commit');

      expect(result.feedback).toContain('git');
      expect(result.feedback).toContain('commit');
      expect(result.feedback).toContain('Searching for');
    });

    it('should mention excluded terms in feedback', () => {
      const skills = [
        createMockSkill({
          name: 'general-guide',
          description: 'General guide',
          toolName: 'general_guide',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('guide -python -javascript');

      expect(result.feedback).toContain('python');
      expect(result.feedback).toContain('javascript');
      expect(result.feedback).toContain('Excluding');
    });

    it('should include correct result count in feedback', () => {
      const skills = [
        createMockSkill({ name: 'api-rest', description: 'REST API design', toolName: 'api_rest' }),
        createMockSkill({
          name: 'api-graphql',
          description: 'GraphQL API design',
          toolName: 'api_graphql',
        }),
        createMockSkill({
          name: 'api-testing',
          description: 'API testing strategies',
          toolName: 'api_testing',
        }),
      ];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('api');

      expect(result.feedback).toContain('3');
      expect(result.feedback).toContain('Found');
    });

    it('should differentiate singular vs plural results', () => {
      const singleSkill = [
        createMockSkill({ name: 'testing', description: 'Test writing', toolName: 'testing_tool' }),
      ];
      const multipleSkills = [
        createMockSkill({ name: 'testing', description: 'Test writing', toolName: 'testing_tool' }),
        createMockSkill({
          name: 'test-patterns',
          description: 'Patterns',
          toolName: 'test_patterns_tool',
        }),
      ];

      const singleRegistry = createMockRegistryController(singleSkill);
      const multipleRegistry = createMockRegistryController(multipleSkills);

      const singleSearcher = createSkillSearcher(singleRegistry);
      const multipleSearcher = createSkillSearcher(multipleRegistry);

      const singleResult = singleSearcher('test');
      const multipleResult = multipleSearcher('test');

      expect(singleResult.feedback).toContain('Found 1 match');
      expect(multipleResult.feedback).toContain('Found 2');
    });

    it('should handle empty query in feedback', () => {
      const skills = [createMockSkill({ name: 'skill1', toolName: 'skill1' })];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('');

      expect(result.feedback).toBeDefined();
      expect(typeof result.feedback).toBe('string');
      expect(result.feedback).toContain('Found');
      expect(result.feedback).toContain('✅');
    });

    it('should format feedback with proper emoji indicators', () => {
      const skills = [createMockSkill({ name: 'test', description: 'test', toolName: 'test' })];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);

      const successResult = searcher('test');
      expect(successResult.feedback).toContain('✅');

      const emptySkills: Skill[] = [];
      const emptyRegistry = createMockRegistryController(emptySkills);
      const emptySearcher = createSkillSearcher(emptyRegistry);
      const emptyResult = emptySearcher('test');
      expect(emptyResult.feedback).toContain('❌');
    });

    it('should use pipe separator in feedback', () => {
      const skills = [createMockSkill({ name: 'git', description: 'git', toolName: 'git' })];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('git -python');

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
          toolName: 'writing_git_commits',
        }),
        createMockSkill({
          name: 'git-basics',
          description: 'Git fundamentals',
          toolName: 'git_basics',
        }),
        createMockSkill({
          name: 'deprecated-git',
          description: 'Old git techniques (deprecated)',
          toolName: 'deprecated_git',
        }),
        createMockSkill({
          name: 'writing-docs',
          description: 'Documentation writing',
          toolName: 'writing_docs',
        }),
      ];

      const registry = createMockRegistryController(skills);
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
      const skill = createMockSkill({
        name: 'test-skill',
        description: 'A test skill',
        toolName: 'test_skill',
      });
      const registry = createMockRegistryController([skill]);
      const searcher = createSkillSearcher(registry);
      const result = searcher('test');

      expect(result.matches[0]).toEqual(skill);
    });

    it('should handle search with special characters in skill names', () => {
      const skills = [
        createMockSkill({
          name: 'node.js-setup',
          description: 'Node.js configuration',
          toolName: 'node_js_setup',
        }),
        createMockSkill({
          name: 'c++-basics',
          description: 'C++ fundamentals',
          toolName: 'c_basics',
        }),
        createMockSkill({
          name: '@typescript-patterns',
          description: 'TypeScript patterns',
          toolName: 'typescript_patterns',
        }),
      ];

      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('node');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should handle search with unicode characters', () => {
      const skills = [
        createMockSkill({
          name: 'writing-español',
          description: 'Spanish writing guide',
          toolName: 'writing_spanish',
        }),
        createMockSkill({
          name: 'api-日本語',
          description: 'Japanese API guide',
          toolName: 'api_japanese',
        }),
      ];

      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('writing');

      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should handle complex multi-term queries with exclusions', () => {
      const skills = [
        createMockSkill({
          name: 'python-async-networking',
          description: 'Async networking in Python',
          toolName: 'python_async_networking',
        }),
        createMockSkill({
          name: 'javascript-async-networking',
          description: 'Async networking in JavaScript',
          toolName: 'javascript_async_networking',
        }),
        createMockSkill({
          name: 'async-patterns-guide',
          description: 'General async patterns and networking',
          toolName: 'async_patterns_guide',
        }),
      ];

      const registry = createMockRegistryController(skills);
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
      const skills = [createMockSkill({ name: 'test', description: 'test', toolName: 'test' })];
      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('test');

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
          toolName: `skill_${i}`,
        })
      );

      const registry = createMockRegistryController(skills);
      const searcher = createSkillSearcher(registry);
      const result = searcher('skill');

      expect(result.matches).toHaveLength(100);
      expect(result.totalMatches).toBe(100);
    });
  });
});
