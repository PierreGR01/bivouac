/**
 * Logger conditionnel - logs uniquement en développement
 */

const isDev = import.meta.env.DEV;

export const devLog = {
  log: (...args: any[]) => isDev && console.log(...args),
  warn: (...args: any[]) => isDev && console.warn(...args),
  error: (...args: any[]) => isDev && console.error(...args),
  info: (...args: any[]) => isDev && console.info(...args),
};
