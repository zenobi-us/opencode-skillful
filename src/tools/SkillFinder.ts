import { type PluginInput, type ToolDefinition, tool } from '@opencode-ai/plugin';
import { SkillSearcher } from '../services/SkillSearcher';
import type { SkillRegistryManager, SkillSearchResult } from '../types';

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
  const skillfinder = SkillSearcher.fromRegistry(registry);

  return tool({
    description:
      "Search for skills using natural query syntax. Supports path prefixes (e.g., 'experts', 'superpowers/writing'), negation (-term), quoted phrases, and free text. Use '*' to list all skills.",
    args: {
      query: tool.schema.string(),
    },
    execute: async (args) => {
      const result = skillfinder.search(args.query);
      return skillResultsFormatter(result);
    },
  });
}

export function skillResultsFormatter(results: SkillSearchResult) {
  const resultsList = results.matches
    .map((m) => `- **${m.name}** \`${m.toolName}\`\n  ${m.description}`)
    .join('\n');

  return `
# Skill Search Results

${resultsList}

${results.feedback}
`;
}
