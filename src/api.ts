/**
 * API Factory - Plugin Initialization and Tool Creation
 *
 * WHY: Centralizes the creation of all plugin components (logger, registry, tools, renderers)
 * in one place. Makes it easy to test different configurations, mock components,
 * and understand the complete initialization flow.
 *
 * RESPONSIBILITY: This is the only place that knows how to wire together:
 * - Logger (for debug output)
 * - SkillRegistry (for discovery and parsing)
 * - Tool creators (functions that create skill_find, skill_use, skill_resource)
 * - PromptRenderer (for format selection and rendering)
 *
 * INITIALIZATION TIMING (CRITICAL):
 * - createLogger(): synchronous, immediate
 * - createSkillRegistry(): synchronous factory call (returns a SkillRegistry object)
 * - createPromptRenderer(): synchronous, immediate (format selection at runtime)
 * - registry.initialise(): NOT called here, caller must do this separately
 *
 * WHY NOT CALL initialise(): The caller (index.ts) needs to await initialise()
 * and handle errors. We can't do that in the factory without making it more complex.
 *
 * RETURN VALUE: Object with:
 * - registry: SkillRegistry instance (must call .initialise() before use)
 * - logger: PluginLogger for debug output
 * - config: PluginConfig (needed for model-aware format selection)
 * - findSkills: Tool creator function for skill search
 * - readResource: Tool creator function for resource reading
 * - loadSkill: Tool creator function for skill loading
 *
 * EXAMPLE:
 *   const api = await createApi(config);
 *   const { registry, config, findSkills, readResource, loadSkill } = api;
 *   // Note: registry is created but NOT yet initialized
 *   // Must be done by caller: await registry.initialise()
 */

import { createLogger } from './services/logger';
import { createSkillRegistry } from './services/SkillRegistry';
import { createSkillFinder } from './tools/SkillFinder';
import { createSkillResourceReader } from './tools/SkillResourceReader';
import { createSkillLoader } from './tools/SkillUser';
import type { PluginConfig } from './types';

export const createApi = async (config: PluginConfig) => {
  const logger = createLogger(config);
  const registry = await createSkillRegistry(config, logger);

  return {
    registry,
    logger,
    config,
    findSkills: createSkillFinder(registry),
    readResource: createSkillResourceReader(registry),
    loadSkill: createSkillLoader(registry),
  };
};
