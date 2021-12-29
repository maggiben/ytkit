/*
 * @file         : scheduler.ts
 * @summary      : Playlist thread scheduler
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : A hread scheduler
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 02 Dec 2021
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

import * as path from 'path';
import { EventEmitter } from 'stream';
import { Worker, WorkerOptions } from 'worker_threads';
import { OutputFlags } from '@oclif/parser';
import * as ytpl from 'ytpl';
// import scheduler from '../utils/promise-pool';
import { DownloadWorker } from './DownloadWorker';
import { EncoderStream } from './EncoderStream';

export namespace Scheduler {
  /**
   * Constructor options for Scheduler.
   */
  export interface Options {
    /**
     * Youtube playlist id.
     */
    playlistId: string;
    /**
     * Output file name.
     */
    output?: string;
    /**
     * Property specifies the maximum number of simultaneous connections to a server.
     */
    maxconnections?: number;
    /**
     * Total number of connection attempts, including the initial connection attempt.
     */
    retries?: number;
    /**
     * Timeout value prevents network operations from blocking indefinitely.
     */
    timeout?: number;
    /**
     * Video download options.
     */
    playlistOptions?: ytpl.Options;
    /**
     * Flags
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flags?: OutputFlags<any>;
    /**
     * Media encoder options
     */
    encoderOptions?: EncoderStream.EncodeOptions;
  }

  export interface Message {
    type: string;
    source: ytpl.Item | ytpl.Result;
    error?: Error;
    details?: Record<string, unknown>;
  }

  export interface RetryItems {
    item: ytpl.Item;
    left: number;
  }

  export interface Result {
    item: ytpl.Item;
    code: number | boolean;
    error?: Error | string;
  }
}

/*
  blender playlist: https://www.youtube.com/playlist?list=PL6B3937A5D230E335
  live items playlist: https://www.youtube.com/watch?v=5qap5aO4i9A&list=RDLV5qap5aO4i9A&start_radio=1&rv=5qap5aO4i9A&t=15666341
*/
export class Scheduler extends EventEmitter {
  private workers = new Map<string, Worker>();
  private retryItems = new Map<string, Scheduler.RetryItems>();
  private playlistId: string;
  private output: string;
  private maxconnections: number;
  private retries: number;
  private timeout: number;
  private playlistOptions?: ytpl.Options;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private flags?: OutputFlags<any>;
  private encoderOptions?: EncoderStream.EncodeOptions;

  public constructor(options: Scheduler.Options) {
    super();
    this.playlistId = options.playlistId;
    this.output = options.output ?? '{videoDetails.title}';
    this.maxconnections = options.maxconnections ?? 5;
    this.retries = options.retries ?? 5;
    this.timeout = options.timeout ?? 120 * 1000; // 120 seconds
    this.flags = options.flags;
    this.playlistOptions = options.playlistOptions;
    this.encoderOptions = options.encoderOptions;
  }

  /**
   * Initializes an instance of the Downloader class.
   */
  public async download(): Promise<Array<Scheduler.Result | undefined>> {
    const playlist = await ytpl(this.playlistId, this.playlistOptions);
    this.emit('playlistItems', { source: playlist, details: { playlistItems: playlist.items } });
    return this.scheduler(playlist.items);
    // try {
    //   return await this.scheduler(playlist.items);
    // return await scheduler<Scheduler.Result, ytpl.Item>(
    //   this.maxconnections,
    //   playlist.items,
    //   this.downloadWorkers.bind(this)
    // );
    // } catch (error) {
    //   throw new Error(`Scheduler error: ${(error as Error).message}`);
    // }
  }

  /*
  public postWorkerMessage(worker: Worker, message: Scheduler.Message): void {
    return worker.postMessage(Buffer.from(JSON.stringify(message)).toString('base64'));
  }
  */

  private async scheduler(items: ytpl.Item[]): Promise<Array<Scheduler.Result | undefined>> {
    const workers: Array<Scheduler.Result | undefined> = [];
    for await (const result of this.runTasks<Scheduler.Result>(this.maxconnections, this.tasks(items))) {
      workers.push(result);
    }
    return workers;
  }

  /*
    from: https://stackoverflow.com/questions/40639432/what-is-the-best-way-to-limit-concurrency-when-using-es6s-promise-all
  */
  private tasks<T extends Scheduler.Result>(items: ytpl.Item[]): IterableIterator<() => Promise<T>> {
    const tasks = [];
    for (const item of items) {
      const task = async (): Promise<T> => {
        try {
          return await this.downloadWorkers<T>(item);
        } catch (error) {
          return {
            item,
            code: Number(!!error),
            error: (error as Error).message,
          } as T;
        }
      };
      tasks.push(task);
    }
    return tasks.values();
  }

