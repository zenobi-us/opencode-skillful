/**
 * MdPromptRenderer - Format objects as human-readable Markdown
 *
 * WHY: Markdown provides human-readable formatting that works well for:
 * - Models that benefit from visual structure and readability
 * - Debugging and development (easier to read in logs)
 * - Accessibility and presentation
 *
 * STRUCTURE:
 * - Top-level keys → H3 headings (### key)
 * - Nested objects → H4 headings (#### key) with increased indentation
 * - Leaf nodes → nested bullet list items with emphasis: - **key**: *value*
 * - Arrays → nested bullets under parent key
 * - Special characters → HTML-escaped (&lt;, &gt;, &amp;)
 * - Skill content → appended after --- separator with ### Content heading
 */

import type { PromptRenderer } from '../PromptRenderer';

export class MdPromptRenderer implements PromptRenderer {
  readonly format = 'md' as const;

  render(data: object): string {
    const lines: string[] = [];

    // Separate out the 'content' field if it exists (for skills)
    const { content, ...restData } = data as Record<string, unknown> & {
      content?: string;
    };

    // Render the metadata section
    this.renderObject(restData, 3, lines);

    // Append skill content if it exists
    if (content && typeof content === 'string') {
      lines.push('', '---', '', '### Content', '');
      lines.push(content);
    }

    return lines.join('\n');
  }

  /**
   * Recursively render an object with proper heading levels and list nesting
   *
   * @param obj The object to render
   * @param headingLevel The heading level for this object's keys (3 = H3, 4 = H4, etc)
   * @param lines Array to accumulate output lines
   * @param indentLevel Current indentation level for list items
   */
  private renderObject(
    obj: Record<string, unknown>,
    headingLevel: number,
    lines: string[],
    indentLevel: number = 0
  ): void {
    const entries = Object.entries(obj);

    for (const [key, value] of entries) {
      // Add heading for this key
      const heading = '#'.repeat(headingLevel);
      lines.push(`${heading} ${key}`);

      if (value === null || value === undefined) {
        // Skip null/undefined values
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - recurse with increased heading level
        this.renderObject(
          value as Record<string, unknown>,
          Math.min(headingLevel + 1, 6),
          lines,
          indentLevel
        );
      } else if (Array.isArray(value)) {
        // Array - render as nested list items
        this.renderArray(value, lines, indentLevel);
      } else {
        // Leaf node - render as list item
        const indent = '  '.repeat(indentLevel);
        const escapedValue = this.htmlEscape(String(value));
        lines.push(`${indent}- **${key}**: *${escapedValue}*`);
      }

      lines.push(''); // Add spacing between items
    }
  }

  /**
   * Render an array as nested list items
   *
   * @param arr The array to render
   * @param lines Array to accumulate output lines
   * @param indentLevel Current indentation level
   */
  private renderArray(arr: unknown[], lines: string[], indentLevel: number): void {
    const indent = '  '.repeat(indentLevel);

    for (const item of arr) {
      if (item === null || item === undefined) {
        continue;
      }

      if (typeof item === 'object' && !Array.isArray(item)) {
        // Nested object in array
        const nestedObj = item as Record<string, unknown>;
        for (const [key, value] of Object.entries(nestedObj)) {
          const escapedValue = this.htmlEscape(String(value));
          lines.push(`${indent}- **${key}**: *${escapedValue}*`);
        }
      } else if (Array.isArray(item)) {
        // Nested array - recurse
        this.renderArray(item, lines, indentLevel + 1);
      } else {
        // Simple value
        const escapedValue = this.htmlEscape(String(item));
        lines.push(`${indent}- *${escapedValue}*`);
      }
    }
  }

  /**
   * HTML-escape special characters in values
   * Prevents XML/HTML injection and ensures proper rendering
   *
   * @param value The value to escape
   * @returns The escaped value
   */
  private htmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
