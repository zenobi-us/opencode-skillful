const SHELL_REGEX = /!`([^`]+)`/g;
import { $ } from 'bun';

export function createShellExecutor(template: string): () => Promise<string> {
  const getCmds = () => {
    return Array.from(template.matchAll(SHELL_REGEX)).map((match) => match[1]);
  };

  const replace = (results: string[]) => {
    let index = 0;
    const output =
      results.length === 0 ? template : template.replace(SHELL_REGEX, () => results[index++]);

    return output.trim();
  };

  const execute = async (cmds: string[]) => {
    return Promise.all(
      cmds.map(async (cmd) => {
        try {
          return await $`${{ raw: cmd }}`.nothrow().text();
        } catch (error) {
          return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
        }
      })
    );
  };

  const processor = async () => {
    const cmds = getCmds();
    const results = await execute(cmds);
    template = replace(results);
    return template;
  };

  return processor;
}
