/**
 * Bunfig Configuration - Plugin Settings Schema
 *
 * WHY: Bunfig provides typed configuration loading with validation.
 * It allows us to:
 * - Define a schema for all plugin settings (type-safe)
 * - Load from multiple sources (.opencode-skillful.json, ~/.config/opencode-skillful/config.json)
 * - Merge with sensible defaults
 * - Support model-aware prompt renderer selection
 */

export default {
  debug: false,
  basePaths: [] as string[],
  promptRenderer: 'xml' as const,

  /**
   * Model-specific renderer overrides
   *
   * WHY: Different LLM models have different preferences and strengths:
   * - Claude models: trained on XML, prefer structured formats
   * - GPT models: strong JSON parsing, prefer JSON
   * - Other models: may benefit from markdown readability
   *
   * Structure: Record<modelID, format>
   * - modelID: The model identifier from OpenCode (e.g., 'claude-3-5-sonnet')
   * - format: Preferred format for that model ('json' | 'xml' | 'md')
   *
   * Example:
   *   modelRenderers: {
   *     'claude-3-5-sonnet': 'xml',
   *     'gpt-4': 'json',
   *     'llama-2': 'md',
   *   }
   */
  modelRenderers: {} as Record<string, 'json' | 'xml' | 'md'>,
};
