import { PluginConfig, PluginLogger } from '../types';

const namespace = '[OpencodeSkillful]';

export function createLogger(config: PluginConfig): PluginLogger {
  const log = (type: 'log' | 'debug' | 'error' | 'warn', ...message: unknown[]): void => {
    const timestamp = new Date().toISOString();
    console[type](`${namespace}[${type}] ${timestamp} - `, ...message);
  };

  return {
    debug(...message: unknown[]): void {
      if (!config.debug) return;
      log('debug', ...message);
    },
    log(...message: unknown[]): void {
      log('log', ...message);
    },
    error(...message: unknown[]): void {
      log('error', ...message);
    },
    warn(...message: unknown[]): void {
      log('warn', ...message);
    },
  };
}
