import type { PluginInput } from '@opencode-ai/plugin';
import type { SkillProvider } from '../types';

/**
 * Creates a tool function that searches for skills
 */
export function createSkillFinder(_ctx: PluginInput, provider: SkillProvider) {
  return async (args: { query: string | string[] }) => {
    const result = provider.searcher(args.query);

    const results = result.matches
      .map(
        (skill) =>
          `<Skill skill_name="${skill.toolName}" skill_shortname="${skill.name}">${skill.description}</Skill>`
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
  <Skills>
    ${results}
  </Skills>
  <Summary>
    <Total>${provider.registry.skills.length}</Total>
    <Matches>${result.totalMatches}</Matches>
    <Feedback>${result.feedback}</Feedback>
    ${debugInfo}
  </Summary>
</SkillSearchResults>`;
  };
}
