import { describe, it, expect, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  expandTildePath,
  getOpenCodeConfigPaths,
  normalizeBasePaths,
  resolveBasePath,
} from './config';

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

describe('resolveBasePath', () => {
  const projectDirectory = '/workspace/project';

  it('resolves relative paths from project directory', () => {
    const result = resolveBasePath('.opencode/skills', projectDirectory);
    expect(result).toBe('/workspace/project/.opencode/skills');
  });

  it('keeps absolute paths absolute', () => {
    const absolutePath = '/custom/skills';
    const result = resolveBasePath(absolutePath, projectDirectory);
    expect(result).toBe(absolutePath);
  });

  it('expands tilde paths before resolving', () => {
    const result = resolveBasePath('~/skills', projectDirectory);
    expect(result).toBe(join(homedir(), 'skills'));
  });

  it('returns empty string for blank values', () => {
    const result = resolveBasePath('   ', projectDirectory);
    expect(result).toBe('');
  });
});

describe('normalizeBasePaths', () => {
  const projectDirectory = '/workspace/project';

  it('resolves relative paths against project directory', () => {
    const result = normalizeBasePaths(['.opencode/skills'], projectDirectory);
    expect(result).toEqual(['/workspace/project/.opencode/skills']);
  });

  it('drops empty entries', () => {
    const result = normalizeBasePaths(['', '   ', '.opencode/skills'], projectDirectory);
    expect(result).toEqual(['/workspace/project/.opencode/skills']);
  });

  it('deduplicates semantically equivalent paths while preserving order', () => {
    const result = normalizeBasePaths(
      ['.opencode/skills', '/workspace/project/.opencode/skills', '.opencode/skills/'],
      projectDirectory
    );

    expect(result).toEqual(['/workspace/project/.opencode/skills']);
  });

  it('deduplicates Windows paths case-insensitively on Windows', () => {
    if (process.platform !== 'win32') {
      return;
    }

    const result = normalizeBasePaths(['C:\\Skills', 'c:\\skills'], 'C:\\workspace');

    expect(result).toHaveLength(1);
    expect(result[0]?.toLowerCase()).toBe('c:\\skills');
  });
});

describe('getOpenCodeConfigPaths', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    process.env.XDG_CONFIG_HOME = originalEnv.XDG_CONFIG_HOME;
    process.env.LOCALAPPDATA = originalEnv.LOCALAPPDATA;
  });

  describe('path structure', () => {
    it('returns an array of paths', () => {
      const paths = getOpenCodeConfigPaths();
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('all paths end with "opencode"', () => {
      const paths = getOpenCodeConfigPaths();
      for (const path of paths) {
        expect(path.endsWith('opencode')).toBe(true);
      }
    });

    it('includes ~/.config/opencode path', () => {
      const paths = getOpenCodeConfigPaths();
      const xdgStylePath = join(homedir(), '.config', 'opencode');
      expect(paths).toContain(xdgStylePath);
    });

    it('includes ~/.opencode path', () => {
      const paths = getOpenCodeConfigPaths();
      const dotfilePath = join(homedir(), '.opencode');
      expect(paths).toContain(dotfilePath);
    });

    it('~/.opencode has higher priority than ~/.config/opencode', () => {
      const paths = getOpenCodeConfigPaths();
      const xdgStylePath = join(homedir(), '.config', 'opencode');
      const dotfilePath = join(homedir(), '.opencode');

      const xdgIndex = paths.indexOf(xdgStylePath);
      const dotfileIndex = paths.indexOf(dotfilePath);

      // Higher index = higher priority (last wins)
      expect(dotfileIndex).toBeGreaterThan(xdgIndex);
    });
  });

  describe('XDG_CONFIG_HOME support', () => {
    it('uses XDG_CONFIG_HOME when set', () => {
      const customPath = '/custom/xdg/config';
      process.env.XDG_CONFIG_HOME = customPath;

      // Function reads env at call time, so this works
      const paths = getOpenCodeConfigPaths();

      expect(paths).toContain(join(customPath, 'opencode'));
    });
  });

  describe('does not use env-paths Windows conventions', () => {
    it('does not include paths with "Config" segment (env-paths Windows style)', () => {
      const paths = getOpenCodeConfigPaths();
      for (const path of paths) {
        // env-paths on Windows produces %APPDATA%\opencode\Config
        // We should NOT have this pattern
        expect(path).not.toMatch(/[/\\]Config$/);
        expect(path).not.toMatch(/[/\\]Config[/\\]/);
      }
    });
  });
});
