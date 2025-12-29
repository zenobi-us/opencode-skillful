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
import { createMdPromptRenderer } from './MdPromptRenderer';

type TestData = Record<string, unknown>;

describe('MdPromptRenderer', () => {
  const renderer = createMdPromptRenderer();

  it('should have md format identifier', () => {
    expect(renderer.format).toBe('md');
  });

  it('should render simple object with H1 title and H3 headings', () => {
    const data: TestData = { name: 'test', value: '42', content: 'Some content' };
    const result = renderer.render(data, 'Example');

    expect(result).toContain('# Example');
    expect(result).toContain('### name');
    expect(result).toContain('### value');
    expect(result).toContain('- **name**: *test*');
    expect(result).toContain('- **value**: *42*');
  });

  it('should use H4 for nested objects', () => {
    const data: TestData = {
      metadata: {
        version: '1.0',
      },
      content: '',
    };
    const result = renderer.render(data, 'Test');

    expect(result).toContain('### metadata');
    expect(result).toContain('#### version');
    expect(result).toContain('- **version**: *1.0*');
  });

  it('should render arrays as nested bullets', () => {
    const data: TestData = {
      tags: ['important', 'urgent', 'review'],
      content: '',
    };
    const result = renderer.render(data, 'Tags');

    expect(result).toContain('### tags');
    expect(result).toContain('- *important*');
    expect(result).toContain('- *urgent*');
    expect(result).toContain('- *review*');
  });

  it('should HTML-escape special characters in values', () => {
    const data: TestData = {
      html: '<script>alert("xss")</script>',
      ampersand: 'A & B',
      quotes: 'He said "hello"',
      content: '',
    };
    const result = renderer.render(data, 'Escaped');

    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;');
  });

  it('should skip null and undefined values', () => {
    const data: TestData = {
      name: 'test',
      value: null,
      optional: undefined,
      content: '',
    };
    const result = renderer.render(data, 'Test');

    expect(result).toContain('- **name**: *test*');
    expect(result).not.toContain('### value');
    expect(result).not.toContain('### optional');
  });

  it('should append skill content after separator', () => {
    const data: TestData = {
      name: 'git-commits',
      description: 'Guidelines for git commits',
      content: 'Use imperative mood...\nWrite clear messages...',
    };
    const result = renderer.render(data, 'Skill');

    expect(result).toContain('---');
    expect(result).toContain('### Content');
    expect(result).toContain('Use imperative mood');
    expect(result).toContain('Write clear messages');
  });

  it('should handle mixed nested and array data', () => {
    const data: TestData = {
      user: {
        name: 'Alice',
        roles: ['admin', 'reviewer'],
      },
      content: '',
    };
    const result = renderer.render(data, 'User');

    expect(result).toContain('### user');
    expect(result).toContain('#### name');
    expect(result).toContain('#### roles');
    expect(result).toContain('- *admin*');
    expect(result).toContain('- *reviewer*');
  });

  it('should handle deeply nested objects', () => {
    const data: TestData = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
      content: '',
    };
    const result = renderer.render(data, 'Nested');

    expect(result).toContain('### level1');
    expect(result).toContain('#### level2');
    expect(result).toContain('- **value**: *deep*');
  });
});
