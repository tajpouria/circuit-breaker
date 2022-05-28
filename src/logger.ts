/**
 * Constructs a {@link Logger}.
 *
 * @class Logger
 * @param {String} module Module name
 * @param {Number} level Specifies the logging level:
 *  2: `debug`
 *  1: `error`
 * @default 1
 */
export class Logger {
  constructor(private module: string, private level: 1 | 2 = 1) {}

  /**
   * Log at debug level.
   * @param msg
   *
   */
  debug = (msg: string): void => {
    if (this.level >= 2) console.debug(`[${this.module}::debug] ${msg}`);
  };

  /**
   * Log at error level.
   * @param msg
   *
   */
  error = (msg: string) => {
    if (this.level >= 1) console.error(`[${this.module}::error]: ${msg}`);
  };
}
