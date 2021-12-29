/*
 * @file         : worker.ts
 * @summary      : Download worker
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : Starts an async worker
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

import { workerData, isMainThread, parentPort } from 'worker_threads';
import { DownloadWorker } from './DownloadWorker';

export default void (async (options: DownloadWorker.Options): Promise<DownloadWorker> => {
  process
    .once('unhandledRejection', (reason: Error, promise: PromiseLike<unknown>) => {
      // eslint-disable-next-line no-console
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    })
    .once('uncaughtException', (error: Error, origin: string) => {
      // eslint-disable-next-line no-console
      console.error('Caught exception:', error, 'Exception origin:', origin);
      process.exit(1);
    });
  if (!isMainThread && parentPort) {
    try {
      return await DownloadWorker.create({ ...options, parentPort });
    } catch (error) {
      process.exit(1);
    }
  }
  process.exit(1);
})(workerData as DownloadWorker.Options);
