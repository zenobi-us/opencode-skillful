import type { SkillRegistry } from '../types';

/**
 * Creates a tool function that searches for skills
 */
export function createSkillFinder(provider: SkillRegistry) {
  return async (args: { query: string | string[] }) => {
    await provider.controller.ready.whenReady();

    const result = provider.search(args.query);

    const skills = result.matches.map((skill) => ({
      name: skill.toolName,
      description: skill.description,
    }));

    return {
      query: args.query,
      skills,
      summary: {
        total: provider.controller.skills.length,
        matches: result.totalMatches,
        feedback: result.feedback,
      },
      debug: provider.debug,
    };
  };
}
