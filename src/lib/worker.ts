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

import { workerData, parentPort, isMainThread } from 'worker_threads';
import { Readable, Writable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import ytdl = require('ytdl-core');
import ffmpegStatic = require('ffmpeg-static');
import ffmpeg = require('fluent-ffmpeg');
import * as ytpl from 'ytpl';
import tsNode = require('ts-node');
import * as progressStream from 'progress-stream';
import * as utils from '../utils/utils';
import { AsyncCreatable } from '../utils/AsyncCreatable';
import TimeoutStream from './TimeoutStream';
import { FfmpegStream } from './FfmpegStream';

ffmpeg.setFfmpegPath(ffmpegStatic);
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
    /**
     * Media encoder options
     */
    encoderOptions?: FfmpegStream.Options;
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
  private encoderOptions?: FfmpegStream.Options;
  private videoInfo!: ytdl.videoInfo;
  private videoFormat!: ytdl.videoFormat;
  private timeoutStream!: TimeoutStream;
  private outputStream!: fs.WriteStream;
  private progressStream!: progressStream.ProgressStream;
  private progress?: progressStream.Progress;

  public constructor(options: DownloadWorker.Options) {
    super(options);
    this.item = options.item;
    this.timeout = options.timeout ?? 120 * 1000;
    this.output = options.output ?? '{videoDetails.title}';
    this.downloadOptions = options.downloadOptions;
    this.encoderOptions = options.encoderOptions;
    this.timeoutStream = new TimeoutStream({ timeout: this.timeout });
  }

  /**
   * Initializes an instance of the Downloader class.
   */
  public async init(): Promise<void> {
    try {
      this.handleMessages();
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
    parentPort?.on('message', (base64Message: string) => {
      try {
        const message = JSON.parse(Buffer.from(base64Message, 'base64').toString()) as DownloadWorker.Message;
        switch (message.type) {
          case 'kill': {
            this.endStreams();
            this.exit(1);
            break;
          }
        }
      } catch (error) {
        return this.error(error);
      }
    });
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

  private async onEnd(): Promise<void> {
    return new Promise((resolve) => {
      this.readStream.once('end', () => {
        parentPort?.postMessage({
          type: 'end',
          source: this.item,
        });
        resolve();
      });
    });
  }

  private async downloadFromInfo(videoInfo: ytdl.videoInfo): Promise<ytdl.videoInfo | undefined> {
    try {
      this.readStream = ytdl.downloadFromInfo(videoInfo, this.downloadOptions);
      this.readStream.once('error', this.error.bind(this));
      const infoAndVideoFormat = await this.setVideInfoAndVideoFormat();
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
        await this.onEnd();
        return infoAndVideoFormat.videoInfo;
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
  private setVideoOutput(): fs.WriteStream | NodeJS.WriteStream | Writable {
    /* transcode stream */
    if (this.encoderOptions) {
      const file = this.getOutputFile({
        format: this.encoderOptions.format,
      });
      this.outputStream = fs.createWriteStream(file);
      const ffmpegStream = new FfmpegStream(this.readStream, this.outputStream, this.encoderOptions);
      // const ffmpegCommand = this.encode(this.readStream, this.encoderOptions);
      // return ffmpegCommand.pipe(this.outputStream, { end: true });
      ffmpegStream.ffmpegCommand.once('error', this.error.bind(this));
      return ffmpegStream.stream;
    }
    /* stream to file in native format */
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

  /**
   * sends a contentLength message to the main thread
   *
   * @param {number} contentLength size of the video, in bytes.
   * @returns {void}
   */
  private postVideoSize(contentLength: number): void {
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

  /**
   * uses progress-stream to download progress to the main thread.
   *
   * @returns {void}
   */
  private postProgress(): void {
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

  /**
   * uses TimeoutStream to monitor the download status and times out after some period
   * of inactivity
   *
   * @returns {void}
   */
  private postElapsed(): void {
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
    this.readStream.pipe(this.timeoutStream);
    this.timeoutStream.once('timeout', () => {
      this.error(new Error(`stream timeout for workerId: ${this.item.id} title: ${this.item.title}`), 'timeout');
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
  private getOutputFile(options?: {
    output?: string;
    videoInfo?: ytdl.videoInfo;
    videoFormat?: ytdl.videoFormat;
    format?: FfmpegStream.Format | string;
  }): string {
    const {
      output = this.output ?? '{videoDetails.title}',
      videoInfo = this.videoInfo,
      videoFormat = this.videoFormat,
      format = utils.getValueFrom<string>(this.videoFormat, 'container', ''),
    } = options ?? {};
    return path.format({
      name: utils.tmpl(output, [videoInfo, videoFormat]),
      ext: `.${format}`,
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
    this.endStreams();
    parentPort?.postMessage({
      type,
      source: this.item,
      error,
    });
    this.exit(1);
  }

  /**
   * Ends all streams and removed the output file
   *
   * @returns {void} output file
   */
  private endStreams(): void {
    this.readStream.destroy();
    this.readStream.unpipe(this.outputStream);
    this.readStream.unpipe(this.progressStream);
    this.readStream.unpipe(this.timeoutStream);
    // end the timoeut stream
    this.timeoutStream.end();
    // end the progress stream
    this.progressStream.end();
    // end the file stream
    this.outputStream.end();
    // Remove ouput file
    if (fs.existsSync(this.outputStream.path.toString())) {
      this.outputStream.destroy();
      fs.unlinkSync(this.outputStream.path.toString());
    }
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
      const timer = setTimeout(() => {
        this.error(new Error(`Could not retrieve videoInfo for videoId: ${this.item.id}`), 'timeout');
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
  if (!isMainThread) {
    try {
      return await DownloadWorker.create(options);
    } catch (error) {
      process.exit(1);
    }
  }
  process.exit(1);
})(workerData as DownloadWorker.Options);
