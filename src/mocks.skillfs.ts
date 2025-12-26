import { mock } from 'bun:test';
import { Volume } from 'memfs';
import { createDiscoveredSkillPath, DiscoveredSkillPath } from './services/SkillFs';

mock.module('./services/SkillFs.ts', async () => {
  const memdisk = Volume.fromJSON(
    {
      './test-skill/SKILL.md': '# Test Skill\nThis is a test skill.',
      './test-skill/reference/guide.md': '# Guide\nThis is a guide.',
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
    findSkillPaths: async (basePath: string) => {
      console.log(`[MOCK] skillfs.findSkillPaths`, basePath);
      const results: DiscoveredSkillPath[] = [];
      const globResult = await memdisk.promises.glob('**/SKILL.md', {
        cwd: basePath,
      });
      for (const relativePath of globResult) {
        results.push(createDiscoveredSkillPath(basePath, relativePath));
      }
      return results;
    },
    // Override other FS-dependent functions as needed
    listSkillFiles: async (skillPath: string, subdirectory: string) => {
      console.log(`[MOCK] skillfs.listSkillFiles`, skillPath, subdirectory);
      return memdisk.promises.glob('**/*', {
        cwd: `${skillPath}/${subdirectory}`,
      });
    },
    readSkillFile: (path: string) => {
      console.log(`[MOCK] skillfs.readSkillFile`, path);
      return readFile(path);
    },
    readSkillResource: (path: string) => {
      console.log(`[MOCK] skillfs.readSkillResource`, path);
      return readFile(path);
    },
  };
});

console.log('[MOCK] skillfs');
