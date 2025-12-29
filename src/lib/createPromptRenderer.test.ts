/**
 * createPromptRenderer Factory Tests
 *
 * Test coverage:
 * - Correct renderer instantiation for each format
 * - Invalid format error handling
 * - Format identifier verification
 */

import { describe, it, expect } from 'vitest';
import { createPromptRenderer } from '../createPromptRenderer';
import { JsonPromptRenderer } from '../renderers/JsonPromptRenderer';
import { XmlPromptRenderer } from '../renderers/XmlPromptRenderer';
import { MdPromptRenderer } from '../renderers/MdPromptRenderer';

describe('createPromptRenderer', () => {
  it('should create JsonPromptRenderer for json format', () => {
    const renderer = createPromptRenderer('json');

    expect(renderer).toBeInstanceOf(JsonPromptRenderer);
    expect(renderer.format).toBe('json');
  });

  it('should create XmlPromptRenderer for xml format', () => {
    const renderer = createPromptRenderer('xml');

    expect(renderer).toBeInstanceOf(XmlPromptRenderer);
    expect(renderer.format).toBe('xml');
  });

  it('should create MdPromptRenderer for md format', () => {
    const renderer = createPromptRenderer('md');

    expect(renderer).toBeInstanceOf(MdPromptRenderer);
    expect(renderer.format).toBe('md');
  });

  it('should throw error for unknown format', () => {
    // Type assertion needed to test invalid input
    const invalidFormat = 'invalid' as 'json' | 'xml' | 'md';

    expect(() => createPromptRenderer(invalidFormat)).toThrow('Unknown prompt renderer format');
  });

  it('should have render method on all renderers', () => {
    const formats: Array<'json' | 'xml' | 'md'> = ['json', 'xml', 'md'];

    for (const format of formats) {
      const renderer = createPromptRenderer(format);
      expect(renderer.render).toBeDefined();
      expect(typeof renderer.render).toBe('function');
    }
  });

  it('should create new instance each time', () => {
    const renderer1 = createPromptRenderer('json');
    const renderer2 = createPromptRenderer('json');

    expect(renderer1).not.toBe(renderer2);
    expect(renderer1.format).toBe(renderer2.format);
  });
});
