/*
 * @file         : download.ts
 * @summary      : video download command
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : downloads a video or videos given a video or playlist url
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 05 Jul 2021
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

import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { OutputArgs } from '@oclif/parser';
import * as ytdl from 'ytdl-core';
import * as ytpl from 'ytpl';
import * as progressStream from 'progress-stream';
import { JsonMap, ensureString, ensureArray } from '@salesforce/ts-types';
import { SingleBar } from 'cli-progress';
import { YtKitCommand } from '../YtKitCommand';
import { flags, FlagsConfig } from '../YtKitFlags';
import * as utils from '../utils/utils';
import getDownloadOptions from '../utils/getDownloadOptions';
import videoMeta, { IOutputVideoMeta } from '../utils/videoMeta';
import { Scheduler } from '../lib/scheduler';
import { EncoderStream } from '../lib/EncoderStream';

export interface IFilter {
  [name: string]: (format: Record<string, string>) => boolean;
}

export default class Download extends YtKitCommand {
  public static id = 'download';
  public static readonly description = 'download video to a file or to stdout';
  public static readonly examples = ['$ ytdl download -u https://www.youtube.com/watch?v=aqz-KE-bpKQ'];
  public static readonly flagsConfig: FlagsConfig = {
    url: flags.string({
      char: 'u',
      description: 'Youtube video or playlist url',
      required: true,
    }),
    quality: flags.string({
      description: 'Video quality to download, default: highest can use ITAG',
    }),
    filter: flags.enum({
      description: 'Can be video, videoonly, audio, audioonly',
      options: ['audioandvideo', 'videoandaudio', 'video', 'videoonly', 'audio', 'audioonly'],
    }),
    range: flags.string({
      description: 'Byte range to download, ie 10355705-12452856',
    }),
    'filter-container': flags.string({
      description: 'Filter in format container',
    }),
    'filter-resolution': flags.string({
      description: 'Filter in format resolution',
    }),
    'filter-codecs': flags.string({
      description: 'Filter in format codecs',
    }),
    'unfilter-container': flags.string({
      description: 'Filter out format container',
    }),
    'unfilter-resolution': flags.string({
      description: 'Filter out format container',
    }),
    'unfilter-codecs': flags.string({
      description: 'Filter out format codecs',
    }),
    begin: flags.string({
      description: 'Time to begin video, format by 1:30.123 and 1m30s',
    }),
    urlonly: flags.boolean({
      description: 'Print direct download URL',
    }),
    output: flags.string({
      char: 'o',
      description: 'Save to file, template by {prop}, default: stdout or {title}',
      // default: '{videoDetails.title}',
    }),
    maxconnections: flags.integer({
      description: 'specifies the maximum number of simultaneous connections to a server',
      default: 5,
    }),
    retries: flags.integer({
      description: 'Total number of connection attempts, including the initial connection attempt',
      default: 5,
    }),
    timeout: flags.integer({
      description: 'Timeout value prevents network operations from blocking indefinitely',
      default: 5,
    }),
    format: flags.string({
      description: 'Output format container',
    }),
  };

  // The parsed args for easy reference by this command; assigned in init
  protected args!: OutputArgs;
  // The parsed varargs for easy reference by this command
  protected varargs?: JsonMap;
  protected readStream!: Readable;
  protected ytdlOptions!: ytdl.downloadOptions;
  // The parsed flags for easy reference by this command; assigned in init
  protected output!: string;
  protected extension?: string | unknown;

  // video info
  protected videoInfo?: ytdl.videoInfo;
  // video format
  protected videoFormat?: ytdl.videoFormat;

  private progressStream?: progressStream.ProgressStream;

  public async run(): Promise<ytdl.videoInfo | ytdl.videoInfo[] | string | number[] | void> {
    this.ytdlOptions = getDownloadOptions(this.flags);
    this.setOutput();

    const videoId = ytdl.validateURL(this.getFlag('url')) && ytdl.getVideoID(this.getFlag('url'));
    const playlistId = ytpl.validateID(this.getFlag('url')) && (await ytpl.getPlaylistID(this.getFlag('url')));

    if (!videoId && !playlistId) {
      return;
    }

    if (playlistId) {
      const response = videoId ? await this.ux.cli.confirm('do you want to download the entire playlist (Y/n)') : true;
      if (response) {
        try {
          return await this.downloadPlaylist(playlistId);
        } catch (error) {
          return;
        }
      }
      try {
        return await this.downloadVideo();
      } catch (error) {
        return;
      }
    }

    if (this.flags.urlonly && !playlistId) {
      const url = await this.getDownloadUrl();
      if (url) {
        this.ux.cli.url(url, url);
        return url;
      }
    }

    try {
      return await this.downloadVideo();
    } catch (error) {
      return;
    }
  }

  private async downloadPlaylist(playlistId: string): Promise<number[] | void> {
    const progressbars = new Map<string, SingleBar>();
    const retryItems = new Map<string, Scheduler.RetryItems>();
    const scheduler = new Scheduler({
      playlistId,
      playlistOptions: {
        gl: 'US',
        hl: 'en',
        limit: Infinity,
      },
      output: this.output,
      maxconnections: this.getFlag<number>('maxconnections'),
      retries: this.getFlag<number>('retries'),
      flags: this.flags,
      encoderOptions: this.getEncoderOptions(),
    });

    this.ux.cli.action.start('Retrieving playlist contents', this.ux.chalk.yellow('loading'), { stdout: true });

    const multibar = new this.ux.multibar({
      clearOnComplete: true,
      hideCursor: true,
      format: '[{bar}] | {percentage}% | ETA: {timeleft} | Speed: {speed} | Retries: {retries} | Title: {title} ',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    ['timeout', 'retry', 'error', 'fatal', 'promise', 'online', 'exit', 'progressBar'].forEach((name) => {
      const file = path.join('.', `${name}.txt`);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    scheduler.on('playlistItems', (message: Scheduler.Message) => {
      const length = (message.details?.playlistItems as ytpl.Item[]).length;
      this.ux.cli.action.stop(`total items: ${this.ux.chalk.yellow(length)}`);
    });

    scheduler.on('contentLength', (message: Scheduler.Message) => {
      if (!progressbars.has(message.source.id)) {
        const progressBar = multibar.create(message.details?.contentLength as number, 0, {
          timeleft: 'N/A',
          percentage: '0',
          title: message.source.title,
          speed: utils.toHumanSize(0),
          elapsed: utils.toHumanTime(0),
          retries: this.getFlag<number>('retries'),
        });
        progressbars.set(message.source.id, progressBar);
      }
    });

    scheduler.on('online', (message: Scheduler.Message) => {
      fs.appendFileSync('./online.txt', `thread online id: ${message.source.id} title: ${message.source.title}\n`);
    });

    scheduler.on('end', (message: Scheduler.Message) => {
      const progressbar = progressbars.get(message.source.id);
      if (progressbar) {
        progressbar.stop();
        multibar.remove(progressbar);
      }
    });

    scheduler.on('timeout', (message: Scheduler.Message) => {
      const progressbar = progressbars.get(message.source.id);
      if (progressbar) {
        progressbar.stop();
        multibar.remove(progressbar);
      }
      fs.appendFileSync('./timeout.txt', `item: id: ${message.source.id} title: ${message.source.title} timed out \n`);
    });

    scheduler.on('progress', (message: Scheduler.Message) => {
      interface ExtendedProgress extends progressStream.Progress {
        elapsed: string;
      }
      const progress = message.details?.progress as ExtendedProgress;
      const progressbar = progressbars.get(message.source.id);
      const retryItem = retryItems.get(message.source.id);
      progressbar?.update(progress.transferred, {
        timeleft: utils.toHumanTime(progress.eta),
        percentage: progress.percentage,
        title: message.source.title,
        speed: utils.toHumanSize(progress.speed),
        retries: retryItem?.left ?? this.getFlag<number>('retries'),
      });
    });

    scheduler.on('retry', (message: Scheduler.Message) => {
      retryItems.set(message.source.id, {
        item: message.source as ytpl.Item,
        left: message.details?.left as number,
      });
      fs.appendFileSync(
        './retry.txt',
        `item: id: ${message.source.id} title: ${message.source.title} retry ${message.details?.left as number} \n`
      );
    });

    scheduler.on('error', (message: Scheduler.Message) => {
      // this.ux.cli.warn(`item: ${message.source.title} message: ${message.error?.message}`);
      fs.appendFileSync(
        './error.txt',
        `item: id: ${message.source.id} title: ${message.source.title} message: ${message.error?.message} \n`
      );
    });

    scheduler.on('exit', (message: Scheduler.Message) => {
      const progressbar = progressbars.get(message.source.id);
      const code = message.details?.code as number;
      if (progressbar) {
        progressbar.stop();
        multibar.remove(progressbar);
      }
      // this.ux.cli.warn(`exit on thread item: ${message.source.title} message: ${message.error?.message}`);
      fs.appendFileSync(
        './exit.txt',
        `exit on thread item: ${message.source.id} title: ${message.source.title} code: ${code} \n`
      );
    });

    let results: Array<Scheduler.Result | undefined> = [];
    try {
      results = await scheduler.download();
    } catch (error) {
      this.ux.cli.warn('failed to fetch the playlist');
    } finally {
      progressbars.forEach((progressbar) => {
        progressbar.stop();
        multibar.remove(progressbar);
      });
      multibar.stop();
      const failed = results.filter((result) => Boolean(result?.code || result?.error)).length;
      const completed = results.length - failed;
      this.ux.cli.log(`finally completed: ${this.ux.chalk.green(completed)} failed: ${this.ux.chalk.red(failed)}`);
      this.ux.logJson(
        results.map((result) => {
          return {
            id: result?.item.id,
            error: result?.error,
            code: result?.code,
          };
        }) as unknown as Record<string, unknown>
      );
    }
    return;
  }

  /**
   * Generates a download url.
   *
   * @returns {string | undefined} download url
   */
  private async getDownloadUrl(): Promise<string | undefined> {
    const info = await ytdl.getInfo(this.getFlag<string>('url'));
    return info ? ytdl.chooseFormat(info.formats, this.ytdlOptions).url : undefined;
  }

  private async downloadVideo(): Promise<ytdl.videoInfo | undefined> {
    const videoInfo = await this.getVideoInfo();
    if (videoInfo) {
      this.readStream = ytdl.downloadFromInfo(videoInfo, this.ytdlOptions);
      this.readStream.on('error', this.error.bind(this));
      await this.setVideInfoAndVideoFormat();
      if (this.videoInfo && this.videoFormat) {
        this.setVideoOutput();
        if (!this.flags.json && this.isTTY()) {
          this.outputHuman();
        }
        return this.videoInfo;
      }
      return videoInfo;
    }
  }

  /**
   * Print stilized output
   *
   * @param {string} label the label for the value
   * @param {string} value the value to print
   */
  private logStyledProp(label: string, value: string): void {
    this.ux.log(`${this.ux.chalk.bold.gray(label)}: ${value}`);
  }

  /**
   * Prints video metadata information.
   *
   * @returns {void}
   */
  private printVideoMeta(): void {
    videoMeta(this.videoInfo, this.videoFormat, this.output).forEach((outputVideoMeta: IOutputVideoMeta) => {
      const { label, from } = outputVideoMeta;
      const value = utils.getValueFrom<string>(from, outputVideoMeta.path, '');
      if (!outputVideoMeta.requires) {
        if (outputVideoMeta.transformValue) {
          return this.logStyledProp(label, outputVideoMeta.transformValue(value));
        }
        return this.logStyledProp(label, value);
      }
    });
  }

  /**
   * Checks if output flag is set, it extracts the filename extension
   * and uses it to filter out format container, effectively setting/overriding the flag 'filter-container'
   * if no option is given and stdout is TTY sets the output flag equal to the video title
   *
   * @param {unknown} from an object like who's properties you need to extract
   * @param {string} path the objects path
   * @param {boolean} depends should re
   */
  private setOutput(): void {
    this.output = this.getFlag<string>('output');
    const extension = ensureArray(/(\.\w+)?$/.exec(this.output)).slice(1, 2);
    this.extension = extension.pop();

    if (this.output) {
      if (this.extension && !this.flags.quality && !this.flags['filter-container']) {
        this.flags['filter-container'] = `^${ensureString(this.extension).slice(1)}$`;
      }
    } else if (this.isTTY()) {
      this.output = '{videoDetails.title}';
    }
  }

  /**
   * Gets the ouput file fiven a file name or string template
   *
   * @returns {boolean} returns true if stdout is a terminal
   */
  private isTTY(): boolean {
    return Boolean(process.stdout.isTTY);
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
  private getOutputFile(): string {
    let output = utils.tmpl(this.output, [this.videoInfo, this.videoFormat]);
    if (!this.extension && utils.getValueFrom(this.videoFormat, 'container')) {
      output += '.' + utils.getValueFrom<string>(this.videoFormat, 'container', '');
    }
    // Parses & sanitises output filename for any illegal characters
    const parsedOutput = path.parse(output);
    output = path.format({
      dir: parsedOutput.dir,
      base: parsedOutput.base,
    });
    return output;
  }

  private getEncoderOptions(): EncoderStream.EncodeOptions | undefined {
    const format = this.getFlag<string>('format');
    if (format) {
      return {
        format,
      };
    }
  }

  /**
   * Sets videoInfo & videoFormat variables when they become available
   * though the stream
   *
   * @returns {string} output file
   */
  private setVideInfoAndVideoFormat(): Promise<{ videoInfo: ytdl.videoInfo; videoFormat: ytdl.videoFormat }> {
    return new Promise((resolve, reject) => {
      this.readStream.on('info', (videoInfo: ytdl.videoInfo, videoFormat: ytdl.videoFormat): void => {
        if (!this.videoInfo) {
          this.videoInfo = videoInfo;
        }
        if (!this.videoFormat) {
          this.videoFormat = videoFormat;
        }
        /* remove the error listener, we don't need it anymore */
        return resolve({ videoInfo, videoFormat });
      });
      this.readStream.once('error', reject);
    });
  }

  /**
   * Pipes the download stream to either a file to stdout
   * also sets the error handler function
   *
   * @returns {void}
   */
  private setVideoOutput(): fs.WriteStream | NodeJS.WriteStream {
    if (!this.output) {
      /* if we made it here we're 100% sure we're not on a TTY device */
      // process.stdout
      //   .once('close', () => {
      //     this.ux.log('output stream closed');
      //     this.readStream.unpipe(process.stdout);
      //     process.exit(0);
      //   })
      //   .once('end', () => {
      //     this.ux.log('output stream ended');
      //     this.readStream.unpipe(process.stdout);
      //     process.exit(0);
      //   })
      //   .once('error', (error) => {
      //     this.ux.log(`output stream error ${error as string}`);
      //     this.readStream.unpipe(process.stdout);
      //     process.exit(1);
      //   });
      return this.readStream.pipe(process.stdout);
    }
    /* build a proper filename */
    this.output = this.getOutputFile();
    /* stream to file */
    return this.readStream.pipe(fs.createWriteStream(this.output));
  }

  /**
   * Output human readable information about a video download
   * It handles live video too
   *
   * @returns {void}
   */
  private outputHuman(): void {
    // Print information about the video if not streaming to stdout.
    this.printVideoMeta();

    const sizeUnknown =
      !utils.getValueFrom(this.videoFormat, 'clen') &&
      (utils.getValueFrom(this.videoFormat, 'isLive') ||
        utils.getValueFrom(this.videoFormat, 'isHLS') ||
        utils.getValueFrom(this.videoFormat, 'isDashMPD'));

    if (sizeUnknown) {
      this.printLiveVideoSize(this.readStream);
    } else if (utils.getValueFrom(this.videoFormat, 'contentLength')) {
      return this.printProgress(parseInt(utils.getValueFrom(this.videoFormat, 'contentLength'), 10));
    } else {
      this.readStream.once('response', (response) => {
        if (utils.getValueFrom(response, 'headers.content-length')) {
          const size = parseInt(utils.getValueFrom(response, 'headers.content-length'), 10);
          return this.printProgress(size);
        } else {
          return this.printLiveVideoSize(this.readStream);
        }
      });
    }
  }

  /**
   * Prints size of a live video, playlist, or video format that does not
   * have a content size either in its format metadata or its headers.
   *
   * @param {Readable} readStream the download stream
   * @returns {void}
   */
  private printLiveVideoSize(readStream: Readable): void {
    let dataRead = 0;
    const updateProgress = utils.throttle(() => {
      this.ux.cursorTo(process.stdout, 0);
      this.ux.clearLine(process.stdout, 1);
      let line = `size: ${utils.toHumanSize(dataRead)}`;
      if (dataRead >= 1024) {
        line += ` (${dataRead} bytes)`;
      }
      process.stdout.write(line);
    }, 250);

    readStream.on('data', (data: Buffer) => {
      dataRead += data.length;
      updateProgress();
    });

    readStream.on('end', () => {
      this.ux.cli.log(`downloaded: ${utils.toHumanSize(dataRead)}`);
    });
  }

  /**
   * Prints progress bar as it downloads.
   *
   * @param {number} size
   * @returns {void}
   */
  private printProgress(length: number): void {
    this.progressStream = progressStream({
      length,
      time: 100,
      drain: true,
    });
    const progressbar = this.ux.progress({
      format: '[{bar}] | {percentage}% | ETA: {timeleft} | Speed: {speed}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      total: length,
    }) as SingleBar;
    progressbar.start(length, 0, {
      speed: 'N/A',
    });
    this.readStream.pipe(this.progressStream);
    this.progressStream.on('progress', (progress) => {
      progressbar.update(progress.transferred, {
        percentage: progress.percentage,
        timeleft: utils.toHumanTime(progress.eta),
        speed: utils.toHumanSize(progress.speed),
      });
    });
    this.readStream.once('end', () => {
      this.readStream.unpipe(this.progressStream);
      progressbar.stop();
    });
  }

  /**
   * Gets info from a video additional formats and deciphered URLs.
   *
   * @returns {Promise<ytdl.videoInfo | undefined>} the video info object or undefined if it fails
   */
  private async getVideoInfo(): Promise<ytdl.videoInfo> {
    return ytdl.getInfo(this.getFlag<string>('url'));
  }
}
