/*
 * @file         : worker.ts
 * @summary      : video download worker
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : downloads a video in a new worker
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 06 Dev 2021
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

import { workerData, parentPort } from 'worker_threads';
import { Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import ytdl = require('ytdl-core');
import * as ytpl from 'ytpl';
import tsNode = require('ts-node');
import * as progressStream from 'progress-stream';
import * as utils from './utils';
import { AsyncCreatable } from './AsyncCreatable';
import TimeoutStream from './TimeoutStream';
tsNode.register();

export namespace DownloadWorker {
  /**
   * Constructor options for DownloadWorker.
   */
  export interface Options {
    /**
     * Playlist item.
     */
    item: ytpl.Item;
    /**
     * Output file name.
     */
    output?: string;
    /**
     * Timeout value prevents network operations from blocking indefinitely.
     */
    timeout?: number;
    /**
     * Video download options.
     */
    downloadOptions?: ytdl.downloadOptions;
  }

  export interface Message {
    type: string;
    source: ytpl.Item;
    error: Error;
    details: Record<string, unknown>;
  }
}

class DownloadWorker extends AsyncCreatable<DownloadWorker.Options> {
  protected readStream!: Readable;
  private item: ytpl.Item;
  private output?: string;
  private timeout: number;
  private outputFile!: string;
  private downloadOptions?: ytdl.downloadOptions;
  private videoInfo!: ytdl.videoInfo;
  private videoFormat!: ytdl.videoFormat;
  private timeoutStream!: TimeoutStream;
  private outputStream!: fs.WriteStream;
  private progressStream!: progressStream.ProgressStream;
  private progress?: progressStream.Progress;
  private functions: string[] = [];

  public constructor(options: DownloadWorker.Options) {
    super(options);
    this.item = options.item;
    this.timeout = options.timeout ?? 120 * 1000;
    this.output = options.output ?? '{videoDetails.title}';
    this.downloadOptions = options.downloadOptions;
    this.timeoutStream = new TimeoutStream({ timeout: this.timeout });
  }

