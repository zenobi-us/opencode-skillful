/**
 * Model Format Resolver - Select renderer based on active LLM model
 *
 * WHY: Different LLM models have different preferences and strengths:
 * - Claude models: optimized for XML, prefer structured XML injection
 * - GPT models: strong JSON parsing, prefer JSON-formatted data
 * - Other models: may benefit from markdown readability
 *
 * This function detects the active model and selects the configured
 * format preference for that model, falling back to the global default.
 *
 * HOW IT WORKS:
 * 1. Query the current session via client.session.message()
 * 2. Extract the modelID from the response
 * 3. Check if modelRenderers[modelID] exists in config
 * 4. Return model-specific format, or fall back to promptRenderer default
 */

import type { ToolContext } from '@opencode-ai/plugin';
import type { PluginConfig } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpencodeClient = any; // Client type from OpenCode plugin

/**
 * Resolve the appropriate prompt format for the current model
 *
 * @param client The OpenCode plugin client (provides session access)
 * @param toolCtx The tool execution context (has sessionID and messageID)
 * @param config The plugin configuration (has promptRenderer and modelRenderers)
 * @returns The format to use: 'json' | 'xml' | 'md'
 */
export async function getModelFormat(
  client: OpencodeClient,
  toolCtx: ToolContext,
  config: PluginConfig
): Promise<'json' | 'xml' | 'md'> {
  if (!client?.session?.message) {
    // Client doesn't have session access, use default
    return config.promptRenderer;
  }

  try {
    // Query current session to get model information
    const result = await client.session.message({
      sessionID: toolCtx.sessionID,
      messageID: toolCtx.messageID,
    });

    // Extract modelID from nested response structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelID = (result as Record<string, any>)?.data?.info?.modelID;

    if (modelID && typeof modelID === 'string') {
      // Check if there's a model-specific renderer preference
      if (config.modelRenderers?.[modelID]) {
        return config.modelRenderers[modelID];
      }
    }
  } catch (error) {
    // If we can't fetch the model info, we'll just use the default
    // Log at debug level so it doesn't spam production logs
    if (config.debug) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.warn(`[DEBUG] Could not determine model format, falling back to default: ${message}`);
    }
  }

  // Fall back to global default
  return config.promptRenderer;
}
