import { PluginConfig, SkillProvider } from '../types';
import { createLogger } from './logger';
import { createSkillRegistry } from './SkillRegistry';
import { createSkillSearcher } from './SkillSearcher';

export async function createSkillProvider(
  args: {
    config: PluginConfig;
  } & Awaited<ReturnType<typeof createSkillRegistry>>
): Promise<SkillProvider> {
  const logger = createLogger(args.config);
  return {
    registry: args.controller,
    searcher: createSkillSearcher(args.controller),
    debug: args.debug,
    logger,
  };
}
