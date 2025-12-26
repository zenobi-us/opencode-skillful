import { join, resolve } from 'node:path';

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
  const targetPath = resolve(skillPath, subdirectory);
  if (!targetPath.startsWith(skillPath)) {
    // Prevent directory traversal attacks
    return [];
  }

  const glob = new Bun.Glob('**/*');
  return Array.from(glob.scanSync({ cwd: targetPath, absolute: true }));
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