  private async *raceAsyncIterators<T>(
    iterators: Array<AsyncIterator<T>>
  ): AsyncGenerator<T | undefined, void, unknown> {
    async function queueNext(iteratorResult: { result?: IteratorResult<T>; iterator: AsyncIterator<T> }): Promise<{
      result?: IteratorResult<T>;
      iterator: AsyncIterator<T>;
    }> {
      delete iteratorResult.result; // Release previous result ASAP
      iteratorResult.result = await iteratorResult.iterator.next();
      return iteratorResult;
    }
    const iteratorResults = new Map(iterators.map((iterator) => [iterator, queueNext({ iterator })]));
    while (iteratorResults.size) {
      const winner: {
        result?: IteratorResult<T>;
        iterator: AsyncIterator<T>;
      } = await Promise.race(iteratorResults.values());
      if (winner.result && winner.result.done) {
        iteratorResults.delete(winner.iterator);
      } else {
        const value = winner.result && winner.result.value;
        iteratorResults.set(winner.iterator, queueNext(winner));
        yield value;
      }
    }
  }

  private async *runTasks<T>(
    maxConcurrency: number,
    iterator: IterableIterator<() => Promise<T>>
  ): AsyncGenerator<T | undefined, void, unknown> {
    // Each worker is an async generator that polls for tasks
    // from the shared iterator.
    // Sharing the iterator ensures that each worker gets unique tasks.
    const workers = new Array(maxConcurrency) as Array<AsyncIterator<T>>;
    for (let i = 0; i < maxConcurrency; i++) {
      workers[i] = (async function* (): AsyncIterator<T, void, unknown> {
        for (const task of iterator) {
          yield await task();
        }
      })();
    }
    yield* this.raceAsyncIterators<T>(workers);
  }

  /**
   * Retry download if failed
   *
   * @name retryDownloadWorker
   * @memberOf Scheduler:retryDownloadWorker
   * @category Control Flow
   * @param {ytpl.Item} item the playlist item
   * @param {Worker} worker the worker currently executing
   * @returns {boolean} returns false if exceeded the maximum allowed retries otherwise returns true
   */
  private async retryDownloadWorker<T extends Scheduler.Result>(item: ytpl.Item): Promise<T> {
    if (!this.retryItems.has(item.id)) {
      this.retryItems.set(item.id, {
        item,
        left: this.retries,
      });
    }
    const retryItem = this.retryItems.get(item.id);
    if (retryItem && retryItem.left > 0) {
      try {
        this.emit('retry', {
          source: item,
          details: {
            left: retryItem.left,
          },
        });
        retryItem.left -= 1;
        this.retryItems.set(item.id, retryItem);
        return await this.downloadWorkers<T>(item);
      } catch (error) {
        throw new Error((error as Error).message);
      }
    }
    throw new Error(`Could not retry id: ${item.id} retries left: ${retryItem && retryItem.left}`);
  }

  private async terminateDownloadWorker(item: ytpl.Item): Promise<void> {
    const worker = this.workers.get(item.id);
    const code = worker && (await worker.terminate());
    this.workers.delete(item.id);
    this.emit('workerTerminated', {
      source: item,
      details: {
        code,
      },
    });
  }

  private async downloadWorkers<T extends Scheduler.Result>(item: ytpl.Item): Promise<T> {
    const workerOptions: WorkerOptions = {
      workerData: {
        item,
        path: './worker.ts',
        output: this.output,
        timeout: this.timeout,
        flags: this.flags,
        encoderOptions: this.encoderOptions,
      },
    };
    if (this.workers.has(item.id)) {
      await this.terminateDownloadWorker(item);
    }
    return new Promise<T>((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'runner.js'), workerOptions);
      this.workers.set(item.id, worker);
      return this.handleWorkerEvents<T>(worker, item, resolve, reject);
    });
  }

  private handleWorkerEvents<T extends Scheduler.Result>(
    worker: Worker,
    item: ytpl.Item,
    resolve: (value: T) => void,
    reject: (reason?: Error | number | unknown) => void
  ): void {
    worker.on('message', (message: DownloadWorker.Message) => {
      this.emit(message.type, message);
    });
    worker.once('online', () => {
      return this.emit('online', { source: item });
    });
    const exit = (code: number): void => {
      this.emit('exit', { source: item, details: { code } });
      if (code !== 0) {
        this.retryDownloadWorker<T>(item)
          .then(resolve)
          .catch(() => reject(new Error(`Worker id: ${item.id} exited with code ${code}`)));
      } else {
        const result = {
          item,
          code,
        } as T;
        resolve(result);
      }
    };
    worker.once('exit', exit);
    worker.once('error', (error) => {
      this.emit('error', { source: item, error });
      worker.off('exit', exit);
      this.retryDownloadWorker<T>(item)
        .then(resolve)
        .catch(() => reject(error));
    });
  }
}
