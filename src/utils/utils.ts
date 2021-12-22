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
import { ensureArray } from '@salesforce/ts-types';
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
const UNITS = ' KMGTPEZYXWVU';
export const toHumanSize = (bytes: number): string => {
  if (bytes <= 0) {
    return '0';
  }
  const t2 = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 12);
  return `${Math.round((bytes * 100) / Math.pow(1024, t2)) / 100}${UNITS.charAt(t2).replace(' ', '')}B`;
};

/**
 * Converts human size input to number of bytes.
 *
 * @param {string} size ie. 128KB 96KB
 * @return {number} number in bytes
 */
export function fromHumanSize(size: string): number {
  if (!size) {
    return 0;
  }

  const num = parseFloat(size);
  const unit = size[num.toString().length];
  const unitIndex = UNITS.indexOf(unit);

  if (unitIndex < 0) {
    return num;
  }

  return Math.pow(1024, unitIndex) * num;
}

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
export type ThrottledFunction<T extends (...args: any[]) => any> = (...args: Parameters<T>) => ReturnType<T>;

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

/**
 * Prints video size with a progress bar as it downloads.
 *
 * @param {unknown} from an object like who's properties you need to extract
 * @param {string} location the objects path
 * @param {unknown} exists if false always return the default value
 */
export function getValueFromMeta<T>(
  from: unknown,
  path: string,
  exists?: unknown,
  defaultValue?: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform?: (input: any) => T
): T {
  if (exists) {
    if (transform) {
      return transform(getValueFrom<T>(from, path, defaultValue));
    }
    return getValueFrom<T>(from, path, defaultValue);
  }
  return defaultValue as T;
}

export function getYoutubeVideoId(url: string): string | undefined {
  const regExp = new RegExp(
    /(?:http|https|)(?::\/\/|)(?:www.|)(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/ytscreeningroom\?v=|\/feeds\/api\/videos\/|\/user\S*[^\w\-\s]|\S*[^\w\-\s]))([\w-]{11})[a-z0-9;:@#?&%=+/$_.-]*/
  );
  const match = url.match(regExp);
  if (match && match[1]) {
    return match[1];
  }
}
/**
 * Get playlist id from url
 *
 * @param {string} url the youtube url
 * @returns {string|undefined} the playlist id
 */
export function getYoutubePlaylistId(url: string): string | undefined {
  const regExp = new RegExp(
    /(?:http|https|)(?::\/\/|)(?:www.|)(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/ytscreeningroom\?v=|\/feeds\/api\/videos\/|\/user\S*[^\w\-\s]|\S*[^\w\-\s]))([\w-]{12,})[a-z0-9;:@#?&%=+/$_.-]*/
  );
  if (url.includes('list=')) {
    const match = url.match(regExp);
    if (match && match[1]) {
      return match[1];
    }
  }
  return;
}

export function getNodeVersion(): { major: number; minor: number; patch: number } {
  const version = process.version.match(/(\d+)\.(\d+)\.(\d+)/);
  const [major, minor, patch] = ensureArray(version)
    .slice(1)
    .map((match) => parseInt(match as string, 10));
  return {
    major,
    minor,
    patch,
  };
}