  /**
   * Initializes an instance of the Downloader class.
   */
  public async init(): Promise<void> {
    ['worker_messages', 'worker_error', 'file_error'].forEach((name) => {
      const file = path.join('.', `${name}.txt`);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    try {
      this.handleMessages();
      await this.downloadVideo();
      const videoInfo = await this.downloadVideo();
      if (videoInfo) {
        this.exit(0);
      }
      this.exit(1);
    } catch (error) {
      this.error(error);
    }
  }

  private handleMessages(): void {
    this.functions.push('handleMessages');
    parentPort?.on('message', (base64Message: string) => {
      try {
        const message = JSON.parse(Buffer.from(base64Message, 'base64').toString()) as DownloadWorker.Message;
        fs.appendFileSync('./worker_messages.txt', `worker_messages ${message.type} id: ${message.source.id} \n`);
        switch (message.type) {
          case 'retry': {
            this.retryItem(message.source);
            break;
          }
          case 'ack:elapsed': {
            fs.appendFileSync('./ack_elapsed.txt', `ack_elapsed ${message.source.id} elapsed: ${this.timeoutStream.elapsed()} functions: ${this.functions.join(', ')}\n`);
            parentPort?.postMessage({
              type: 'ack:elapsed',
              source: this.item,
              details: {
                elapsed: this.timeoutStream.elapsed(),
              },
            });
            break;
          }
        }
      } catch (error) {
        return this.error(error);
      }
    });
  }

  private retryItem(item?: ytpl.Item): void {
    this.item = item ?? this.item;
    this.downloadVideo()
      .then((videoInfo) => {
        parentPort?.postMessage({
          type: 'retry:success',
          source: this.item,
          details: {
            videoInfo,
          },
        });
      })
      .catch(this.error.bind(this));
  }
  /**
   * Downloads a video
   */
  private async downloadVideo(): Promise<ytdl.videoInfo | void> {
    try {
      const videoInfo = await this.getVideoInfo();
      if (videoInfo) {
        parentPort?.postMessage({
          type: 'videoInfo',
          source: this.item,
          details: {
            videoInfo,
          },
        });
        return await this.downloadFromInfo(videoInfo);
      }
      this.error(new Error('Invalid videoInfo'));
    } catch (error) {
      this.error(error);
    }
  }

  private async downloadFromInfo(videoInfo: ytdl.videoInfo): Promise<ytdl.videoInfo | undefined> {
    this.functions.push('downloadFromInfo');
    try {
      this.readStream = ytdl.downloadFromInfo(videoInfo, this.downloadOptions);
      this.readStream.once('error', this.error.bind(this));
      const infoAndVideoFormat = await this.setVideInfoAndVideoFormat();
      this.functions.push('downloadFromInfo:setVideInfoAndVideoFormat');
      this.videoInfo = infoAndVideoFormat.videoInfo;
      this.videoFormat = infoAndVideoFormat.videoFormat;
      if (this.videoInfo && this.videoFormat) {
        const videoSize = this.getVideoSize();
        if (videoSize) {
          this.postVideoSize(videoSize);
          this.postProgress();
          this.postElapsed();
          this.onTimeout();
        }
        this.setVideoOutput();
        this.readStream.once('end', () => {
          parentPort?.postMessage({
            type: 'end',
            source: this.item,
          });
          return infoAndVideoFormat.videoInfo;
        });
      }
      return videoInfo;
    } catch (error) {
      this.error(error);
    }
  }

  /**
   * Pipes the download stream to either a file to stdout
   * also sets the error handler function
   *
   * @returns {void}
   */
  private setVideoOutput(): fs.WriteStream | NodeJS.WriteStream {
    this.functions.push('setVideoOutput');
    /* stream to file */
    this.outputStream = fs.createWriteStream(this.getOutputFile());
    return this.readStream.pipe(this.outputStream);
  }

  /**
   * Output human readable information about a video download
   * It handles live video too
   *
   * @returns {void}
   */
  private getVideoSize(): number | undefined {
    this.functions.push('getVideoSize');
    const sizeUnknown =
      !utils.getValueFrom(this.videoFormat, 'clen') &&
      (utils.getValueFrom(this.videoFormat, 'isLive') ||
        utils.getValueFrom(this.videoFormat, 'isHLS') ||
        utils.getValueFrom(this.videoFormat, 'isDashMPD'));

    if (sizeUnknown) {
      return undefined;
    } else if (utils.getValueFrom(this.videoFormat, 'contentLength')) {
      return parseInt(utils.getValueFrom(this.videoFormat, 'contentLength'), 10);
    } else {
      this.readStream.once('response', (response) => {
        if (utils.getValueFrom(response, 'headers.content-length')) {
          return parseInt(utils.getValueFrom(response, 'headers.content-length'), 10);
        } else {
          return undefined;
        }
      });
    }
  }


  private postVideoSize(contentLength: number): void {
    this.functions.push('postVideoSize');
    this.progressStream = progressStream({
      length: contentLength,
      time: 100,
      drain: true,
    });

    parentPort?.postMessage({
      type: 'contentLength',
      source: this.item,
      details: {
        contentLength,
      },
    });
  }

  private postProgress(): void {
    this.functions.push('postProgress');
    this.readStream.pipe(this.progressStream);
    this.progressStream.on('progress', (progress) => {
      this.progress = progress;
      parentPort?.postMessage({
        type: 'progress',
        source: this.item,
        details: {
          progress: { ...this.progress, elapsed: this.timeoutStream.elapsed() },
        },
      });
    });
  }

  private postElapsed(): void {
    this.functions.push('postElapsed');
    const timer = setInterval(() => {
      parentPort?.postMessage({
        type: 'elapsed',
        source: this.item,
        details: {
          progress: { ...this.progress, elapsed: this.timeoutStream.elapsed() },
        },
      });
    }, 1000);

    this.timeoutStream.once('end', () => {
      clearInterval(timer);
    });
  }

  private onTimeout(): void {
    this.functions.push('onTimeout');
    this.readStream.pipe(this.timeoutStream);
    this.timeoutStream.once('timeout', () => {
      this.functions.push('timeout trigger');
      this.error(new Error(`stream timeout for workerId: ${this.item.id} title: ${this.item.title}`), 'timeout');
    });
  }

  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   * @returns {void}
   */
  private printVideoSize(contentLength: number): void {
    this.functions.push('printVideoSize');
    this.progressStream = progressStream({
      length: contentLength,
      time: 100,
      drain: true,
    });

    parentPort?.postMessage({
      type: 'contentLength',
      source: this.item,
      details: {
        contentLength,
      },
    });

    this.readStream.pipe(this.progressStream);
    // this.readStream.pipe(this.timeoutStream);

    setInterval(() => {
      parentPort?.postMessage({
        type: 'elapsed',
        source: this.item,
        details: {
          progress: { ...this.progress, elapsed: this.timeoutStream.elapsed() },
        },
      });
    }, 1000);

    this.timeoutStream.once('timeout', () => {
      const error = new Error(`stream timeout for workerId: ${this.item.id} title: ${this.item.title}`);
      this.error(error, 'timeout');
    });

    this.progressStream.on('progress', (progress) => {
      this.progress = progress;
      parentPort?.postMessage({
        type: 'progress',
        source: this.item,
        details: {
          progress: { ...progress, elapsed: this.timeoutStream.elapsed() },
        },
      });
    });

    this.readStream.once('end', () => {
      this.progressStream.end();
      parentPort?.postMessage({
        type: 'end',
        source: this.item,
      });
      this.exit(0);
    });
  }

  /**
   * Gets the ouput file fiven a file name or string template
   *
   * Templates are based on videoInfo properties for example:
   * --ouput {videoDetails.author.name} will generate a file who's name
   * will start with the video author's name
   * If no extension is given we'll use the video format container property
   *
   * @returns {string} output file
   */
  private getOutputFile(
    output: string = this.output ?? '{videoDetails.title}',
    videoInfo: ytdl.videoInfo = this.videoInfo,
    videoFormat: ytdl.videoFormat = this.videoFormat
  ): string {
    return path.format({
      name: utils.tmpl(output, [videoInfo, videoFormat]),
      ext: `.${utils.getValueFrom<string>(videoFormat, 'container', '')}`,
    });
  }

  /**
   * Sets videoInfo & videoFormat variables when they become available
   * though the stream
   *
   * @returns {string} output file
   */
  private setVideInfoAndVideoFormat(): Promise<{ videoInfo: ytdl.videoInfo; videoFormat: ytdl.videoFormat }> {
    this.functions.push('setVideInfoAndVideoFormat');
    return new Promise((resolve, reject) => {
      this.readStream.once('info', (videoInfo: ytdl.videoInfo, videoFormat: ytdl.videoFormat): void => {
        return resolve({ videoInfo, videoFormat });
      });
      this.readStream.once('error', reject);
    });
  }

  private error(error: Error | unknown, type = 'error'): void {
    fs.appendFileSync(
      './worker_error.txt',
      `item id: ${this.item.id} title: ${this.item.title} type: ${type} error: ${error as string} \n`
    );
    this.endStreams();
    fs.appendFileSync(
      './file_error.txt',
      `path: ${this.outputStream.path.toString()} destroyed: ${this.outputStream.destroyed} \n`
    );
    const file = this.getOutputFile();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      fs.appendFileSync('./file_error.txt', `file ${file} exists: ${fs.existsSync(file)} \n`);
    }
    parentPort?.postMessage({
      type,
      source: this.item,
      error,
    });
    this.exit(1);
  }

  private endStreams(): void {
    this.readStream.destroy();
    this.readStream.unpipe(this.progressStream);
    this.readStream.unpipe(this.outputStream);
    this.readStream.unpipe(this.timeoutStream);
    // end the timoeut stream
    this.timeoutStream.end();
    // end the progress stream
    this.progressStream.end();
    // end the file stream
    this.outputStream.end();
  }

  private exit(code: number): never {
    process.exit(code);
  }

  private elapsed(): (lap?: string) => void {
    let prev = performance.now();
    return (lap?: string): void => {
      if (lap) {
        // eslint-disable-next-line no-console
        return console.log(`${lap} in: ${utils.toHumanTime(Math.floor((performance.now() - prev) / 1000))}`);
      }
      prev = performance.now();
    };
  }

  /**
   * Gets info from a video additional formats and deciphered URLs.
   *
   * @returns {Promise<ytdl.videoInfo | undefined>} the video info object or undefined if it fails
   */
  private async getVideoInfo(): Promise<ytdl.videoInfo | undefined> {
    if (this.functions.includes('getVideoInfo')) {
      this.functions.push('DOUBLE = getVideoInfo = DOUBLE');
    } else {
      this.functions.push('getVideoInfo');
    }
    try {
      const timer = setTimeout(() => {
        throw new Error('Could not retrieve videoInfo');
      }, this.timeout);
      const videoInfo = await ytdl.getInfo(this.item.url);
      clearTimeout(timer);
      return videoInfo;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }
}

export default void (async (options: DownloadWorker.Options): Promise<DownloadWorker> => {
  try {
    return await DownloadWorker.create(options);
  } catch (error) {
    process.exit(1);
  }
})(workerData as DownloadWorker.Options);
