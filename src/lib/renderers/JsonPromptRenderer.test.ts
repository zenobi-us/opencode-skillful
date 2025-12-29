/**
 * JsonPromptRenderer Tests
 *
 * Test coverage:
 * - Basic JSON output formatting
 * - Indentation and spacing
 * - Object and array handling
 * - Nested structures
 * - Special values (null, undefined, numbers, booleans)
 */

import { describe, it, expect } from 'vitest';
import { createJsonPromptRenderer } from './JsonPromptRenderer';

describe('JsonPromptRenderer', () => {
  const renderer = createJsonPromptRenderer();

  it('should have json format identifier', () => {
    expect(renderer.format).toBe('json');
  });

  it('should render simple object with proper indentation', () => {
    const data = { name: 'test', value: 42 };
    const result = renderer.render(data, 'Test');

    expect(result).toContain('"name": "test"');
    expect(result).toContain('"value": 42');
    expect(result).toContain('  '); // Check for indentation
  });

  it('should render nested objects', () => {
    const data = {
      user: {
        name: 'Alice',
        profile: {
          age: 30,
        },
      },
    };
    const result = renderer.render(data, 'User');

    expect(result).toContain('"user"');
    expect(result).toContain('"profile"');
    expect(result).toContain('"age": 30');
  });

  it('should render arrays', () => {
    const data = {
      items: ['apple', 'banana', 'cherry'],
    };
    const result = renderer.render(data, 'Items');

    expect(result).toContain('"apple"');
    expect(result).toContain('"banana"');
    expect(result).toContain('"cherry"');
  });

  it('should handle null and undefined values', () => {
    const data = {
      name: 'test',
      value: null,
      optional: undefined,
    };
    const result = renderer.render(data, 'Test');

    expect(result).toContain('"name": "test"');
  });

  it('should handle boolean values', () => {
    const data = {
      active: true,
      archived: false,
    };
    const result = renderer.render(data, 'Flags');

    expect(result).toContain('true');
    expect(result).toContain('false');
  });

  it('should handle numeric values', () => {
    const data = {
      count: 42,
      ratio: 3.14,
      negative: -10,
    };
    const result = renderer.render(data, 'Numbers');

    expect(result).toContain('42');
    expect(result).toContain('3.14');
    expect(result).toContain('-10');
  });

  it('should wrap output in root element', () => {
    const data = { name: 'test' };
    const result = renderer.render(data, 'Skill');

    expect(result).toContain('"Skill"');
  });

  it('should use default root element', () => {
    const data = { name: 'test' };
    const result = renderer.render(data);

    expect(result).toContain('"root"');
  });

  it('should properly format for readability', () => {
    const data = {
      name: 'example',
      items: [1, 2, 3],
    };
    const result = renderer.render(data, 'Example');

    // Check that output is properly formatted (has newlines and indentation)
    expect(result).toMatch(/\n/);
    expect(result).toMatch(/[ ]{2}/);
  });
});
