/*
 * @file         : downloader.ts
 * @summary      : video downloader
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : downloads a video or videos given a video or playlist url
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

// import { Readable } from 'stream';
// import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'stream';
import { Worker, WorkerOptions } from 'worker_threads';
import ytdl = require('ytdl-core');
import * as ytpl from 'ytpl';
import { DownloadWorker } from './worker';

export namespace PlaylistDownloader {
  /**
   * Constructor options for PlaylistDownloader.
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
     * Video download options.
     */
    playlistOptions?: ytpl.Options;
    /**
     * Video download options.
     */
    downloadOptions?: ytdl.downloadOptions;
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
}

/*
  blender playlist: https://www.youtube.com/playlist?list=PL6B3937A5D230E335
*/
// export class PlaylistDownloader extends AsyncCreatableEventEmitter<PlaylistDownloader.Options> {
export class PlaylistDownloader extends EventEmitter {
  private workers = new Map<string, Worker>();
  private retryItems = new Map<string, PlaylistDownloader.RetryItems>();
  private playlistId: string;
  private output: string;
  private maxconnections: number;
  private retries: number;
  private playlistOptions?: ytpl.Options;
  private downloadOptions?: ytdl.downloadOptions;

  public constructor(options: PlaylistDownloader.Options) {
    super();
    this.playlistId = options.playlistId;
    this.output = options.output ?? '{videoDetails.title}';
    this.maxconnections = options.maxconnections ?? 5;
    this.retries = options.retries ?? 5;
    this.downloadOptions = options.downloadOptions;
    this.playlistOptions = options.playlistOptions ?? {
      gl: 'US',
      hl: 'en',
      // limit: Infinity,
      // pages: Infinity,
    };
  }

