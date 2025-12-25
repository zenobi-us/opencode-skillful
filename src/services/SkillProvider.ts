import { PluginConfig, PluginLogger, SkillProvider } from '../types';
import { createSkillRegistry } from './SkillRegistry';
import { createSkillSearcher } from './SkillSearcher';

export function createSkillProvider(
  args: {
    config: PluginConfig;
    logger: PluginLogger;
  } & Awaited<ReturnType<typeof createSkillRegistry>>
): SkillProvider {
  return {
    registry: args.controller,
    searcher: createSkillSearcher(args.controller),
    debug: args.debug,
    logger: args.logger,
  };
}
