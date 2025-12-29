/**
 * JsonPromptRenderer - Format objects as JSON
 *
 * WHY: Some LLM models (especially GPT family) have strong JSON parsing
 * and prefer structured JSON data over XML for reliability and clarity.
 */

import type { PromptRenderer } from '../PromptRenderer';

export const createJsonPromptRenderer = (): PromptRenderer => {
  const format = 'json' as const;
  const render = (data: object, rootElement = 'root'): string => {
    return JSON.stringify({ [rootElement]: data }, null, 2);
  };

  return {
    format,
    render,
  };
};
