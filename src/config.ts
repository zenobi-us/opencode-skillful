/**
 * Plugin Configuration - Skill Discovery and Prompt Rendering
 *
 * WHY: Skills can be stored in multiple places:
 * 1. User-global: ~/.config/opencode/skills/ (or platform equivalent)
 * 2. User-global (alt): ~/.opencode/skills/
 * 3. Project-local: ./project/.opencode/skills/
 *
 * This module resolves paths with proper priority so:
 * - Users can install global skills once, reuse across projects
 * - Projects can override/add skills locally without affecting other projects
 *
 * PATH PRIORITY (last wins):
 * 1. XDG config path: $XDG_CONFIG_HOME/opencode/skills/ (lowest)
 * 2. Home config path: ~/.config/opencode/skills/
 * 3. Home dotfile path: ~/.opencode/skills/
 * 4. Project-local path: ./.opencode/skills/ (highest)
 *
 * WINDOWS PATHS (matching OpenCode's conventions):
 * - $XDG_CONFIG_HOME/opencode/skills/ (if XDG set)
 * - $LOCALAPPDATA/opencode/skills/
 * - %USERPROFILE%/.config/opencode/skills/
 * - %USERPROFILE%/.opencode/skills/
 *
 * WHY NOT env-paths: The env-paths library uses Windows conventions
 * (%APPDATA%/<name>/Config) that don't match OpenCode's actual behavior.
 * OpenCode uses XDG-style paths on all platforms for consistency.
 *
 * @param ctx PluginInput from OpenCode runtime (provides working directory)
 * @returns Promise<PluginConfig> with resolved paths, debug flag, and renderer config
 */
import type { Config } from 'bunfig';
import { loadConfig } from 'bunfig';

import type { PluginInput } from '@opencode-ai/plugin';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve } from 'node:path';
import type { PluginConfig } from './types';

/**
 * Gets OpenCode-compatible config paths for the current platform.
 *
 * Matches OpenCode's path resolution logic from internal/config/config.go:
 * - Uses XDG_CONFIG_HOME if set
 * - Falls back to LOCALAPPDATA on Windows, ~/.config on Unix
 * - Also includes ~/.opencode/ as an alternative
 *
 * @returns Array of config directory paths in priority order (lowest to highest)
 */
export function getOpenCodeConfigPaths(): string[] {
  const home = homedir();
  const paths: string[] = [];

  // XDG_CONFIG_HOME takes precedence if set (all platforms)
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    paths.push(join(xdgConfig, 'opencode'));
  }

  if (process.platform === 'win32') {
    // Windows: LOCALAPPDATA fallback (matches OpenCode behavior)
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      paths.push(join(localAppData, 'opencode'));
    }
    // Also check %USERPROFILE%/.config/opencode (XDG-style on Windows)
    paths.push(join(home, '.config', 'opencode'));
  } else {
    // Unix: ~/.config/opencode
    paths.push(join(home, '.config', 'opencode'));
  }

  // All platforms: ~/.opencode/ as alternative
  paths.push(join(home, '.opencode'));

  return paths;
}

/**
 * Expands tilde (~) in a path to the user's home directory.
 *
 * WHY: When users configure paths in JSON config files, shell expansion
 * doesn't happen automatically. Paths like "~/my-skills" remain literal
 * strings, causing file operations to fail.
 *
 * HANDLES:
 * - "~" alone → home directory
 * - "~/path" → home directory + path
 * - Other paths → unchanged
 *
 * @param path - The path string to expand
 * @returns The expanded path with ~ resolved to home directory
 */
export function expandTildePath(path: string): string {
  if (path === '~') {
    return homedir();
  }
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

const createPathKey = (absolutePath: string): string => {
  const normalizedPath = normalize(absolutePath);
  if (process.platform === 'win32') {
    return normalizedPath.toLowerCase();
  }
  return normalizedPath;
};

/**
 * Resolve a configured base path to an absolute path.
 *
 * Resolution rules:
 * - "~" / "~/..." are expanded to the user home directory
 * - Absolute paths are preserved
 * - Relative paths are resolved from the project directory
 */
export function resolveBasePath(basePath: string, projectDirectory: string): string {
  const trimmedPath = basePath.trim();

  if (trimmedPath.length === 0) {
    return '';
  }

  const expandedPath = expandTildePath(trimmedPath);

  if (isAbsolute(expandedPath)) {
    return normalize(expandedPath);
  }

  return resolve(projectDirectory, expandedPath);
}

/**
 * Normalize configured base paths:
 * - Resolve to absolute paths
 * - Remove empty entries
 * - Remove duplicates while preserving priority order
 */
export function normalizeBasePaths(basePaths: string[], projectDirectory: string): string[] {
  const uniquePaths = new Set<string>();
  const normalizedPaths: string[] = [];

  for (const basePath of basePaths) {
    const normalizedPath = resolveBasePath(basePath, projectDirectory);

    if (!normalizedPath) {
      continue;
    }

    const key = createPathKey(normalizedPath);
    if (uniquePaths.has(key)) {
      continue;
    }

    uniquePaths.add(key);
    normalizedPaths.push(normalizedPath);
  }

  return normalizedPaths;
}

/**
 * Default skill base paths matching OpenCode's conventions.
 * Paths are in priority order (lowest to highest).
 */
const defaultSkillBasePaths = getOpenCodeConfigPaths().map((configPath) =>
  join(configPath, 'skills')
);

const options: Config<PluginConfig> = {
  name: 'opencode-skillful',
  cwd: './',
  defaultConfig: {
    debug: false,
    basePaths: defaultSkillBasePaths,
    promptRenderer: 'xml',
    modelRenderers: {},
  },
};

export async function getPluginConfig(ctx: PluginInput) {
  const resolvedConfig = await loadConfig(options);

  const configuredBasePaths = [
    ...resolvedConfig.basePaths,
    join(ctx.directory, '.opencode', 'skills'), // Highest priority: Project-local
  ];

  resolvedConfig.basePaths = normalizeBasePaths(configuredBasePaths, ctx.directory);

  return resolvedConfig;
}
