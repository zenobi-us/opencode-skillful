import type { PluginInput } from '@opencode-ai/plugin';
import { getPluginConfig } from './config';
import { createLogger } from './services/logger';
import { createSkillProvider } from './services/SkillProvider';
import { createSkillRegistry } from './services/SkillRegistry';
import { createSkillFinder } from './tools/SkillFinder';
import { createSkillResourceReader } from './tools/SkillResourceReader';
import { createSkillExecutor } from './tools/SkillScriptExec';
import { createSkillLoader } from './tools/SkillUser';

export const createApi = async (ctx: PluginInput) => {
  const config = await getPluginConfig(ctx);
  const logger = createLogger(config);
  const registry = await createSkillRegistry(config, logger);

  const provider = createSkillProvider({
    config,
    logger,
    ...registry,
  });

  return {
    provider,
    findSkills: createSkillFinder(ctx, provider),
    readResource: createSkillResourceReader(ctx, provider),
    loadSkill: createSkillLoader(ctx, provider),
    runScript: createSkillExecutor(ctx, provider),
  };
};
