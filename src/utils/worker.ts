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
import StreamTimeout from './StreamTimeout';
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
  private downloadOptions?: ytdl.downloadOptions;
  private videoInfo!: ytdl.videoInfo;
  private videoFormat!: ytdl.videoFormat;
  private streamTimeout!: StreamTimeout;
  private outputStream!: fs.WriteStream;
  private progressStream!: progressStream.ProgressStream;
  private progress?: progressStream.Progress;

  public constructor(options: DownloadWorker.Options) {
    super(options);
    this.item = options.item;
    this.output = options.output ?? '{videoDetails.title}';
    this.downloadOptions = options.downloadOptions;
    this.streamTimeout = new StreamTimeout({ timeout: options.timeout });
  }

  /**
   * Initializes an instance of the Downloader class.
   */
  public async init(): Promise<void> {
    if (fs.existsSync('./worker_error.txt')) {
      fs.unlinkSync('./worker_error.txt');
    }
    try {
      this.handleMessages();
      await this.downloadVideo();
    } catch (error) {
      this.error(error);
    }
  }

  private handleMessages(): void {
    parentPort?.on('message', (base64Message: string) => {
      try {
        const message = JSON.parse(Buffer.from(base64Message, 'base64').toString()) as DownloadWorker.Message;
        switch (message.type) {
          case 'retry': {
            this.retryItem(message.source);
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
    const videoInfo = await this.getVideoInfo();
    if (videoInfo) {
      parentPort?.postMessage({
        type: 'videoInfo',
        source: this.item,
        details: {
          videoInfo,
        },
      });
      try {
        this.readStream = ytdl.downloadFromInfo(videoInfo, this.downloadOptions);
        this.readStream.on('error', this.error.bind(this));
        const infoAndVideoFormat = await this.setVideInfoAndVideoFormat();
        this.videoInfo = infoAndVideoFormat.videoInfo;
        this.videoFormat = infoAndVideoFormat.videoFormat;
        if (this.videoInfo && this.videoFormat) {
          this.reporter();
          this.setVideoOutput();
          this.readStream.on('end', () => {
            return infoAndVideoFormat.videoInfo;
          });
        }
      } catch (error) {
        return this.error(error);
      }
    }
  }

  /**
   * Pipes the download stream to either a file to stdout
   * also sets the error handler function
   *
   * @returns {void}
   */
  private setVideoOutput(): fs.WriteStream | NodeJS.WriteStream {
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
  private reporter(): void {
    // Print information about the video if not streaming to stdout.

    const sizeUnknown =
      !utils.getValueFrom(this.videoFormat, 'clen') &&
      (utils.getValueFrom(this.videoFormat, 'isLive') ||
        utils.getValueFrom(this.videoFormat, 'isHLS') ||
        utils.getValueFrom(this.videoFormat, 'isDashMPD'));

    if (sizeUnknown) {
      // this.printLiveVideoSize(this.readStream);
    } else if (utils.getValueFrom(this.videoFormat, 'contentLength')) {
      return this.printVideoSize(parseInt(utils.getValueFrom(this.videoFormat, 'contentLength'), 10));
    } else {
      this.readStream.once('response', (response) => {
        if (utils.getValueFrom(response, 'headers.content-length')) {
          return this.printVideoSize(parseInt(utils.getValueFrom(response, 'headers.content-length'), 10));
        } else {
          // return this.printLiveVideoSize(this.readStream);
        }
      });
    }
  }

  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   * @returns {void}
   */
  private printVideoSize(contentLength: number): void {
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
    this.readStream.pipe(this.streamTimeout);

    setInterval(() => {
      parentPort?.postMessage({
        type: 'elapsed',
        source: this.item,
        details: {
          progress: { ...this.progress, elapsed: this.streamTimeout.elapsed() },
        },
      });
    }, 1000);

    this.streamTimeout.once('timeout', () => {
      const error = new Error(`stream timeout for workerId: ${this.item.id} title: ${this.item.title}`);
      this.error(error, 'timeout');
    });

    this.progressStream.on('progress', (progress) => {
      this.progress = progress;
      parentPort?.postMessage({
        type: 'progress',
        source: this.item,
        details: {
          progress: { ...progress, elapsed: this.streamTimeout.elapsed() },
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
    parentPort?.postMessage({
      type,
      source: this.item,
      error,
    });
    this.readStream.unpipe(this.progressStream);
    this.readStream.unpipe(this.outputStream);
    this.readStream.unpipe(this.streamTimeout);
    this.readStream.destroy();
    // end the timoeut stream
    this.streamTimeout.end();
    // end the progress stream
    this.progressStream.end();
    // close the file stream
    this.outputStream.close();
    // remove the file
    fs.unlinkSync(this.getOutputFile());
    this.exit(1);
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
    try {
      // const elapsed = this.elapsed();
      const videoInfo = await ytdl.getInfo(this.item.url);
      // elapsed('getInfo');
      return videoInfo;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }
}

export default void (async (options: DownloadWorker.Options): Promise<DownloadWorker> => {
  return await DownloadWorker.create(options);
})(workerData as DownloadWorker.Options);
