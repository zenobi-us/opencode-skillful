/**
 * JsonPromptRenderer - Format objects as JSON
 *
 * WHY: Some LLM models (especially GPT family) have strong JSON parsing
 * and prefer structured JSON data over XML for reliability and clarity.
 */

import type { PromptRenderer } from '../PromptRenderer';

export class JsonPromptRenderer implements PromptRenderer {
  readonly format = 'json' as const;

  render(data: object): string {
    return JSON.stringify(data, null, 2);
  }
}
