import { SkillProvider } from '../types';
import { createSkillRegistry } from './SkillRegistry';
import { createSkillSearcher } from './SkillSearcher';

export function createSkillProvider(
  args: Awaited<ReturnType<typeof createSkillRegistry>>
): SkillProvider {
  return {
    registry: args.controller,
    searcher: createSkillSearcher(args.controller),
    debug: args.debug,
  };
}
