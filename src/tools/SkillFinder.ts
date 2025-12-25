import { type PluginInput, type ToolDefinition, tool } from '@opencode-ai/plugin';
import type { SkillProvider } from '../types';

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
export function createFindSkillsTool(_ctx: PluginInput, provider: SkillProvider): ToolDefinition {
  return tool({
    description: `
Search for skills using natural query syntax. 

Supports query features: 
- path prefixes (e.g., 'experts', 'superpowers/writing'), 
- modifiers: (-term) or (+term),
- quoted phrases,
- and free text. 

Use '*' to list all skills.`,
    args: {
      query: tool.schema.string(),
    },
    execute: async (args) => {
      const result = provider.searcher(args.query);

      const results = result.matches
        .map(
          (skill) =>
            `<Skill id="${skill.toolName}" shortname="${skill.name}" > ${skill.description} </Skill>`
        )
        .join('\n');

      const debugInfo = provider.debug
        ? `
  <Debug>
    <Discovered>${provider.debug.discovered}</Discovered>
    <Parsed>${provider.debug.parsed}</Parsed>
    <Rejected>${provider.debug.rejected}</Rejected>
    <Duplicates>${provider.debug.duplicates}</Duplicates>
    <Errors>
      ${provider.debug.errors.map((e) => `<Error>${e}</Error>`).join('\n')}
    </Errors>
  </Debug>`
        : '';

      return `<SkillSearchResults query="${args.query}">
${results}
<Summary>
  <Total>${provider.registry.skills.length}</Total>
  <Matches>${result.totalMatches}</Matches>
  <Feedback>${result.feedback}</Feedback>${debugInfo}
</Summary>
</SkillSearchResults>`;
    },
  });
}
