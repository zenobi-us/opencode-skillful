import { PluginConfig, PluginLogger } from '../types';

const namespace = '[OpencodeSkillful]';

function internalLog(type: 'log' | 'debug' | 'error' | 'warn', ...message: unknown[]): void {
  const timestamp = new Date().toISOString();
  console[type](`${namespace}[${type}] ${timestamp} - `, ...message);
}

export function log(type: 'log' | 'debug' | 'error' | 'warn', ...message: unknown[]): void {
  internalLog(type, ...message);
}

export function createLogger(config: PluginConfig): PluginLogger {
  return {
    debug(...message: unknown[]): void {
      if (!config.debug) return;
      internalLog('debug', ...message);
    },
    log(...message: unknown[]): void {
      internalLog('log', ...message);
    },
    error(...message: unknown[]): void {
      internalLog('error', ...message);
    },
    warn(...message: unknown[]): void {
      internalLog('warn', ...message);
    },
  };
}
