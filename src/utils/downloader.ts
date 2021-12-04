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
import { Worker, isMainThread, WorkerOptions } from 'worker_threads';
import ytdl = require('ytdl-core');
import * as ytpl from 'ytpl';
import { AsyncCreatableEventEmitter } from './AsyncCreatable';

export interface WorkerDataPayload {
  url: string;
  path: string;
}

export interface WorkerMessage {
  type: string;
  videoId: string;
  details: Record<string, unknown>;
}

export namespace PlaylistDownloader {
  /**
   * Constructor options for DownloadWorker.
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
     * Video download options.
     */
    playlistOptions?: ytpl.Options;
    /**
     * Video download options.
     */
    downloadOptions?: ytdl.downloadOptions;
  }
}

export default class PlaylistDownloader extends AsyncCreatableEventEmitter<PlaylistDownloader.Options> {
  private workers = new Map<string, Worker>();
  private playlistId: string;
  private output?: string;
  private playlistOptions?: ytpl.Options;
  private downloadOptions?: ytdl.downloadOptions;

  public constructor(options: PlaylistDownloader.Options) {
    super(options);
    this.playlistId = options.playlistId;
    this.output = options.output ?? '{videoDetails.title}';
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
  public async init(): Promise<void> {
    if (isMainThread) {
      const playlist = await ytpl(this.playlistId, this.playlistOptions);
      this.emit('playlist', playlist);
      const workers = Promise.all(
        playlist.items.map((item) => {
          return this.downloadWorkers(item);
        })
      );
      try {
        await workers;
      } catch {
        throw new Error('Workers failed');
      }
    }
  }

  private async downloadWorkers(item: ytpl.Item): Promise<number> {
    const workerOptions: WorkerOptions = {
      workerData: {
        url: item.url,
        output: this.output,
        downloadOptions: this.downloadOptions,
        path: './worker.ts',
      },
    };
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'worker.js'), workerOptions);
      this.workers.set(item.id, worker);
      worker.on('message', (message: WorkerMessage) => {
        switch (message.type) {
          case 'contentLength': {
            // eslint-disable-next-line no-console
            console.log('contentLength:', message.details.contentLength);
            break;
          }
          case 'progress': {
            // eslint-disable-next-line no-console
            console.log('progress:', message.details.progress);
            break;
          }
        }
      });
      worker.on('online', () => {
        // eslint-disable-next-line no-console
        console.log('worker online');
      });
      worker.on('error', (error) => {
        // eslint-disable-next-line no-console
        console.error('error:', error);
        this.workers.delete(item.id);
        reject(error);
      });
      worker.on('exit', (code) => {
        // eslint-disable-next-line no-console
        console.log('exit:', code);
        this.workers.delete(item.id);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
        resolve(code);
      });
    });
  }
}

/*
  blender playlist: https://www.youtube.com/playlist?list=PL6B3937A5D230E335
*/
export async function downloader(options: {
  playlistId: string;
  output?: string;
  downloadOptions?: ytdl.downloadOptions;
}): Promise<string | undefined> {
  if (isMainThread) {
    const playlist = await ytpl(options.playlistId);
    const workerOptions: WorkerOptions = {
      workerData: {
        url: playlist.items[1].url,
        output: options.output,
        downloadOptions: options.downloadOptions,
        path: './worker.ts',
      },
    };
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'worker.js'), workerOptions);
      worker.on('message', (message: WorkerMessage) => {
        // eslint-disable-next-line no-console
        console.log(`worker message: ${JSON.stringify(message, null, 2)}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        switch (message.type) {
          case 'contentLength': {
            // eslint-disable-next-line no-console
            console.log('contentLength:', message.details.contentLength);
            break;
          }
          case 'progress': {
            // eslint-disable-next-line no-console
            console.log('progress:', message.details.progress);
            break;
          }
        }
        // resolve(message as string);
      });
      worker.on('online', () => {
        // eslint-disable-next-line no-console
        console.log('online:');
      });
      worker.on('error', (error) => {
        // eslint-disable-next-line no-console
        console.log('exit:', error);
        reject(error);
      });
      worker.on('caca', (caca) => {
        // eslint-disable-next-line no-console
        console.log('caca:', caca);
      });
      worker.on('exit', (code) => {
        // eslint-disable-next-line no-console
        console.log('exit:', code);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}

/*
const { Worker, workerData, parentPort, isMainThread } = require('worker_threads'); 
module.exports = async function downloader(videoId) {
  if (isMainThread) {
    const workerOptions = {
      workerData: videoId,
    };
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, workerOptions);
      worker.on('message', (message) => {
        // eslint-disable-next-line no-console
        console.log(`worker message: ${JSON.stringify(message)}`);
        resolve(message);
      });
      worker.on('error', (error) => {
        // eslint-disable-next-line no-console
        console.log('exit:', error);
        reject(error);
      });
      worker.on('exit', (code) => {
        // eslint-disable-next-line no-console
        console.log('exit:', code);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  } else {
    const script = workerData as string;
    // eslint-disable-next-line no-console
    console.log(script);
    parentPort?.postMessage({ a: 1 });
  }
}
*/