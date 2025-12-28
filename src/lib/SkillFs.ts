/**
 * SkillFs - Abstract filesystem access for skills
 *
 * This module encapsulates all filesystem operations related to skill discovery and loading.
 * It provides a mockable interface that works across different Node.js implementations,
 * enabling unit tests to stub filesystem operations without complex mocking libraries.
 *
 * Each function is designed as a pure export to be easily replaced in test environments
 * (e.g., via mocking FS access in test suites).
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import mime from 'mime';

export const readSkillFile = async (path: string): Promise<string> => {
  const file = Bun.file(path);
  return file.text();
};

/**
 * List all files in a skill subdirectory (e.g., scripts/, resources/)
 * Returns a flat array of absolute file paths
 *
 * @param skillPath - Base path to the skill directory
 * @param subdirectory - Subdirectory to scan (e.g., 'scripts', 'resources')
 * @returns Array of absolute file paths
 */
export const listSkillFiles = (skillPath: string, subdirectory: string): string[] => {
  // using cwd in the skillPath, because we should have already
  // confirmed it exists.
  const glob = new Bun.Glob(join(subdirectory, '**', '*'));
  return Array.from(glob.scanSync({ cwd: skillPath, absolute: true }));
};

export const findSkillPaths = async (basePath: string): Promise<string[]> => {
  const glob = new Bun.Glob('**/SKILL.md');
  const results: string[] = [];
  for await (const path of glob.scan({ cwd: basePath, absolute: true })) {
    results.push(path);
  }
  return results;
};

// purely so we can mock it in tests
export const doesPathExist = (path: string): boolean => {
  return existsSync(path);
};

/**
 * Detect MIME type from file extension
 * Used for skill resources to identify content type
 *
 * @param filePath - Path to the file
 * @returns MIME type string
 */
export const detectMimeType = (filePath: string): string => {
  return mime.getType(filePath) || 'application/octet-stream';
};
