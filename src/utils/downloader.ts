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
     * Property specifies the maximum number of simultaneous connections to a server
     */
    maxconnections?: number;
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
    item: ytpl.Item;
    error: Error;
    details: Record<string, unknown>;
  }
}

/*
  blender playlist: https://www.youtube.com/playlist?list=PL6B3937A5D230E335
*/
// export class PlaylistDownloader extends AsyncCreatableEventEmitter<PlaylistDownloader.Options> {
export class PlaylistDownloader extends EventEmitter {
  private workers = new Map<string, Worker>();
  private playlistId: string;
  private output: string;
  private maxconnections: number;
  private playlistOptions?: ytpl.Options;
  private downloadOptions?: ytdl.downloadOptions;

  public constructor(options: PlaylistDownloader.Options) {
    super();
    this.playlistId = options.playlistId;
    this.output = options.output ?? '{videoDetails.title}';
    this.maxconnections = options.maxconnections ?? 2;
    this.downloadOptions = options.downloadOptions;
    this.playlistOptions = options.playlistOptions ?? {
      gl: 'US',
      hl: 'en',
      limit: Infinity,
      pages: Infinity,
    };
  }

  /**
   * Initializes an instance of the Downloader class.
   */
  public async download(): Promise<ytpl.Item[]> {
    const playlist = await ytpl(this.playlistId, this.playlistOptions);
    this.emit('playlist', playlist);
    const workers = [];
    for await (const items of this.runTasks(3, this.tasks(playlist.items))) {
      workers.push(items);
    }
    try {
      return workers;
    } catch {
      throw new Error('downloadWorkers failed');
    }
  }

  private tasks(items: ytpl.Item[]): Array<Promise<ytpl.Item>> {
    return items.map(async (item) => {
      // await this.downloadWorkers(item);
      await this.sleep(Math.random() * 5000);
      return item;
    });
  }

  private async *raceAsyncIterators(iterators: Array<Iterator<ytpl.Item>>): AsyncGenerator<ytpl.Item, void, unknown> {
    console.log('iterators', iterators, Object.keys(iterators));
    async function queueNext(iteratorResult: {
      result?: IteratorResult<ytpl.Item>;
      iterator: Iterator<ytpl.Item>;
    }): Promise<{
      result?: IteratorResult<ytpl.Item>;
      iterator: Iterator<ytpl.Item>;
    }> {
      delete iteratorResult.result; // Release previous result ASAP
      iteratorResult.result = await (iteratorResult.iterator.next() as unknown as Promise<IteratorResult<ytpl.Item>>);
      return iteratorResult;
    }
    const iteratorResults = new Map(iterators.map((iterator) => [iterator, queueNext({ iterator })]));
    while (iteratorResults.size) {
      const winner: {
        result?: IteratorResult<ytpl.Item>;
        iterator: Iterator<ytpl.Item>;
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
    iterator: Array<Promise<ytpl.Item>>
  ): AsyncGenerator<ytpl.Item, void, unknown> {
    // Each worker is an async generator that polls for tasks
    // from the shared iterator.
    // Sharing the iterator ensures that each worker gets unique tasks.
    const workers = new Array(maxConcurrency) as Array<AsyncGenerator<ytpl.Item>>;
    for (let i = 0; i < maxConcurrency; i++) {
      workers[i] = (async function* (): AsyncGenerator<ytpl.Item, void, unknown> {
        // workers[i] = (async function* (): AsyncGenerator<Iterator<ytpl.Item>> {
        for (const task of iterator) {
          yield await task;
        }
      })();
    }

    // yield* this.raceAsyncIterators(workers as Array<Iterator<ytpl.Item>>);
    yield* this.raceAsyncIterators(workers);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private splitPlaylist(items: ytpl.Item[], maxconnections: number = this.maxconnections): ytpl.Item[][] {
    return [items.slice(0, maxconnections), items.slice(maxconnections, -1)];
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
      worker.on('message', (message: DownloadWorker.Message) => {
        this.emit(message.type, message);
      });
      worker.on('online', () => {
        this.emit('online', { item });
      });
      worker.on('error', (error) => {
        this.emit('error', { item, error });
        this.workers.delete(item.id);
        reject(error);
      });
      worker.on('exit', (code) => {
        this.emit('exit', { item, code });
        this.workers.delete(item.id);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
        resolve(code);
      });
    });
  }
}
