/*
 * @file         : Ux.ts
 * @summary      : terminal I/O utilities
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : cli-ux wrapper class for interacting with terminal I/O.
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 05 Jul 2021
 * @license:     : MIT
 *
 * Copyright 2021 Benjamin Maggi <benjaminmaggi@gmail.com>
 *
 *
 * License:
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/* eslint-disable no-console */

import { isArray, isBoolean } from '@salesforce/ts-types';
import * as chalk from 'chalk';
import { cli } from 'cli-ux';

export interface Column extends Record<string, unknown> {
  header: string;
  extended: boolean;
  minWidth: number;
}

export interface TableColumn<T extends Column> {
  get(row: T): string;
}

export interface TableOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  sort?: string;
  filter?: string;
  columns?: string;
  extended?: boolean;
}

/**
 * Utilities for interacting with terminal I/O.
 */
export default class UX {
  public cli: typeof cli;
  private isOutputEnabled: boolean;

  public constructor(isOutputEnabled?: boolean, ux?: typeof cli) {
    this.cli = ux || cli;

    if (isBoolean(isOutputEnabled)) {
      this.isOutputEnabled = isOutputEnabled;
    } else {
      // Respect the --json flag
      this.isOutputEnabled = !process.argv.find((arg) => arg === '--json');
    }
  }

  /**
   * Logs at `INFO` level and conditionally writes to `stdout` if stream output is enabled.
   *
   * @param {...any[]} args The messages or objects to log.
   * @returns {UX}
   */
  public log(...args: string[]): UX {
    if (this.isOutputEnabled) {
      this.cli.log(...args);
    }
    return this;
  }

  /**
   * Logs a warning as `WARN` level and conditionally writes to `stderr` if the log
   * level is `WARN` or above and stream output is enabled.  The message is added
   * to the static {@link UX.warnings} set if stream output is _not_ enabled, for later
   * consumption and manipulation.
   *
   * @param {string} message The warning message to output.
   * @returns {UX}
   * @see UX.warnings
   */
  public warn(message: string): UX {
    const warning: string = chalk.yellow('WARNING:');
    if (this.isOutputEnabled) {
      console.warn(`${warning} ${message}`);
    }
    return this;
  }

  /**
   * Logs an error at `ERROR` level and conditionally writes to `stderr` if stream
   * output is enabled.
   *
   * @param {...any[]} args The errors to log.
   * @returns {UX}
   */
  public error(...args: unknown[]): UX {
    if (this.isOutputEnabled) {
      console.error(...args);
    }
    return this;
  }

  /**
   * Logs an object as JSON at `ERROR` level and to `stderr`.
   *
   * @param {object} obj The error object to log -- must be serializable as JSON.
   * @returns {UX}
   * @throws {TypeError} If the object is not JSON-serializable.
   */
  public errorJson(obj: Record<string, unknown>): UX {
    const error = JSON.stringify(obj, null, 4);
    console.error(error);
    return this;
  }

  /**
   * Logs at `INFO` level and conditionally writes to `stdout` in a table format if
   * stream output is enabled.
   *
   * @param {object[]} rows The rows of data to be output in table format.
   * @param {SfdxTableOptions} options The {@link SfdxTableOptions} to use for formatting.
   * @returns {UX}
   */
  // (allow any because matches oclif)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public table(rows: any[], options: TableOptions | string[]): UX {
    if (this.isOutputEnabled) {
      // This is either an array of column names or an already built Partial<OclifTableOptions>
      if (isArray(options)) {
        const columns = options.reduce((acc, key) => {
          return {
            ...acc,
            [key]: {
              key,
            },
          };
        }, {});
        this.cli.table(rows, columns);
      } else {
        this.cli.table(rows, options);
      }
    }
    return this;
  }

  /**
   * Logs at `INFO` level and conditionally writes to `stdout` in a styled object format if
   * stream output is enabled.
   *
   * @param {object} obj The object to be styled for stdout.
   * @param {string[]} [keys] The object keys to be written to stdout.
   * @returns {UX}
   */
  public styledObject(obj: Record<string, unknown>, keys?: string[]): UX {
    if (this.isOutputEnabled) {
      this.cli.styledObject(obj, keys);
    }
    return this;
  }

  /**
   * Log at `INFO` level and conditionally write to `stdout` in styled JSON format if
   * stream output is enabled.
   *
   * @param {object} obj The object to be styled for stdout.
   * @returns {UX}
   */
  public styledJSON(obj: Record<string, unknown>): UX {
    if (this.isOutputEnabled) {
      this.cli.styledJSON(obj);
    }
    return this;
  }
}
