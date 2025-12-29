/* eslint-disable no-console */
import { LogType, PluginConfig, PluginLogger } from '../types';

const namespace = '[OpencodeSkillful]';

export function createLogger(config: PluginConfig): PluginLogger {
  function log(type: LogType, ...message: unknown[]): unknown[] {
    const timestamp = new Date().toISOString();
    return [`${namespace}[${type}] ${timestamp} - `, ...message];
  }

  return {
    debug(...message: unknown[]): void {
      if (!config.debug) return;
      console.debug(...log('debug', ...message));
    },
    log(...message: unknown[]): void {
      console.log(...log('log', ...message));
    },
    error(...message: unknown[]): void {
      console.error(...log('error', ...message));
    },
    warn(...message: unknown[]): void {
      console.warn(...log('warn', ...message));
    },
  };
}
