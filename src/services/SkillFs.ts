import { join, resolve } from 'node:path';
import { stat } from 'node:fs/promises';

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
  // Prevent directory traversal attacks
  if (!resolve(skillPath, subdirectory).startsWith(skillPath)) {
    return [];
  }

  // using cwd in the skillPath, because we should have already
  // confirmed it exists.
  const glob = new Bun.Glob(join(subdirectory, '**', '*'));
  return Array.from(glob.scanSync({ cwd: skillPath, absolute: true }));
};

export const findSkillPaths = async (basePath: string): Promise<DiscoveredSkillPath[]> => {
  // if basePath does not exist, return empty array
  try {
    const stats = await stat(basePath);
    if (!stats.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const results: DiscoveredSkillPath[] = [];
  const glob = new Bun.Glob('**/SKILL.md');
  for await (const match of glob.scan({ cwd: basePath })) {
    results.push(createDiscoveredSkillPath(basePath, match));
  }

  return results;
};

export function createDiscoveredSkillPath(
  basePath: string,
  relativeSkillPath: string
): DiscoveredSkillPath {
  return {
    basePath,
    absolutePath: join(basePath, relativeSkillPath),
  };
}

export interface DiscoveredSkillPath {
  basePath: string;
  absolutePath: string;
}
