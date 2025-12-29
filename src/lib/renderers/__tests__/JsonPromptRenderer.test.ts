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
import { JsonPromptRenderer } from '../JsonPromptRenderer';

describe('JsonPromptRenderer', () => {
  const renderer = new JsonPromptRenderer();

  it('should have json format identifier', () => {
    expect(renderer.format).toBe('json');
  });

  it('should render simple object with proper indentation', () => {
    const data = { name: 'test', value: 42 };
    const result = renderer.render(data);

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
    const result = renderer.render(data);

    expect(result).toContain('"user"');
    expect(result).toContain('"profile"');
    expect(result).toContain('"age": 30');
  });

  it('should render arrays', () => {
    const data = {
      items: ['apple', 'banana', 'cherry'],
    };
    const result = renderer.render(data);

    expect(result).toContain('"apple"');
    expect(result).toContain('"banana"');
    expect(result).toContain('"cherry"');
  });

  it('should handle null and undefined', () => {
    const data = {
      nullValue: null,
      undefinedValue: undefined,
      zeroValue: 0,
      emptyString: '',
    };
    const result = renderer.render(data);

    expect(result).toContain('null');
    expect(result).toContain('0');
    expect(result).toContain('""');
  });

  it('should handle booleans', () => {
    const data = {
      enabled: true,
      disabled: false,
    };
    const result = renderer.render(data);

    expect(result).toContain('true');
    expect(result).toContain('false');
  });

  it('should output valid JSON', () => {
    const data = {
      string: 'value',
      number: 123,
      boolean: true,
      array: [1, 2, 3],
      nested: { key: 'value' },
    };
    const result = renderer.render(data);

    // Should be parseable as valid JSON
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.string).toBe('value');
    expect(parsed.number).toBe(123);
    expect(parsed.boolean).toBe(true);
  });

  it('should format with proper 2-space indentation', () => {
    const data = { outer: { inner: 'value' } };
    const result = renderer.render(data);

    // Check for 2-space indentation pattern
    const lines = result.split('\n');
    const indentedLines = lines.filter((line) => line.startsWith('  '));
    expect(indentedLines.length).toBeGreaterThan(0);
  });
});
