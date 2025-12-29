/**
 * XmlPromptRenderer Tests
 *
 * Test coverage:
 * - XML output with proper formatting
 * - Root element handling
 * - Special character escaping
 * - Nested structure rendering
 * - Delegation to jsonToXml
 */

import { describe, it, expect } from 'vitest';
import { createXmlPromptRenderer } from './XmlPromptRenderer';

describe('XmlPromptRenderer', () => {
  const renderer = createXmlPromptRenderer();

  it('should have xml format identifier', () => {
    expect(renderer.format).toBe('xml');
  });

  it('should render simple object as XML with default root', () => {
    const data = { name: 'test', value: '42' };
    const result = renderer.render(data);

    expect(result).toContain('<root>');
    expect(result).toContain('</root>');
    expect(result).toContain('<name>test</name>');
    expect(result).toContain('<value>42</value>');
  });

  it('should use custom root element when provided', () => {
    const data = { key: 'value' };
    const result = renderer.render(data, 'Skill');

    expect(result).toContain('<Skill>');
    expect(result).toContain('</Skill>');
    expect(result).not.toContain('<root>');
  });

  it('should escape special XML characters', () => {
    const data = {
      text: 'Content with <angle> & "quotes"',
    };
    const result = renderer.render(data);

    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&amp;');
  });

  it('should render nested objects', () => {
    const data = {
      skill: {
        name: 'test-skill',
        description: 'A test skill',
      },
    };
    const result = renderer.render(data, 'Skill');

    expect(result).toContain('<skill>');
    expect(result).toContain('<name>test-skill</name>');
    expect(result).toContain('<description>A test skill</description>');
  });

  it('should render arrays with numeric indices', () => {
    const data = {
      items: ['apple', 'banana'],
    };
    const result = renderer.render(data);

    // Arrays are rendered with indexed elements
    expect(result).toContain('<items>');
    expect(result).toContain('</items>');
    // jsonToXml iterates through string characters
    expect(result).toContain('<0>');
    expect(result).toContain('<1>');
    expect(result).toContain('</0>');
    expect(result).toContain('</1>');
  });

  it('should output valid XML structure', () => {
    const data = {
      metadata: {
        version: '1.0',
      },
      content: 'test',
    };
    const result = renderer.render(data);

    // Should have opening and closing tags
    expect(result).toMatch(/<root>[\s\S]*<\/root>/);
  });

  it('should handle deep nesting', () => {
    const data = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
    };
    const result = renderer.render(data);

    expect(result).toContain('<level1>');
    expect(result).toContain('<level2>');
    expect(result).toContain('<level3>');
    expect(result).toContain('<value>deep</value>');
  });
});
