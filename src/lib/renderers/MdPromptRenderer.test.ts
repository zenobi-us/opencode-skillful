/**
 * MdPromptRenderer Tests
 *
 * Test coverage:
 * - Heading generation (H3 for top-level, H4 for nested)
 * - List item rendering with emphasis
 * - Array handling as nested bullets
 * - HTML character escaping
 * - Nested object indentation
 * - Skill content appending with separator
 * - Special values handling
 */

import { describe, it, expect } from 'vitest';
import { MdPromptRenderer } from '../MdPromptRenderer';

describe('MdPromptRenderer', () => {
  const renderer = new MdPromptRenderer();

  it('should have md format identifier', () => {
    expect(renderer.format).toBe('md');
  });

  it('should render simple object with H3 headings', () => {
    const data = { name: 'test', value: '42' };
    const result = renderer.render(data);

    expect(result).toContain('### name');
    expect(result).toContain('### value');
    expect(result).toContain('- **name**: *test*');
    expect(result).toContain('- **value**: *42*');
  });

  it('should use H4 for nested objects', () => {
    const data = {
      metadata: {
        version: '1.0',
      },
    };
    const result = renderer.render(data);

    expect(result).toContain('### metadata');
    expect(result).toContain('#### version');
    expect(result).toContain('- **version**: *1.0*');
  });

  it('should render arrays as nested bullets', () => {
    const data = {
      tags: ['important', 'urgent', 'review'],
    };
    const result = renderer.render(data);

    expect(result).toContain('### tags');
    expect(result).toContain('- *important*');
    expect(result).toContain('- *urgent*');
    expect(result).toContain('- *review*');
  });

  it('should HTML-escape special characters in values', () => {
    const data = {
      text: 'Contains <tag> & "quotes"',
    };
    const result = renderer.render(data);

    expect(result).toContain('&lt;tag&gt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;');
  });

  it('should handle deeply nested objects with proper indentation', () => {
    const data = {
      level1: {
        level2: {
          deep: 'value',
        },
      },
    };
    const result = renderer.render(data);

    expect(result).toContain('### level1');
    expect(result).toContain('#### level2');
    expect(result).toContain('#### deep');
    // Check for increasing indentation in list items
    expect(result).toContain('- **deep**: *value*');
  });

  it('should skip null and undefined list items but show headings', () => {
    const data = {
      defined: 'value',
      nullValue: null,
      undefinedValue: undefined,
    };
    const result = renderer.render(data);

    expect(result).toContain('### defined');
    expect(result).toContain('- **defined**: *value*');
    // Headings are still shown for null/undefined keys, but not list items
    expect(result).toContain('### nullValue');
    expect(result).toContain('### undefinedValue');
    // But the null/undefined string literals should not appear as values
    const lines = result.split('\n');
    const valueLines = lines.filter((line) => line.match(/- \*\*/));
    expect(valueLines).toHaveLength(1);
    expect(valueLines[0]).toContain('defined');
  });

  it('should append skill content with separator', () => {
    const data = {
      name: 'test-skill',
      description: 'A test skill',
      content: '# Skill Guide\n\nThis is the skill documentation.',
    };
    const result = renderer.render(data);

    expect(result).toContain('### name');
    expect(result).toContain('### description');
    expect(result).toContain('---');
    expect(result).toContain('### Content');
    expect(result).toContain('# Skill Guide');
    expect(result).toContain('This is the skill documentation.');
  });

  it('should handle nested objects in arrays', () => {
    const data = {
      items: [
        { id: '1', title: 'First' },
        { id: '2', title: 'Second' },
      ],
    };
    const result = renderer.render(data);

    expect(result).toContain('### items');
    expect(result).toContain('- **id**: *1*');
    expect(result).toContain('- **title**: *First*');
    expect(result).toContain('- **id**: *2*');
    expect(result).toContain('- **title**: *Second*');
  });

  it('should handle empty arrays', () => {
    const data = {
      empty: [],
    };
    const result = renderer.render(data);

    expect(result).toContain('### empty');
    // Empty array should just have the heading
    expect(result.split('### empty')[1].split('###')[0]).toBeTruthy();
  });

  it('should handle arrays with primitive values', () => {
    const data = {
      numbers: [1, 2, 3],
    };
    const result = renderer.render(data);

    expect(result).toContain('### numbers');
    expect(result).toContain('- *1*');
    expect(result).toContain('- *2*');
    expect(result).toContain('- *3*');
  });

  it('should handle boolean values', () => {
    const data = {
      enabled: true,
      disabled: false,
    };
    const result = renderer.render(data);

    expect(result).toContain('- **enabled**: *true*');
    expect(result).toContain('- **disabled**: *false*');
  });

  it('should handle zero and empty string', () => {
    const data = {
      zero: 0,
      empty: '',
    };
    const result = renderer.render(data);

    expect(result).toContain('- **zero**: *0*');
    expect(result).toContain('- **empty**: **');
  });

  it('should properly space sections', () => {
    const data = {
      first: 'value1',
      second: 'value2',
    };
    const result = renderer.render(data);

    // Should have blank lines between sections
    expect(result).toContain('\n\n');
  });

  it('should render object with only content field', () => {
    const data = {
      content: '# Just Content\n\nNo metadata.',
    };
    const result = renderer.render(data);

    expect(result).toContain('### Content');
    expect(result).toContain('# Just Content');
    expect(result).toContain('No metadata.');
  });

  it('should handle mixed nested structures', () => {
    const data = {
      metadata: {
        name: 'skill',
        tags: ['tag1', 'tag2'],
      },
      config: {
        enabled: true,
      },
    };
    const result = renderer.render(data);

    expect(result).toContain('### metadata');
    expect(result).toContain('#### name');
    expect(result).toContain('#### tags');
    expect(result).toContain('- *tag1*');
    expect(result).toContain('### config');
    expect(result).toContain('#### enabled');
    expect(result).toContain('- **enabled**: *true*');
  });
});
