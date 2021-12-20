/*
 * @file         : StreamTimeout.ts
 * @summary      : Stream timeout
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : Emits a timeout if the stream has been quiet (no writes) for too long
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 06 Dec 2021
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

import { Writable, WritableOptions, Readable } from 'stream';
import * as utils from '../utils/utils';

export interface TimeoutStreamOptions extends WritableOptions {
  timeout?: number;
}
export default class TimeoutStream extends Writable {
  private timeout: number;
  private timer!: NodeJS.Timeout;
  private prev!: number;
  private inputStream!: Readable;
  public constructor(options?: TimeoutStreamOptions) {
    super(options);
    this.timeout = options?.timeout ?? 5000;
    this.handleEvents();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.clearTimeout();
    this.setTimeout();
    return callback();
  }

  public elapsed(): string {
    return utils.toHumanTime(Math.floor((performance.now() - this.prev) / 1000));
  }

  public end(): void {
    this.clearTimeout();
  }

  private handleEvents(): void {
    this.once('pipe', (stream: Readable) => {
      this.inputStream = stream;
      this.handleInputStreamEvents(stream);
      this.setTimeout();
    });
    this.once('close', () => {
      this.clearTimeout();
    });
    this.once('end', () => {
      this.clearTimeout();
    });
    this.once('finish', () => {
      this.clearTimeout();
    });
  }

  private handleInputStreamEvents(inputStream = this.inputStream): void {
    inputStream.once('end', () => {
      this.clearTimeout();
      this.emit('end');
    });
  }

  private setTimeout(): NodeJS.Timeout {
    this.prev = performance.now();
    this.timer = setTimeout(() => {
      this.emit('timeout');
    }, this.timeout);
    return this.timer;
  }

  private clearTimeout(): void {
    return clearTimeout(this.timer);
  }
}
