/**
 * Logger conditionnel - logs uniquement en développement
 */

const isDev = import.meta.env.DEV;

export const devLog = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => isDev && console.error(...args),
  info: (...args: unknown[]) => isDev && console.info(...args),
};