  /**
   * Initializes an instance of the Downloader class.
   */
  public async download(): Promise<number[]> {
    const playlist = await ytpl(this.playlistId, this.playlistOptions);
    this.emit('playlistItems', { source: playlist, details: { playlistItems: playlist.items } });
    try {
      return await this.sheduler(playlist.items);
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  private async sheduler(items: ytpl.Item[]): Promise<number[]> {
    const workers: number[] = [];
    try {
      for await (const code of this.runTasks(this.maxconnections, this.tasks(items))) {
        workers.push(code ?? 1);
      }
    } catch (error) {
      throw new Error((error as Error).message);
    }
    return workers;
  }

  private tasks(items: ytpl.Item[]): IterableIterator<() => Promise<number>> {
    const tasks = [];
    for (const item of items) {
      tasks.push(async () => {
        try {
          return await this.downloadWorkers(item);
        } catch (error) {
          throw new Error((error as Error).message);
        }
      });
    }
    return tasks.values();
  }

  /*
  private tasks3(items: ytpl.Item[]): IterableIterator<() => Promise<number>> {
    const tasks = [];
    for (let i = 0; i < 20; i++) {
      tasks.push(async () => {
        // console.log(`start ${i}`);
        await this.sleep(Math.random() * 1000);
        // console.log(`end ${i}`);
        return i;
      });
    }
    return tasks.values();
  }

  private tasks2(items: ytpl.Item[]): Array<Promise<number>> {
    return items.map(async (item, index) => {
      // try {
      //   return this.downloadWorkers(item);
      // } catch (error) {
      //   throw new Error((error as Error).message);
      // }
      const ms = Math.random() * 15000;
      // eslint-disable-next-line no-console
      // console.log('task', index, ms);
      await this.sleep(ms);
      return Math.floor(Math.random() * (1 - 0 + 1)) + 0;
    });
  }
  */

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async *raceAsyncIterators(
    iterators: Array<AsyncIterator<number>>
  ): AsyncGenerator<number | undefined, void, unknown> {
    async function queueNext(iteratorResult: {
      result?: IteratorResult<number>;
      iterator: AsyncIterator<number>;
    }): Promise<{
      result?: IteratorResult<number>;
      iterator: AsyncIterator<number>;
    }> {
      delete iteratorResult.result; // Release previous result ASAP
      iteratorResult.result = await (iteratorResult.iterator.next() as unknown as Promise<IteratorResult<number>>);
      return iteratorResult;
    }
    const iteratorResults = new Map(iterators.map((iterator) => [iterator, queueNext({ iterator })]));
    while (iteratorResults.size) {
      const winner: {
        result?: IteratorResult<number>;
        iterator: AsyncIterator<number>;
      } = await Promise.race(iteratorResults.values());
      if (winner.result?.done) {
        iteratorResults.delete(winner.iterator);
      } else {
        const value = winner.result?.value;
        iteratorResults.set(winner.iterator, queueNext(winner));
        yield value;
      }
    }
  }

  private async *runTasks(
    maxConcurrency: number,
    // iterator: IterableIterator<Promise<number>>
    iterator: IterableIterator<() => Promise<number>>
  ): AsyncGenerator<number | undefined, void, unknown> {
    // Each worker is an async generator that polls for tasks
    // from the shared iterator.
    // Sharing the iterator ensures that each worker gets unique tasks.
    const workers = new Array(maxConcurrency) as Array<AsyncIterator<number>>;
    for (let i = 0; i < maxConcurrency; i++) {
      workers[i] = (async function* (): AsyncIterator<number, void, unknown> {
        for (const task of iterator) {
          yield await task();
        }
      })();
    }

    yield* this.raceAsyncIterators(workers);
  }

  /**
   * Retry download if failed
   *
   * @param {ytpl.Item} item the playlist item
   * @param {Worker} worker the worker currently executing
   * @returns {boolean} returns false if exceeded the maximum allowed retries otherwise returns true
   */
  private retryDownloadWorker(item: ytpl.Item, worker: Worker): boolean {
    if (!this.retryItems.has(item.id)) {
      this.retryItems.set(item.id, {
        item,
        left: this.retries,
      });
    }
    const retryItem = this.retryItems.get(item.id);
    if (retryItem && retryItem.left > 0 && this.workers.has(item.id)) {
      const message: PlaylistDownloader.Message = {
        type: 'retry',
        source: item,
        details: {
          left: retryItem.left,
        },
      };
      this.postWorkerMessage(worker, message);
      this.emit(message.type, message);
      retryItem.left -= 1;
      this.retryItems.set(item.id, retryItem);
      return true;
    } else if (retryItem && retryItem.left <= 0) {
      return false;
    }
    return false;
  }

  private postWorkerMessage(worker: Worker, message: PlaylistDownloader.Message): void {
    return worker.postMessage(Buffer.from(JSON.stringify(message)).toString('base64'));
  }

  private async downloadWorkers(item: ytpl.Item): Promise<number> {
    const workerOptions: WorkerOptions = {
      workerData: {
        item,
        output: this.output,
        downloadOptions: this.downloadOptions,
        path: './worker.ts',
      },
    };
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'worker.js'), workerOptions);
      this.workers.set(item.id, worker);
      return this.handleWorkerEvents<number>(worker, item, resolve, reject);
      /*
      worker.on('message', (message: DownloadWorker.Message) => {
        this.emit(message.type, message);
        if (['error', 'timeout'].includes(message.type)) {
          const retry = this.retryDownloadWorker(item, worker);
          if (!retry) {
            this.workers.delete(item.id);
            this.retryItems.delete(item.id);
            worker
              .terminate()
              .then((code) => {
                this.emit('worker:terminated:success', {
                  source: item,
                  details: {
                    code,
                  },
                });
              })
              .catch((error) => {
                this.emit('worker:terminated:error', {
                  source: item,
                  error: error as Error,
                });
              });
            return reject(message.error);
          }
        }
      });
      worker.on('online', () => {
        return this.emit('online', { source: item });
      });
      worker.on('error', (error) => {
        this.emit('fatal', { source: item, error });
        this.retryItems.delete(item.id);
        this.workers.delete(item.id);
        return reject(error);
      });
      worker.on('exit', (code) => {
        this.emit('exit', { source: item, code });
        this.retryItems.delete(item.id);
        this.workers.delete(item.id);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
        resolve(code);
      });
       */
    });
  }

  private handleWorkerEvents<T>(
    worker: Worker,
    item: ytpl.Item,
    resolve: (value: number | PromiseLike<T>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void
  ): void {
    worker.on('message', (message: DownloadWorker.Message) => {
      this.emit(message.type, message);
      if (['error', 'timeout'].includes(message.type)) {
        const retry = this.retryDownloadWorker(item, worker);
        if (!retry) {
          this.workers.delete(item.id);
          this.retryItems.delete(item.id);
          worker
            .terminate()
            .then((code) => {
              this.emit('worker:terminated:success', {
                source: item,
                details: {
                  code,
                },
              });
            })
            .catch((error) => {
              this.emit('worker:terminated:error', {
                source: item,
                error: error as Error,
              });
            });
          return reject(message.error);
        }
      }
    });
    worker.on('online', () => {
      return this.emit('online', { source: item });
    });
    worker.on('error', (error) => {
      this.emit('fatal', { source: item, error });
      this.retryItems.delete(item.id);
      this.workers.delete(item.id);
      return reject(error);
    });
    worker.on('exit', (code) => {
      this.emit('exit', { source: item, code });
      this.retryItems.delete(item.id);
      this.workers.delete(item.id);
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
      resolve(code);
    });
  }
}
