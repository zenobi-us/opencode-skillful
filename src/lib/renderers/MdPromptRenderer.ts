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

export const createMdPromptRenderer = (): PromptRenderer => {
  const format = 'md' as const;

  /**
   * Recursively render an object with proper heading levels and list nesting
   *
   * @param obj The object to render
   * @param headingLevel The heading level for this object's keys (3 = H3, 4 = H4, etc)
   * @param indentLevel Current indentation level for list items
   */
  const renderObject = (
    obj: Record<string, unknown>,
    headingLevel: number,
    indentLevel: number = 0
  ): string => {
    const entries = Object.entries(obj);
    let output = '';

    for (const [key, value] of entries) {
      if (value === null || value === undefined) {
        // Skip null/undefined values
        continue;
      }

      // Add heading for this key
      const heading = '#'.repeat(headingLevel);
      output += `${heading} ${key}`;

      if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - recurse with increased heading level
        output += renderObject(
          value as Record<string, unknown>,
          Math.min(headingLevel + 1, 6),
          indentLevel
        );
      } else if (Array.isArray(value)) {
        // Array - render as nested list items
        output += renderArray(value, indentLevel);
      } else {
        // Leaf node - render as list item
        const indent = '  '.repeat(indentLevel);
        const escapedValue = htmlEscape(String(value));
        output += `${indent}- **${key}**: *${escapedValue}*`;
      }

      output += '\n'; // Add spacing between items
    }

    return output;
  };

  /**
   * Render an array as nested list items
   *
   * @param arr The array to render
   * @param indentLevel Current indentation level
   */
  const renderArray = (arr: unknown[], indentLevel: number): string => {
    const indent = '  '.repeat(indentLevel);
    let output = '';

    for (const item of arr) {
      if (item === null || item === undefined) {
        continue;
      }

      if (typeof item === 'object' && !Array.isArray(item)) {
        // Nested object in array
        const nestedObj = item as Record<string, unknown>;
        for (const [key, value] of Object.entries(nestedObj)) {
          if (value === null || value === undefined) {
            continue;
          }

          if (typeof value === 'object') {
            if (Array.isArray(value)) {
              // Nested array inside object in array
              output += `${indent}- **${key}**:\n`;
              output += renderArray(value, indentLevel + 1);
            } else {
              // Nested object inside object in array
              output += `${indent}- **${key}**\n`;
              output += renderObject(value as Record<string, unknown>, 4, indentLevel + 1);
            }
          } else {
            const escapedValue = htmlEscape(String(value));
            output += `${indent}- **${key}**: *${escapedValue}*\n`;
          }
        }
      } else if (Array.isArray(item)) {
        // Nested array - recurse
        output += renderArray(item, indentLevel + 1);
      } else {
        // Simple value
        const escapedValue = htmlEscape(String(item));
        output += `${indent}- *${escapedValue}*\n`;
      }
    }

    return output;
  };

  /**
   * HTML-escape special characters in values
   * Prevents XML/HTML injection and ensures proper rendering
   *
   * @param value The value to escape
   * @returns The escaped value
   */
  const htmlEscape = (value: string): string => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const render = <T extends { content?: string }>(
    data: T,
    rootElement: string = 'Prompt'
  ): string => {
    // Separate out the 'content' field if it exists (for skills)
    const { content, ...restData } = data;

    // Render the metadata section
    return `# ${rootElement}

${renderObject(restData, 3)}

${
  (content &&
    `---

### Content

${content}

`) ||
  ''
}
    `;
  };

  return {
    format,
    render,
  };
};
