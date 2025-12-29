/**
 * PromptRenderer Interface - Provider Pattern for Prompt Injection Formatting
 *
 * WHY: Different LLM models have different strengths and preferences for structured data:
 * - Claude models: trained extensively on XML, prefer structured XML injection
 * - GPT models: strong JSON parsing, prefer JSON-formatted data
 * - Other models: may benefit from markdown readability for better context
 *
 * The provider pattern allows selecting the appropriate renderer at runtime based on:
 * - Model preference (configured in modelRenderers)
 * - Global default (promptRenderer)
 * - Model detection via client.session.message()
 *
 * This abstraction decouples rendering format from tool execution logic,
 * enabling easy format additions without changing plugin code.
 */

export interface PromptRenderer {
  /**
   * Render an object to a string using the preferred format
   *
   * @param data The object to render (typically skill metadata or search results)
   * @param rootElement Optional element name (used for XML rendering as root tag)
   * @returns Formatted string ready for prompt injection
   */
  render(data: object, rootElement?: string): string;

  /**
   * The format identifier for this renderer
   * Used for logging, debugging, and format selection
   */
  readonly format: 'json' | 'xml' | 'md';
}
