/**
 * Model Format Resolver - Select renderer based on active LLM model
 *
 * WHY: Different LLM models have different preferences and strengths:
 * - Claude models: optimized for XML, prefer structured XML injection
 * - GPT models: strong JSON parsing, prefer JSON-formatted data
 * - Other models: may benefit from markdown readability
 *
 * This function detects the active model and selects the configured
 * format preference for that model, falling back to progressively more
 * generic model patterns.
 *
 * HOW IT WORKS:
 * 1. Query the current session via client.session.message()
 * 2. Extract the modelID from the response (e.g., "anthropic-claude-3-5-sonnet")
 * 3. Try matching in order:
 *    - Full model ID (e.g., "anthropic-claude-3-5-sonnet")
 *    - Generic model pattern (e.g., "claude-3-5-sonnet")
 * 4. If no match, fall back to promptRenderer default
 */

import type { PluginConfig } from '../types';

/**
 * Resolve the appropriate prompt format for the current model
 *
 * @param args An object containing:
 *   - modelId?: The identifier of the active model (e.g., "claude-3-5-sonnet")
 *   - providerId?: The identifier of the model provider (e.g., "anthropic")
 *   - config: The plugin configuration (has promptRenderer and modelRenderers)
 * @returns The format to use: 'json' | 'xml' | 'md'
 */
export function getModelFormat(args: {
  modelId?: string;
  providerId?: string;
  config: PluginConfig;
}): 'json' | 'xml' | 'md' {
  const { modelId, providerId, config } = args;
  const modelRenderers = config.modelRenderers ?? {};

  // Prefer full provider-model key when both are defined
  if (providerId && modelId) {
    const combinedKey = `${providerId}-${modelId}`;
    if (combinedKey in modelRenderers) {
      return modelRenderers[combinedKey];
    }
  }

  // Fallback to model-only key when modelId is defined
  if (modelId && modelId in modelRenderers) {
    return modelRenderers[modelId];
  }

  // Final fallback to default promptRenderer
  return config.promptRenderer;
}
