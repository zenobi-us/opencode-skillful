import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

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
export const listSkillFiles = async (
  skillPath: string,
  subdirectory: string
): Promise<string[]> => {
  const targetPath = join(skillPath, subdirectory);

  const stat = await lstat(targetPath).catch(() => null);
  if (!stat?.isDirectory()) {
    return [];
  }

  const glob = new Bun.Glob('**/*');
  const results: string[] = [];

  for await (const match of glob.scan({ cwd: targetPath, absolute: true })) {
    const fileStat = await lstat(match).catch(() => null);
    if (fileStat?.isFile()) {
      results.push(match);
    }
  }

  return results;
};

export const findSkillPaths = async (basePath: string): Promise<DiscoveredSkillPath[]> => {
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
