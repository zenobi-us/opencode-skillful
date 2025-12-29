/**
 * Prompt Renderer Factory
 *
 * WHY: Factory pattern centralizes renderer instantiation and makes it easy to:
 * - Add new renderer types in the future
 * - Test with different renderers
 * - Handle invalid formats gracefully
 */

import type { PromptRenderer } from './PromptRenderer';
import { JsonPromptRenderer } from './renderers/JsonPromptRenderer';
import { XmlPromptRenderer } from './renderers/XmlPromptRenderer';
import { MdPromptRenderer } from './renderers/MdPromptRenderer';

/**
 * Create a prompt renderer for the specified format
 *
 * @param format The desired format: 'json' | 'xml' | 'md'
 * @returns A PromptRenderer instance for the specified format
 * @throws Error if format is not recognized
 */
export function createPromptRenderer(format: 'json' | 'xml' | 'md'): PromptRenderer {
  switch (format) {
    case 'json':
      return new JsonPromptRenderer();
    case 'xml':
      return new XmlPromptRenderer();
    case 'md':
      return new MdPromptRenderer();
    default: {
      const _exhaustive: never = format;
      throw new Error(
        `Unknown prompt renderer format: ${_exhaustive}. Expected 'json', 'xml', or 'md'.`
      );
    }
  }
}
