/**
 * XmlPromptRenderer - Format objects as XML (current default)
 *
 * WHY: Claude models are trained extensively on XML and prefer structured
 * XML injection for skill metadata and search results. This maintains the
 * current behavior as the default and recommended format for Claude models.
 */

import type { PromptRenderer } from '../PromptRenderer';
import { jsonToXml } from '../xml';

export class XmlPromptRenderer implements PromptRenderer {
  readonly format = 'xml' as const;

  render(data: object, rootElement: string = 'root'): string {
    return jsonToXml(data, rootElement);
  }
}
