import { describe, it, expect } from 'vitest';
import { expandTildePath } from './config';
import { homedir } from 'node:os';
import { join } from 'node:path';

describe('expandTildePath', () => {
  describe('tilde expansion', () => {
    it('expands bare ~ to home directory', () => {
      const result = expandTildePath('~');
      expect(result).toBe(homedir());
    });

    it('expands ~/path to homedir/path', () => {
      const result = expandTildePath('~/some/path');
      expect(result).toBe(join(homedir(), 'some/path'));
    });

    it('expands ~/deeply/nested/path correctly', () => {
      const result = expandTildePath('~/deeply/nested/path/to/skills');
      expect(result).toBe(join(homedir(), 'deeply/nested/path/to/skills'));
    });

    it('expands ~/ (trailing slash only) to home directory', () => {
      const result = expandTildePath('~/');
      expect(result).toBe(join(homedir(), ''));
    });
  });

  describe('paths that should not be expanded', () => {
    it('leaves absolute paths unchanged', () => {
      const absolutePath = '/usr/local/share/skills';
      const result = expandTildePath(absolutePath);
      expect(result).toBe(absolutePath);
    });

    it('leaves relative paths unchanged', () => {
      const relativePath = './local/skills';
      const result = expandTildePath(relativePath);
      expect(result).toBe(relativePath);
    });

    it('leaves paths without tilde unchanged', () => {
      const normalPath = 'some/relative/path';
      const result = expandTildePath(normalPath);
      expect(result).toBe(normalPath);
    });

    it('does not expand ~ in the middle of a path', () => {
      const pathWithTilde = '/some/path/~/weird';
      const result = expandTildePath(pathWithTilde);
      expect(result).toBe(pathWithTilde);
    });

    it('does not expand ~username paths (not supported)', () => {
      const userPath = '~otheruser/path';
      const result = expandTildePath(userPath);
      expect(result).toBe(userPath);
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = expandTildePath('');
      expect(result).toBe('');
    });

    it('handles Windows-style paths unchanged', () => {
      const windowsPath = 'C:\\Users\\test\\skills';
      const result = expandTildePath(windowsPath);
      expect(result).toBe(windowsPath);
    });
  });
});
