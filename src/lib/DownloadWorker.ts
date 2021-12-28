/*
 * @file         : DownloadWorker.ts
 * @summary      : DownloadWorker class
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : downloads a video and optionally transcode
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 19 Dec 2021
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

import { parentPort } from 'worker_threads';
import { Readable, Writable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import * as ytdl from 'ytdl-core';
import * as ffmpegStatic from 'ffmpeg-static';
import * as ffmpeg from 'fluent-ffmpeg';
import * as ytpl from 'ytpl';
import * as ProgressStream from 'progress-stream';
import * as utils from '../utils/utils';
import { AsyncCreatable } from '../utils/AsyncCreatable';
import TimeoutStream from './TimeoutStream';
import { EncoderStream } from './EncoderStream';

ffmpeg.setFfmpegPath(ffmpegStatic);

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
    encoderOptions?: EncoderStream.EncodeOptions;
  }

  export interface Message {
    type: string;
    source: ytpl.Item;
    error: Error;
    details: Record<string, unknown>;
  }
}

export class DownloadWorker extends AsyncCreatable<DownloadWorker.Options> {
  protected downloadStream!: Readable;
  private item: ytpl.Item;
  private output!: string;
  private timeout: number;
  private downloadOptions?: ytdl.downloadOptions;
  private encoderOptions?: EncoderStream.EncodeOptions;
  private videoInfo!: ytdl.videoInfo;
  private videoFormat!: ytdl.videoFormat;
  private timeoutStream!: TimeoutStream;
  private outputStream!: fs.WriteStream;
  private contentLength?: number;

  public constructor(options: DownloadWorker.Options) {
    super(options);
    this.item = options.item;
    this.timeout = options.timeout ?? 120 * 1000;
    this.output = options.output ?? '{videoDetails.title}';
    this.downloadOptions = options.downloadOptions;
    this.encoderOptions = options.encoderOptions;
  }

  /**
   * Initializes an instance of the Downloader class.
   */
  public async init(): Promise<void> {
    try {
      this.handleMessages();
      const info = await this.downloadVideo();
      if (info) {
        return this.exit(0);
      }
      return this.exit(1);
    } catch (error) {
      return this.error(error);
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
  private async downloadVideo(): Promise<{ videoInfo: ytdl.videoInfo; videoFormat: ytdl.videoFormat } | undefined> {
    try {
      const videoInfo = await this.getVideoInfo();
      parentPort?.postMessage({
        type: 'videoInfo',
        source: this.item,
        details: {
          videoInfo,
        },
      });
      return await this.downloadFromInfo(videoInfo);
    } catch (error) {
      this.error(error);
    }
  }

  private async onEnd(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.downloadStream.once('end', () => {
        parentPort?.postMessage({
          type: 'end',
          source: this.item,
          details: {
            videoInfo: this.videoInfo,
            videoFormat: this.videoFormat,
          },
        });
        resolve();
      });
      this.downloadStream.once('error', reject);
      this.timeoutStream.once('timeout', reject);
    });
  }

  private async downloadFromInfo(
    videoInfo: ytdl.videoInfo
  ): Promise<{ videoInfo: ytdl.videoInfo; videoFormat: ytdl.videoFormat } | undefined> {
    try {
      this.downloadStream = ytdl.downloadFromInfo(videoInfo, this.downloadOptions);
      ({ videoInfo: this.videoInfo, videoFormat: this.videoFormat } = await this.setVideInfoAndVideoFormat());
      const videoSize = await this.getVideoSize();
      /* live streams are unsupported */
      if (videoSize) {
        this.postVideoSize(videoSize);
        this.postProgress();
      }
      this.onTimeout();
      await this.setVideoOutput();
      await this.onEnd();
      return {
        videoInfo: this.videoInfo,
        videoFormat: this.videoFormat,
      };
    } catch (error) {
      this.error(error);
    }
  }

  /**
   * Pipes the download stream to either a file or ffmpeg
   * also sets the error handler function
   *
   * @returns {void}
   */
  private async setVideoOutput(): Promise<fs.WriteStream | NodeJS.WriteStream | Writable | undefined> {
    /* transcode stream */
    if (this.encoderOptions) {
      const file = this.getOutputFile({
        format: this.encoderOptions.format,
      });
      this.outputStream = fs.createWriteStream(file);
      const encoderStreamOptions: EncoderStream.Options = {
        encodeOptions: this.encoderOptions,
        metadata: {
          videoInfo: this.videoInfo,
          videoFormat: this.videoFormat,
        },
        inputStream: this.downloadStream,
        outputStream: this.outputStream,
      };
      try {
        const { stream, ffmpegCommand } = await EncoderStream.create(encoderStreamOptions);
        this.outputStream.once('error', this.error.bind(this));
        ffmpegCommand.once('error', this.error.bind(this));
        return stream;
      } catch (error) {
        this.error(error);
      }
    }
    /* stream to file in native format */
    this.outputStream = fs.createWriteStream(this.getOutputFile());
    return this.downloadStream.pipe(this.outputStream);
  }

  /**
   * Output human readable information about a video download
   * It handles live video too
   *
   * @returns {void}
   */
  private async getVideoSize(): Promise<number | undefined> {
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
      return new Promise((resolve, reject) => {
        this.downloadStream.once('response', (response) => {
          if (utils.getValueFrom(response, 'headers.content-length')) {
            const size = parseInt(utils.getValueFrom(response, 'headers.content-length'), 10);
            return resolve(size);
          } else {
            return resolve(undefined);
          }
        });
        this.downloadStream.once('error', reject);
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
    this.contentLength = contentLength;
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
  private postProgress(contentLength = this.contentLength): void {
    const progressStream = ProgressStream({
      length: contentLength,
      time: 100,
      drain: true,
    });
    this.downloadStream.pipe(progressStream);
    progressStream.on('progress', (progress) => {
      parentPort?.postMessage({
        type: 'progress',
        source: this.item,
        details: {
          progress,
        },
      });
    });
  }

  private onTimeout(): void {
    this.timeoutStream = new TimeoutStream({ timeout: this.timeout });
    this.downloadStream.pipe(this.timeoutStream);
    this.timeoutStream.once('timeout', () => {
      this.downloadStream.unpipe(this.timeoutStream);
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
  private getOutputFile(
    options: {
      output?: string;
      videoInfo?: ytdl.videoInfo;
      videoFormat?: ytdl.videoFormat;
      format?: EncoderStream.Format | string;
    } = {
      output: this.output,
      videoInfo: this.videoInfo,
      videoFormat: this.videoFormat,
      format: utils.getValueFrom<string>(this.videoFormat, 'container', ''),
    }
  ): string {
    const {
      output = this.output,
      videoInfo = this.videoInfo,
      videoFormat = this.videoFormat,
      format = utils.getValueFrom<string>(this.videoFormat, 'container', ''),
    } = options;
    // fs.appendFileSync('output.txt', `output: ${output}\nformat: ${options.format}`);
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
      this.downloadStream.once('info', (videoInfo: ytdl.videoInfo, videoFormat: ytdl.videoFormat): void => {
        parentPort?.postMessage({
          type: 'info',
          source: this.item,
          details: {
            videoInfo,
            videoFormat,
          },
        });
        return videoInfo && videoFormat
          ? resolve({ videoInfo, videoFormat })
          : reject(new Error('failed to get video info and format'));
      });
      this.downloadStream.once('error', reject);
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
    if (this.downloadStream && this.outputStream) {
      this.downloadStream.destroy();
      this.downloadStream.unpipe(this.outputStream);
      // end the file stream
      this.outputStream.end();
      // Remove ouput file
      if (fs.existsSync(this.outputStream.path.toString())) {
        this.outputStream.destroy();
        fs.unlinkSync(this.outputStream.path.toString());
      }
    }
  }

  private exit(code: number): never {
    return process.exit(code);
  }

  /**
   * Gets info from a video additional formats and deciphered URLs.
   *
   * @returns {Promise<ytdl.videoInfo | undefined>} the video info object or undefined if it fails
   */
  private async getVideoInfo(): Promise<ytdl.videoInfo> {
    try {
      const timer = setTimeout(() => {
        throw new Error(`Could not retrieve videoInfo for videoId: ${this.item.id}`);
      }, this.timeout);
      const videoInfo = await ytdl.getInfo(this.item.url, {
        requestOptions: {
          timeout: this.timeout,
        },
      });
      clearTimeout(timer);
      return videoInfo;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }
}
