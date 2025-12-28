import type { PluginInput } from '@opencode-ai/plugin';
import { join } from 'path/posix';
import { mergeDeepLeft } from 'ramda';
import type { PluginConfig } from './types';
import envPaths from 'env-paths';

export const OpenCodePaths = envPaths('opencode', { suffix: '' });

export async function getPluginConfig(ctx: PluginInput): Promise<PluginConfig> {
  const base = {
    debug: false,
    basePaths: [
      join(OpenCodePaths.config, 'skills'), // Lowest priority: Standard User Config (windows)
      join(ctx.directory, '.opencode', 'skills'), // Highest priority: Project-local
    ],
  };

  return mergeDeepLeft({}, base);
}
