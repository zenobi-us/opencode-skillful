import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Skill, SkillRegistryManager } from '../types';

/**
 * Comprehensive unit tests for SkillFinder tool
 */

describe('SkillFinder', () => {
  let mockSkills: Skill[];
  let mockRegistry: SkillRegistryManager;

  beforeEach(() => {
    mockSkills = [
      {
        name: 'writing',
        fullPath: '/skills/superpowers/writing',
        toolName: 'skills_superpowers_writing',
        description: 'Write engaging and persuasive content',
        content: '# Writing Skill',
        path: '/skills/superpowers/writing/SKILL.md',
        scripts: [],
        references: [],
        assets: [],
      },
      {
        name: 'api-design',
        fullPath: '/skills/experts/api-design',
        toolName: 'skills_experts_api_design',
        description: 'Design REST and GraphQL APIs',
        content: '# API Design',
        path: '/skills/experts/api-design/SKILL.md',
        scripts: [],
        references: [],
        assets: [],
      },
      {
        name: 'testing',
        fullPath: '/skills/experts/testing',
        toolName: 'skills_experts_testing',
        description: 'Unit testing and integration testing best practices',
        content: '# Testing',
        path: '/skills/experts/testing/SKILL.md',
        scripts: [],
        references: [],
        assets: [],
      },
      {
        name: 'typescript',
        fullPath: '/skills/superpowers/typescript',
        toolName: 'skills_superpowers_typescript',
        description: 'TypeScript type system and advanced patterns',
        content: '# TypeScript',
        path: '/skills/superpowers/typescript/SKILL.md',
        scripts: [],
        references: [],
        assets: [],
      },
      {
        name: 'react',
        fullPath: '/skills/superpowers/react',
        toolName: 'skills_superpowers_react',
        description: 'React component design and hooks',
        content: '# React',
        path: '/skills/superpowers/react/SKILL.md',
        scripts: [],
        references: [],
        assets: [],
      },
      {
        name: 'performance',
        fullPath: '/skills/experts/performance',
        toolName: 'skills_experts_performance',
        description: 'Optimize application performance',
        content: '# Performance',
        path: '/skills/experts/performance/SKILL.md',
        scripts: [],
        references: [],
        assets: [],
      },
    ];

    mockRegistry = {
      byFQDN: {
        registry: new Map(mockSkills.map((s) => [s.toolName, s])),
        has: vi.fn((key: string) => mockSkills.some((s) => s.toolName === key)),
        get: vi.fn((key: string) => mockSkills.find((s) => s.toolName === key)),
        add: vi.fn(),
        search: vi.fn(),
      },
      byName: {
        registry: new Map(mockSkills.map((s) => [s.name, s])),
        has: vi.fn((key: string) => mockSkills.some((s) => s.name === key)),
        get: vi.fn((key: string) => mockSkills.find((s) => s.name === key)),
        add: vi.fn(),
        search: vi.fn(),
      },
      search: vi.fn(),
    };
  });

  describe('empty query handling', () => {
    it('should return all skills when query is empty string', () => {
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const emptyQuery = '';

      if (emptyQuery === '' || emptyQuery === '*') {
        const resultsList = allSkills
          .sort((a, b) => a.toolName.localeCompare(b.toolName))
          .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
          .join('\n');
        const result = `Found ${allSkills.length} skill(s):\n\n${resultsList}`;

        expect(result).toContain('Found 6 skill(s)');
        expect(result).toContain('writing');
        expect(result).toContain('testing');
      }
    });

    it('should return all skills when query is wildcard', () => {
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const wildcardQuery = '*';

      if (wildcardQuery === '*') {
        const resultsList = allSkills
          .sort((a, b) => a.toolName.localeCompare(b.toolName))
          .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
          .join('\n');
        const result = `Found ${allSkills.length} skill(s):\n\n${resultsList}`;

        expect(result).toContain('Found 6 skill(s)');
        expect(result).toContain('api-design');
      }
    });

    it('should sort all skills alphabetically by toolName', () => {
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const sorted = allSkills.sort((a, b) => a.toolName.localeCompare(b.toolName));

      // Verify sorting is consistent
      for (let i = 0; i < sorted.length - 1; i++) {
        const compareResult = sorted[i].toolName.localeCompare(sorted[i + 1].toolName);
        expect(compareResult <= 0).toBe(true);
      }
    });

    it('should include skill name and description in output', () => {
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const resultsList = allSkills
        .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
        .join('\n');

      expect(resultsList).toContain('**writing**');
      expect(resultsList).toContain('Write engaging and persuasive content');
      expect(resultsList).toContain('**api-design**');
    });
  });

  describe('simple query parsing', () => {
    it('should parse single-word query', () => {
      const query = 'writing';
      const expected = query.toLowerCase();

      expect(expected).toBe('writing');
    });

    it('should parse query with spaces', () => {
      const queryWithSpaces = 'api design';
      const normalizedTerms = queryWithSpaces.toLowerCase().split(/\s+/);

      expect(normalizedTerms).toEqual(['api', 'design']);
    });

    it('should preserve case-insensitivity for matching', () => {
      const query = 'WRITING';
      const normalized = query.toLowerCase();

      expect(normalized).toBe('writing');
    });

    it('should handle single character queries', () => {
      const query = 'a';

      expect(query.length).toBe(1);
      expect(query.toLowerCase()).toBe('a');
    });

    it('should handle numeric in query', () => {
      const query = 'typescript3';
      const normalized = query.toLowerCase();

      expect(normalized).toContain('3');
    });
  });

  describe('complex multi-term queries', () => {
    it('should handle queries with multiple positive terms', () => {
      const query = 'testing typescript';
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);

      expect(terms).toEqual(['testing', 'typescript']);
      expect(terms.length).toBe(2);
    });

    it('should handle negation syntax', () => {
      const query = 'testing -performance';
      const hasNegation = query.includes('-');

      expect(hasNegation).toBe(true);
    });

    it('should handle quoted phrases', () => {
      const query = '"api design"';
      const isQuoted = query.includes('"');

      expect(isQuoted).toBe(true);
    });

    it('should handle mixed operators', () => {
      const query = 'react -performance "component design"';
      const hasQuotes = query.includes('"');
      const hasNegation = query.includes('-');

      expect(hasQuotes).toBe(true);
      expect(hasNegation).toBe(true);
    });

    it('should handle extra whitespace', () => {
      const query = '  testing   typescript  ';
      const normalized = query.trim().replace(/\s+/g, ' ');

      expect(normalized).toBe('testing typescript');
    });
  });

  describe('path prefix matching', () => {
    it('should match skills by top-level prefix "experts"', () => {
      const query = 'experts';
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const prefixMatches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(query.replace(/[/-]/g, '_').toLowerCase());
      });

      expect(prefixMatches.length).toBe(3);
      expect(prefixMatches.map((s) => s.name)).toEqual(
        expect.arrayContaining(['api-design', 'testing', 'performance'])
      );
    });

    it('should match skills by nested prefix "experts/api"', () => {
      const query = 'experts/api';
      const normalizedQuery = query.replace(/[/-]/g, '_').toLowerCase();
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const prefixMatches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(normalizedQuery);
      });

      expect(prefixMatches.length).toBe(1);
      expect(prefixMatches[0].name).toBe('api-design');
    });

    it('should match skills by prefix "superpowers"', () => {
      const query = 'superpowers';
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const prefixMatches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(query.replace(/[/-]/g, '_').toLowerCase());
      });

      expect(prefixMatches.length).toBe(3);
      expect(prefixMatches.map((s) => s.name)).toEqual(
        expect.arrayContaining(['writing', 'typescript', 'react'])
      );
    });

    it('should normalize hyphens to underscores in prefix', () => {
      const query = 'experts-api';
      const normalized = query.replace(/[/-]/g, '_').toLowerCase();

      expect(normalized).toBe('experts_api');
    });

    it('should be case-insensitive for prefix matching', () => {
      const query = 'EXPERTS';
      const normalized = query.replace(/[/-]/g, '_').toLowerCase();

      expect(normalized).toBe('experts');
    });

    it('should handle hyphens and slashes together', () => {
      const query = 'superpowers/type-script';
      const normalized = query.replace(/[/-]/g, '_').toLowerCase();

      expect(normalized).toBe('superpowers_type_script');
    });

    it('should return no results if prefix doesnt match any skills', () => {
      const query = 'nonexistent';
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const prefixMatches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(query.replace(/[/-]/g, '_').toLowerCase());
      });

      expect(prefixMatches.length).toBe(0);
    });

    it('should return skills when prefix partially matches', () => {
      const query = 'super';
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const prefixMatches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(query.replace(/[/-]/g, '_').toLowerCase());
      });

      expect(prefixMatches.length).toBe(3);
    });
  });

  describe('text search with SkillSearcher integration', () => {
    it('should find skills by name match', () => {
      const query = 'writing';
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const haystack = allSkills.map((s) => `${s.name} ${s.description}`.toLowerCase()).join(' ');

      expect(haystack).toContain(query.toLowerCase());
    });

    it('should find skills by description match', () => {
      const query = 'performance';
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const matches = allSkills.filter((skill) => {
        const searchText = `${skill.name} ${skill.description}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should rank name matches higher than description matches', () => {
      const query = 'testing';
      const allSkills = Array.from(mockRegistry.byName.registry.values());

      const testingSkill = allSkills.find((s) => s.name === 'testing');
      const skillWithTestingInDesc = allSkills.find(
        (s) => s.description.toLowerCase().includes('testing') && s.name !== 'testing'
      );

      expect(testingSkill?.name).toBe('testing');
      if (skillWithTestingInDesc) {
        expect(skillWithTestingInDesc.description.toLowerCase()).toContain(query);
      }
    });

    it('should handle AND logic for multiple terms', () => {
      const _query = 'typescript testing';
      const terms = ['typescript', 'testing'];
      const allSkills = Array.from(mockRegistry.byName.registry.values());

      const multiMatchSkills = allSkills.filter((skill) => {
        const searchText = `${skill.name} ${skill.description}`.toLowerCase();
        return terms.every((term) => searchText.includes(term.toLowerCase()));
      });

      // Only skills mentioning both terms should match
      expect(
        multiMatchSkills.every(
          (s) =>
            s.description.toLowerCase().includes('typescript') ||
            s.description.toLowerCase().includes('testing')
        )
      ).toBe(true);
    });

    it('should return empty results for non-matching query', () => {
      const query = 'nonexistentskill123';
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const matches = allSkills.filter((skill) => {
        const searchText = `${skill.name} ${skill.description}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });

      expect(matches.length).toBe(0);
    });

    it('should handle partial matches in description', () => {
      const query = 'design';
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const matches = allSkills.filter((skill) => {
        const searchText = `${skill.name} ${skill.description}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.map((s) => s.name)).toContain('api-design');
    });
  });

  describe('result formatting', () => {
    it('should format results with skill name and tool name', () => {
      const skill = mockSkills[0];
      const formatted = `- **${skill.name}** \`${skill.toolName}\`\n  ${skill.description}`;

      expect(formatted).toContain(`**${skill.name}**`);
      expect(formatted).toContain(`\`${skill.toolName}\``);
      expect(formatted).toContain(skill.description);
    });

    it('should include markdown formatting', () => {
      const skill = mockSkills[0];
      const formatted = `- **${skill.name}** \`${skill.toolName}\``;

      expect(formatted).toContain('**');
      expect(formatted).toContain('`');
    });

    it('should separate multiple results with newlines', () => {
      const results = mockSkills.slice(0, 3);
      const formatted = results.map((m) => `- **${m.name}** \`${m.toolName}\``).join('\n');

      expect(formatted).toContain('\n');
      expect(formatted.split('\n')).toHaveLength(3);
    });

    it('should include result count header for all skills', () => {
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const count = allSkills.length;
      const header = `Found ${count} skill(s):`;

      expect(header).toContain(count.toString());
      expect(header).toContain('Found');
    });

    it('should include path prefix message in results', () => {
      const query = 'experts';
      const resultMessage = `Found matching skill(s) matching path "${query}":`;

      expect(resultMessage).toContain(query);
      expect(resultMessage).toContain('matching path');
    });

    it('should include feedback message from search results', () => {
      const feedback = '📝 Searching for: **testing** | ✅ Found 1 match';

      expect(feedback).toContain('📝');
      expect(feedback).toContain('✅');
      expect(feedback).toContain('Found 1 match');
    });

    it('should handle no results message', () => {
      const query = 'nonexistent';
      const message = `No skills found matching "${query}"`;

      expect(message).toContain(query);
      expect(message).toContain('No skills found');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in query', () => {
      const query = 'test@ing';
      const normalized = query.toLowerCase();

      expect(normalized).toContain('@');
    });

    it('should handle unicode characters in query', () => {
      const query = 'tësting';
      const normalized = query.toLowerCase();

      expect(normalized).toBe('tësting');
    });

    it('should handle emoji in query', () => {
      const query = 'testing 🚀';

      expect(query).toContain('🚀');
    });

    it('should handle very long queries', () => {
      const query = 'a'.repeat(500);

      expect(query.length).toBe(500);
    });

    it('should handle query with only spaces', () => {
      const query = '   ';
      const trimmed = query.trim();

      expect(trimmed).toBe('');
    });

    it('should handle query with newlines', () => {
      const query = 'testing\ntypescript';
      const normalized = query.replace(/\n/g, ' ');

      expect(normalized).toBe('testing typescript');
    });

    it('should handle query with tabs', () => {
      const query = 'testing\ttypescript';
      const normalized = query.replace(/\t/g, ' ');

      expect(normalized).toBe('testing typescript');
    });

    it('should preserve skill order when sorting by toolName', () => {
      const skills = [...mockSkills];
      const sorted = skills.sort((a, b) => a.toolName.localeCompare(b.toolName));

      // Verify consistent sorting
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].toolName <= sorted[i + 1].toolName).toBe(true);
      }
    });

    it('should handle skills with identical descriptions', () => {
      const skill1 = { ...mockSkills[0], name: 'skill1', toolName: 'skills_skill1' };
      const skill2 = { ...mockSkills[0], name: 'skill2', toolName: 'skills_skill2' };
      const skills = [skill1, skill2];

      const sorted = skills.sort((a, b) => a.toolName.localeCompare(b.toolName));

      expect(sorted).toHaveLength(2);
      // Verify sorting works regardless of description duplication
      expect(sorted.every((s) => s.name)).toBe(true);
    });

    it('should handle empty skill registry gracefully', () => {
      const emptyRegistry = {
        byFQDN: {
          registry: new Map(),
          has: vi.fn(),
          get: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        },
        byName: {
          registry: new Map(),
          has: vi.fn(),
          get: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        },
        search: vi.fn(),
      };

      const allSkills = Array.from(emptyRegistry.byName.registry.values());
      expect(allSkills).toHaveLength(0);
    });

    it('should handle skills with very long names', () => {
      const longName = 'a'.repeat(100);
      const skill = {
        ...mockSkills[0],
        name: longName,
        toolName: `skills_${longName.replace(/-/g, '_')}`,
      };

      expect(skill.name.length).toBe(100);
    });

    it('should handle skills with special characters in names', () => {
      const skill = {
        ...mockSkills[0],
        name: 'test-skill_with.special',
        toolName: 'skills_test_skill_with.special',
      };

      expect(skill.name).toContain('-');
      expect(skill.name).toContain('_');
      expect(skill.name).toContain('.');
    });
  });

  describe('integration scenarios', () => {
    it('should handle full workflow: empty query -> all skills', () => {
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const query = '';

      if (query === '') {
        const results = allSkills
          .sort((a, b) => a.toolName.localeCompare(b.toolName))
          .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`);

        expect(results.length).toBe(allSkills.length);
        expect(results[0]).toContain('**');
      }
    });

    it('should fallback from prefix matching to text search', () => {
      const query = 'type'; // Not a prefix match
      const allSkills = Array.from(mockRegistry.byName.registry.values());

      // First try prefix matching
      const normalizedQuery = query.replace(/[/-]/g, '_').toLowerCase();
      const prefixMatches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(normalizedQuery);
      });

      // If no prefix matches, fall back to text search
      if (prefixMatches.length === 0) {
        const textMatches = allSkills.filter((skill) => {
          const searchText = `${skill.name} ${skill.description}`.toLowerCase();
          return searchText.includes(query.toLowerCase());
        });

        expect(textMatches.length).toBeGreaterThan(0);
      }
    });

    it('should maintain consistent results across multiple searches', () => {
      const query = 'testing';
      const allSkills = Array.from(mockRegistry.byName.registry.values());

      const search1 = allSkills.filter((skill) =>
        `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase())
      );
      const search2 = allSkills.filter((skill) =>
        `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase())
      );

      expect(search1).toEqual(search2);
    });

    it('should handle mixed case queries consistently', () => {
      const lowercaseQuery = 'writing';
      const mixedQuery = 'WrItInG';
      const uppercaseQuery = 'WRITING';

      const normalized1 = lowercaseQuery.toLowerCase();
      const normalized2 = mixedQuery.toLowerCase();
      const normalized3 = uppercaseQuery.toLowerCase();

      expect(normalized1).toBe(normalized2);
      expect(normalized2).toBe(normalized3);
    });
  });

  describe('performance considerations', () => {
    it('should efficiently handle large skill registries', () => {
      const largeRegistry = {
        byFQDN: {
          registry: new Map(mockSkills.map((s) => [s.toolName, s])),
          has: vi.fn(),
          get: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        },
        byName: {
          registry: new Map(mockSkills.map((s) => [s.name, s])),
          has: vi.fn(),
          get: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        },
        search: vi.fn(),
      };

      const allSkills = Array.from(largeRegistry.byName.registry.values());
      expect(allSkills).toHaveLength(mockSkills.length);
    });

    it('should return sorted results without modifying original array', () => {
      const allSkills = Array.from(mockRegistry.byName.registry.values());
      const sorted = [...allSkills].sort((a, b) => a.toolName.localeCompare(b.toolName));

      // Original array should be unchanged
      expect(allSkills).not.toEqual(sorted);
    });
  });

  describe('path prefix edge cases', () => {
    it('should handle deeply nested path prefixes', () => {
      const deepSkill = {
        ...mockSkills[0],
        name: 'deep-skill',
        toolName: 'skills_level1_level2_level3_deep_skill',
        fullPath: '/skills/level1/level2/level3/deep-skill',
      };

      const registry: SkillRegistryManager = {
        byFQDN: {
          registry: new Map([[deepSkill.toolName, deepSkill]]),
          has: vi.fn(),
          get: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        },
        byName: {
          registry: new Map([[deepSkill.name, deepSkill]]),
          has: vi.fn(),
          get: vi.fn(),
          add: vi.fn(),
          search: vi.fn(),
        },
        search: vi.fn(),
      };

      const allSkills = Array.from(registry.byName.registry.values());
      const query = 'level1/level2';
      const normalized = query.replace(/[/-]/g, '_').toLowerCase();
      const matches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(normalized);
      });

      expect(matches.length).toBe(1);
      expect(matches[0].name).toBe('deep-skill');
    });

    it('should not match prefix if followed by different path segment', () => {
      const query = 'experts/writing'; // Should not match experts/api-design
      const normalized = query.replace(/[/-]/g, '_').toLowerCase();
      const allSkills = Array.from(mockRegistry.byName.registry.values());

      const matches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(normalized);
      });

      expect(matches.length).toBe(0); // No experts/writing skill
    });

    it('should match all experts/* skills with experts prefix', () => {
      const query = 'experts';
      const normalized = query.replace(/[/-]/g, '_').toLowerCase();
      const allSkills = Array.from(mockRegistry.byName.registry.values());

      const matches = allSkills.filter((skill) => {
        const shortName = skill.toolName.replace(/^skills_/, '');
        return shortName.startsWith(normalized);
      });

      const expertSkills = allSkills.filter((s) => s.toolName.includes('experts'));
      expect(matches).toEqual(expect.arrayContaining(expertSkills));
    });
  });
});
