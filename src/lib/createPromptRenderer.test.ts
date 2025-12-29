/**
 * createPromptRenderer Factory Tests
 *
 * Test coverage:
 * - Correct renderer instantiation for each format
 * - Invalid format error handling
 * - Format identifier verification
 */

import { describe, it, expect } from 'vitest';
import { createPromptRenderer } from './createPromptRenderer';

describe('createPromptRenderer', () => {
  it('should return an object with getFormatter method', () => {
    const promptRenderer = createPromptRenderer();

    expect(promptRenderer).toBeDefined();
    expect(promptRenderer.getFormatter).toBeDefined();
    expect(typeof promptRenderer.getFormatter).toBe('function');
  });

  it('should return a formatter function for json format', () => {
    const promptRenderer = createPromptRenderer();
    const formatter = promptRenderer.getFormatter('json');

    expect(formatter).toBeDefined();
    expect(typeof formatter).toBe('function');
  });

  it('should return a formatter function for xml format', () => {
    const promptRenderer = createPromptRenderer();
    const formatter = promptRenderer.getFormatter('xml');

    expect(formatter).toBeDefined();
    expect(typeof formatter).toBe('function');
  });

  it('should return a formatter function for md format', () => {
    const promptRenderer = createPromptRenderer();
    const formatter = promptRenderer.getFormatter('md');

    expect(formatter).toBeDefined();
    expect(typeof formatter).toBe('function');
  });

  it('should throw error for unknown format', () => {
    const promptRenderer = createPromptRenderer();
    // Type assertion needed to test invalid input
    const invalidFormat = 'invalid' as 'json' | 'xml' | 'md';

    expect(() => promptRenderer.getFormatter(invalidFormat)).toThrow();
  });

  it('should create formatters for all supported formats', () => {
    const promptRenderer = createPromptRenderer();
    const formats: Array<'json' | 'xml' | 'md'> = ['json', 'xml', 'md'];

    for (const format of formats) {
      const formatter = promptRenderer.getFormatter(format);
      expect(formatter).toBeDefined();
      expect(typeof formatter).toBe('function');
    }
  });

  it('should return consistent formatter instances', () => {
    const promptRenderer = createPromptRenderer();
    const formatter1 = promptRenderer.getFormatter('json');
    const formatter2 = promptRenderer.getFormatter('json');

    expect(formatter1).toBe(formatter2);
  });
});
