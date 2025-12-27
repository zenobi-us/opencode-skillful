import { join } from 'node:path';
import { existsSync } from 'node:fs';

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
  for await (const path of glob.scan({ cwd: basePath })) {
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
  const ext = filePath.toLowerCase().split('.').pop() || '';

  const mimeTypes: Record<string, string> = {
    // Scripts
    sh: 'application/x-sh',
    bash: 'application/x-sh',
    zsh: 'application/x-sh',
    py: 'text/x-python',
    js: 'application/javascript',
    ts: 'application/typescript',
    node: 'application/javascript',
    // Documents
    md: 'text/markdown',
    txt: 'text/plain',
    pdf: 'application/pdf',
    // Images
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    // Data
    json: 'application/json',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    xml: 'application/xml',
    csv: 'text/csv',
    // Code
    html: 'text/html',
    css: 'text/css',
    // Default
  };

  return mimeTypes[ext] || 'application/octet-stream';
};
