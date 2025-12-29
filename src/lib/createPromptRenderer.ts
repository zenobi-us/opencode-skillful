/**
 * Prompt Renderer Factory
 *
 * WHY: Factory pattern centralizes renderer instantiation and makes it easy to:
 * - Add new renderer types in the future
 * - Test with different renderers
 * - Handle invalid formats gracefully
 */

import { createJsonPromptRenderer } from './renderers/JsonPromptRenderer';
import { createXmlPromptRenderer } from './renderers/XmlPromptRenderer';
import { createMdPromptRenderer } from './renderers/MdPromptRenderer';

/**
 * Create a prompt renderer for the specified format
 *
 * @param format The desired format: 'json' | 'xml' | 'md'
 * @returns A PromptRenderer instance for the specified format
 * @throws Error if format is not recognized
 */
export function createPromptRenderer() {
  const renderers = {
    json: createJsonPromptRenderer(),
    xml: createXmlPromptRenderer(),
    md: createMdPromptRenderer(),
  };

  const getFormatter = (format: 'json' | 'xml' | 'md') => {
    switch (format) {
      case 'json':
        return renderers.json.render;
      case 'xml':
        return renderers.xml.render;
      case 'md':
        return renderers.md.render;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  };

  return {
    getFormatter,
  };
}
