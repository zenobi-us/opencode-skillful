import { type PluginInput, type ToolDefinition, tool } from '@opencode-ai/plugin';
import { normalizePathQuery, stripSkillsPrefix } from '../identifiers';
import { SkillSearcher } from '../services/SkillSearcher';
import type { SkillRegistryManager } from '../types';

/**
 * Tool to search for skills using natural language query syntax
 *
 * The SkillSearcher handles query parsing with support for:
 * - Natural syntax (Gmail-style): "api design"
 * - Negation: "testing -performance"
 * - Quoted phrases: "git commits"
 * - Multiple terms (AND logic): "typescript react testing"
 *
 * Additionally supports path prefix matching:
 * - "experts" → all skills under skills/experts/*
 * - "experts/data-ai" → all skills under that subtree
 * - "*" or empty → list all skills
 */
export function createFindSkillsTool(
  _ctx: PluginInput,
  registry: SkillRegistryManager
): ToolDefinition {
  return tool({
    description:
      "Search for skills using natural query syntax. Supports path prefixes (e.g., 'experts', 'superpowers/writing'), negation (-term), quoted phrases, and free text. Use '*' to list all skills.",
    args: {
      query: tool.schema.string(),
    },
    execute: async (args) => {
      const allSkills = Array.from(registry.byName.registry.values());
      const query = args.query.trim();

      // List all skills if query is empty or "*"
      if (query === '' || query === '*') {
        const resultsList = allSkills
          .sort((a, b) => a.toolName.localeCompare(b.toolName))
          .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
          .join('\n');
        return `Found ${allSkills.length} skill(s):\n\n${resultsList}`;
      }

      // Try path prefix matching first
      const normalizedQuery = normalizePathQuery(query);
      const prefixMatches = allSkills.filter((skill) => {
        const shortName = stripSkillsPrefix(skill.toolName);
        return shortName.startsWith(normalizedQuery);
      });

      if (prefixMatches.length > 0) {
        const resultsList = prefixMatches
          .sort((a, b) => a.toolName.localeCompare(b.toolName))
          .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
          .join('\n');
        return `Found ${prefixMatches.length} skill(s) matching path "${query}":\n\n${resultsList}`;
      }

      // Fall back to text search
      const searcher = new SkillSearcher(allSkills);
      const result = searcher.search(query);

      if (result.matches.length === 0) {
        return `${result.feedback}\n\nNo skills found matching "${query}"`;
      }

      const resultsList = result.matches
        .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
        .join('\n');

      return `${result.feedback}\n\n${resultsList}`;
    },
  });
}
