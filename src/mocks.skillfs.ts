import { mock } from 'bun:test';
import { Volume } from 'memfs';
import path from 'node:path';

mock.module('./lib/SkillFs.ts', async () => {
  const memdisk = Volume.fromJSON(
    {
      './test-skill/SKILL.md': `---
name: test_skill
description: Use this skill to test the mock file system during development.
---
#Test Skill
This is a test skill.
`,
      './test-skill/references/guide.md': '# Guide\nThis is a guide.',
      './test-skill/scripts/build.sh': '#!/bin/bash\necho "Building..."',
      './test-skill/assets/logo.svg': '<svg></svg>',
    },
    '/skills'
  );

  const readFile = async (path: string) => {
    const data = await memdisk.promises.readFile(path, { encoding: 'utf-8' });
    return data.toString();
  };

  return {
    // Override file system calls to use memfs
    doesPathExist: (path: string): boolean => {
      console.log(`[MOCK] skillfs.doesPathExist`, path);
      return memdisk.existsSync(path);
    },

    /**
     * Find skill paths by searching for SKILL.md files
     * @param basePath Base directory to search
     * @returns Array of discovered skill paths
     *
     * @see {@link createDiscoveredSkillPath}
     * @see {@link SkillFs}
     */
    findSkillPaths: async (basePath: string) => {
      console.log(`[MOCK] skillfs.findSkillPaths`, basePath);
      const results = await memdisk.promises.glob('**/SKILL.md', {
        cwd: basePath,
      });

      console.log(`[MOCK] skillfs.findSkillPaths results:`, results);
      return results.map((relativePath) => path.join(basePath, relativePath));
    },
    // Override other FS-dependent functions as needed
    /**
     * List skill files in a given subdirectory
     * @param skillPath Path to the skill directory
     * @param subdirectory Subdirectory to list files from
     * @returns Array of file paths
     *
     * @see {@link SkillFs}
     */
    listSkillFiles: (skillPath: string, subdirectory: string): string[] => {
      console.log(`[MOCK] skillfs.listSkillFiles`, skillPath, subdirectory);
      const results = memdisk.globSync('**/*', {
        cwd: `${skillPath}/${subdirectory}`,
      });

      return results.map((relativePath) => path.join(skillPath, subdirectory, relativePath));
    },

    /**
     * Read the content of a skill file
     * @param path Full path to the skill file
     * @returns File content as string
     *
     * @see {@link SkillFs}
     */
    readSkillFile: (path: string) => {
      console.log(`[MOCK] skillfs.readSkillFile`, path);
      return readFile(path);
    },

    /**
     * Read a skill resource file
     * @param path Full path to the resource file
     * @returns File content as string
     *
     * @see {@link SkillFs}
     */
    readSkillResource: (path: string) => {
      console.log(`[MOCK] skillfs.readSkillResource`, path);
      return readFile(path);
    },

    /**
     * Detect MIME type from file extension
     * @param filePath Path to the file
     * @returns MIME type string
     */
    detectMimeType: (filePath: string): string => {
      const ext = filePath.toLowerCase().split('.').pop() || '';

      const mimeTypes: Record<string, string> = {
        sh: 'application/x-sh',
        bash: 'application/x-sh',
        zsh: 'application/x-sh',
        py: 'text/x-python',
        js: 'application/javascript',
        ts: 'application/typescript',
        node: 'application/javascript',
        md: 'text/markdown',
        txt: 'text/plain',
        pdf: 'application/pdf',
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        json: 'application/json',
        yaml: 'application/yaml',
        yml: 'application/yaml',
        xml: 'application/xml',
        csv: 'text/csv',
        html: 'text/html',
        css: 'text/css',
      };

      return mimeTypes[ext] || 'application/octet-stream';
    },
  };
});

console.log('[MOCK] skillfs.mock.ready');
