import { createLogger } from './services/logger';
import { createSkillRegistry } from './services/SkillRegistry';
import { createSkillFinder } from './tools/SkillFinder';
import { createSkillResourceReader } from './tools/SkillResourceReader';
import { createSkillLoader } from './tools/SkillUser';
import { PluginConfig } from './types';

export const createApi = async (config: PluginConfig) => {
  const logger = createLogger(config);
  const registry = await createSkillRegistry(config, logger);

  return {
    registry,
    logger,
    findSkills: createSkillFinder(registry),
    readResource: createSkillResourceReader(registry),
    loadSkill: createSkillLoader(registry),
  };
};
