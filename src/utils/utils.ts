/*
 * @file         : utils.ts
 * @summary      : connmon utilitis
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : micelaneous utilities used thought the project
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

import sanitizeName = require('sanitize-filename');
import { get } from '@salesforce/ts-types';

/**
 * Converts seconds into human readable time hh:mm:ss
 *
 * @param {number} seconds
 * @return {string}
 */
export const toHumanTime = (seconds: number): string => {
  const h: number = Math.floor(seconds / 3600);
  let m: number | string = Math.floor(seconds / 60) % 60;

  let time;
  if (h > 0) {
    time = `${h}:`;
    if (m < 10) {
      m = `0${m}`;
    }
  } else {
    time = '';
  }

  const secs: string = seconds % 60 < 10 ? `0${seconds % 60}` : `${seconds % 60}`;
  return `${time}${m}:${secs}`;
};

/**
 * Converts bytes to human readable unit.
 * Thank you Amir from StackOverflow.
 *
 * @param {number} bytes
 * @return {string}
 */
const units = ' KMGTPEZYXWVU';
export const toHumanSize = (bytes: number): string => {
  if (bytes <= 0) {
    return '0';
  }
  const t2 = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 12);
  return `${Math.round((bytes * 100) / Math.pow(1024, t2)) / 100}${units.charAt(t2).replace(' ', '')}B`;
};

/**
 * Template a string with variables denoted by {prop}.
 *
 * @param {string} str
 * @param {Array.<Object>} objs
 * @return {string}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tmpl = (str: string, objs: any[]): string => {
  return str.replace(/\{([\w.-]+)\}/g, (match: string, prop: string) => {
    const name = objs
      .map((result: Record<string, unknown>) => {
        const value = getValueFrom<string>(result, prop);
        return value ? sanitizeName(value, { replacement: '-' }) : undefined;
      })
      .filter(Boolean)
      .pop();
    return name ?? match;
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThrottledFunction<T extends (...args: any) => any> = (...args: Parameters<T>) => ReturnType<T>;

/**
 * Creates a throttled function that only invokes the provided function (`func`) at most once per within a given number of milliseconds
 * (`limit`)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any) => any>(func: T, limit: number): ThrottledFunction<T> {
  let inThrottle: boolean;
  let lastResult: ReturnType<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (this: any, ...args): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-this-alias
    const context = this;
    if (!inThrottle) {
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      lastResult = func.apply(context, args);
    }
    return lastResult;
  };
}

/**
 * Perform a deep clone of an object or array compatible with JSON stringification.
 * Object fields that are not compatible with stringification will be omitted. Array
 * entries that are not compatible with stringification will be censored as `null`.
 *
 * @param obj A JSON-compatible object or array to clone.
 * @throws {Error} If the object contains circular references or causes
 * other JSON stringification errors.
 */
export function cloneJson<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Helper method used to retrieve a typed value of a flag from
 * the flags object
 *
 * @param {string} flagName the name of the flag
 * @param {unknown} an optional default value
 * @returns {T} the returned type
 */
export function getValueFrom<T>(from: unknown, path: string, defaultValue?: unknown): T {
  return get(from, path, defaultValue) as T;
}
