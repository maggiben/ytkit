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
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { OutputArgs } from '@oclif/parser';
import StreamSpeed = require('streamspeed');
import ytdl = require('ytdl-core');
import { JsonMap } from '@salesforce/ts-types';
import { SingleBar } from 'cli-progress';
import { YtKitCommand } from '../YtKitCommand';
import { flags, FlagsConfig } from '../YtKitFlags';
import * as utils from '../utils/utils';
import { UX } from '../Ux';

export interface IFlags {
  url: string;
  quality: string;
  filter: string;
  range: string;
  ['filter-container']: string;
  begin: string;
  urlonly: boolean;
  output: string;
  name: string;
  force: boolean;
}

declare interface IOutputVideoMeta {
  label: string;
  from: Record<string, unknown>;
  path: string;
  log: (...args: string[]) => UX;
  requires?: string | boolean | ((value: unknown) => boolean);
  transformValue?: <T>(value: T) => T;
  defaultValue?: unknown;
}

export interface IFilter {
  [name: string]: (format: Record<string, string>) => boolean;
}

export default class Download extends YtKitCommand {
  public static readonly description = 'download video to a file or to stdout';
  public static readonly examples = ['$ ytdl download -u '];
  public static readonly flagsConfig: FlagsConfig = {
    help: flags.help({ char: 'h' }),
    url: flags.string({
      char: 'u',
      description: 'Youtube video or playlist url',
      required: true,
    }),
    quality: flags.string({
      char: 'q',
      description: 'Video quality to download, default: highest',
    }),
    filter: flags.enum({
      description: 'Can be video, videoonly, audio, audioonly',
      options: ['video', 'videoonly', 'audio', 'audioonly'],
    }),
    range: flags.string({
      char: 'r',
      description: 'Byte range to download, ie 10355705-12452856',
    }),
    'filter-container': flags.string({
      description: 'Filter in format container',
    }),
    'filter-resolution': flags.string({
      description: 'Filter in format resolution',
    }),
    'unfilter-container': flags.string({
      description: 'Filter out format container',
    }),
    'unfilter-resolution': flags.string({
      description: 'Filter out format container',
    }),
    begin: flags.string({
      char: 'b',
      description: 'Time to begin video, format by 1:30.123 and 1m30s',
    }),
    urlonly: flags.boolean({
      description: 'Print direct download URL',
    }),
    output: flags.string({
      char: 'o',
      description: 'Save to file, template by {prop}, default: stdout or {title}',
    }),
  };

  // The parsed args for easy reference by this command; assigned in init
  protected args!: OutputArgs<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  // The parsed varargs for easy reference by this command
  protected varargs?: JsonMap;
  protected readStream!: Readable;
  protected ytdlOptions!: ytdl.downloadOptions;
  // The parsed flags for easy reference by this command; assigned in init
  protected output!: string;
  protected extension?: string;

  // video info
  protected videoInfo?: ytdl.videoInfo;
  // video format
  protected videoFormat?: ytdl.videoFormat;

  public async run(): Promise<ytdl.videoInfo | undefined> {
    this.ytdlOptions = this.buildDownloadOptions();

    this.setFilters();
    this.setOutput();

    if (this.flags.urlonly) {
      const url = await this.getDownloadUrl();
      if (url) {
        this.ux.cli.url(url, url);
      }
      process.exit(0);
    }

    const videoInfo = await this.getVideoInfo();
    if (videoInfo) {
      this.readStream = ytdl.downloadFromInfo(videoInfo, this.ytdlOptions);
      await this.setVideInfoAndVideoFormat();
      if (this.videoInfo && this.videoFormat) {
        this.setVideoOutput();
        if (!this.flags.json && this.flags.output) {
          this.outputHuman();
        }
        return this.videoInfo;
      }
      process.exitCode = 1;
    }
  }

  /**
   * Generates a download url
   *
   * @returns {void}
   */
  public async getDownloadUrl(): Promise<string | undefined> {
    if (this.flags?.url) {
      const info = await ytdl.getInfo(this.flags?.url);
      return ytdl.chooseFormat(info.formats, this.ytdlOptions ?? {}).url;
    }
    return;
  }

  /**
   * Prints video metadata information.
   *
   * @returns {void}
   */
  private printVideoMeta(): void {
    this.prepareVideoMetaBatch().forEach((outputVideoMeta: IOutputVideoMeta) => {
      const label = outputVideoMeta.label;
      const value = utils.getValueFrom<string>(
        outputVideoMeta.from,
        outputVideoMeta.path,
        outputVideoMeta.defaultValue
      );
      if (outputVideoMeta.requires) {
        if (outputVideoMeta.transformValue) {
          return outputVideoMeta.log(label, outputVideoMeta.transformValue(value));
        }
        return outputVideoMeta.log(label, value);
      }
    });
  }

  /**
   * Prints video metadata information.
   *
   * @returns {IOutputVideoMeta[]} a collection of labels and values to print
   */
  private prepareVideoMetaBatch(): IOutputVideoMeta[] {
    const batch = [
      {
        label: 'title',
        from: this.videoInfo,
        path: 'videoDetails.title',
        log: this.logStyledProp.bind(this),
        requires: true,
        defaultValue: '',
      },
      {
        label: 'author',
        from: this.videoInfo,
        path: 'videoDetails.author.name',
        log: this.logStyledProp.bind(this),
        requires: true,
        defaultValue: '',
      },
      {
        label: 'avg rating',
        from: this.videoInfo,
        path: 'videoDetails.averageRating',
        log: this.logStyledProp.bind(this),
        defaultValue: '',
      },
      {
        label: 'views',
        from: this.videoInfo,
        path: 'videoDetails.viewCount',
        log: this.logStyledProp.bind(this),
        requires: true,
        defaultValue: '',
      },
      {
        label: 'publish date',
        from: this.videoInfo,
        path: 'videoDetails.publishDate',
        log: this.logStyledProp.bind(this),
        requires: true,
        defaultValue: '',
      },
      {
        label: 'length',
        from: this.videoInfo,
        path: 'videoDetails.lengthSeconds',
        log: this.logStyledProp.bind(this),
        requires: !utils.getValueFrom<ytdl.videoFormat[]>(this.videoInfo, 'formats').some((format) => format.isLive),
        transformValue: (value: string): string => utils.toHumanTime(parseInt(value, 10)),
        defaultValue: '',
      },
      {
        label: 'quality',
        from: this.videoFormat,
        path: 'quality',
        log: this.logStyledProp.bind(this),
        requires: utils.getValueFrom<string>(this.videoFormat, 'qualityLabel'),
        defaultValue: '',
      },
      {
        label: 'video bitrate:',
        from: this.videoFormat,
        path: 'bitrate',
        log: this.logStyledProp.bind(this),
        requires: utils.getValueFrom<string>(this.videoFormat, 'qualityLabel'),
        transformValue: (value: string): string => utils.toHumanSize(parseInt(value, 10)),
        defaultValue: '',
      },
      {
        label: 'audio bitrate',
        from: this.videoFormat,
        path: 'audioBitrate',
        log: this.logStyledProp.bind(this),
        requires: utils.getValueFrom<string>(this.videoFormat, 'audioBitrate'),
        transformValue: (value: string): string => `${value}KB`,
        defaultValue: '',
      },
      {
        label: 'codecs',
        from: this.videoFormat,
        path: 'codecs',
        log: this.logStyledProp.bind(this),
        requires: true,
        defaultValue: '',
      },
      {
        label: 'itag',
        from: this.videoFormat,
        path: 'itag',
        log: this.logStyledProp.bind(this),
        requires: true,
        defaultValue: '',
      },
      {
        label: 'container',
        from: this.videoFormat,
        path: 'container',
        log: this.logStyledProp.bind(this),
        requires: true,
      },
      {
        label: 'output',
        from: this,
        path: 'output',
        log: this.logStyledProp.bind(this),
        requires: true,
      },
    ] as unknown[] as IOutputVideoMeta[];
    return batch;
  }

  private logStyledProp(label: string, value: string): void {
    this.ux.log(`${this.ux.chalk.bold.gray(label)}: ${value}`);
  }

  /**
   * Builds download options based on the following input flags
   * quality: Video quality to download.
   * range: A byte range in the form INT-INT that specifies part of the file to download
   *
   * @returns {@link ytdl.downloadOptions} the downalod options
   */
  private buildDownloadOptions(): ytdl.downloadOptions {
    const options: ytdl.downloadOptions = {};
    const qualityFlag = this.getFlag<string>('quality');
    const isMultiple = /,/.test(qualityFlag);
    const quality = isMultiple ? qualityFlag.split(',') : qualityFlag;

    const range = this.getFlag<string>('range');
    if (range) {
      const ranges = range.split('-').map((r: string) => parseInt(r, 10));
      options.range = { start: ranges[0], end: ranges[1] };
    }
    return {
      ...options,
      quality,
    };
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
    const regexp = new RegExp(/(\.\w+)?$/);
    this.extension = regexp
      .exec(this.output ?? '')
      ?.slice(1, 2)
      .pop();

    if (this.output) {
      if (this.extension && !this.flags.quality && !this.flags['filter-container']) {
        this.flags['filter-container'] = `^${this.extension.slice(1)}$`;
      }
    } else if (process.stdout.isTTY) {
      this.output = '{videoDetails.title}';
    }
  }

  /**
   * Gets the ouput file fiven a file name or string template
   *
   * @returns {string} output file
   */
  private getOutputFile(): string {
    let output = utils.tmpl(this.output, [this.videoInfo, this.videoFormat]);
    if (!this.extension && this.videoFormat?.container) {
      output += '.' + this.videoFormat?.container;
    }
    // Parses & sanitises output filename for any illegal characters
    const parsedOutput = path.parse(output);
    output = path.format({
      dir: parsedOutput.dir,
      base: parsedOutput.base,
    });
    return output;
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
        return resolve({ videoInfo, videoFormat });
      });
      this.readStream.on('error', (error) => {
        return reject(error);
      });
    });
  }

  /**
   * Pipes the download stream to either a file to stdout
   * also sets the error handler function
   *
   * @returns {void}
   */
  private setVideoOutput(): void {
    const onError = (error: Error): void => this.onError(error);
    if (!this.output) {
      this.readStream.pipe(process.stdout).on('error', onError);
    } else {
      this.output = this.getOutputFile();
      this.readStream.pipe(fs.createWriteStream(this.output)).on('error', onError);
    }
    return;
  }

  /**
   * Output human readable information about a video download
   * It handles live video too
   *
   * @returns {void}
   */
  private outputHuman(): void {
    // Print information about the video if not streaming to stdout.
    try {
      this.printVideoMeta();
    } catch (error) {
      this.ux.cli.log(error);
    }

    const sizeUnknown =
      !utils.getValueFrom(this.videoFormat, 'clen') &&
      (utils.getValueFrom(this.videoFormat, 'isLive') ||
        utils.getValueFrom(this.videoFormat, 'isHLS') ||
        utils.getValueFrom(this.videoFormat, 'isDashMPD'));

    if (sizeUnknown) {
      this.printLiveVideoSize(this.readStream);
    } else if (utils.getValueFrom(this.videoFormat, 'contentLength')) {
      this.printVideoSize(this.readStream, parseInt(utils.getValueFrom(this.videoFormat, 'contentLength'), 10));
    } else {
      this.readStream.once('response', (response) => {
        if (utils.getValueFrom(response, 'headers.content-length')) {
          const size = parseInt(utils.getValueFrom(response, 'headers.content-length'), 10);
          this.printVideoSize(this.readStream, size);
        } else {
          this.printLiveVideoSize(this.readStream);
        }
      });
    }
  }

  /**
   * Sets the filter options
   *
   * @returns {void}
   */
  private setFilters(): void {
    // Create filters.
    const filters: Array<[string, (format: ytdl.videoFormat) => boolean]> = [];

    /**
     * @param {string} name
     * @param {string} field
     * @param {string} regexpStr
     * @param {boolean|undefined} negated
     */
    const createFilter = (name: string, field: string, regexpStr: string, negated?: boolean): void => {
      const regexp = new RegExp(regexpStr, 'i');
      filters.push([
        name,
        (format: ytdl.videoFormat): boolean =>
          Boolean(negated !== regexp.test(format[field as keyof ytdl.videoFormat] as string)),
      ]);
    };

    ['container', 'resolution:qualityLabel'].forEach((field) => {
      // eslint-disable-next-line prefer-const
      let [fieldName, fieldKey] = field.split(':');
      fieldKey = fieldKey || fieldName;
      let optsKey = `filter-${fieldName}`;
      const value = this.getFlag<string>(optsKey);
      const name = `${fieldName}=${value}`;
      if (this.getFlag<string>(optsKey)) {
        createFilter(name, fieldKey, value, false);
      }
      optsKey = 'un' + optsKey;
      if (this.getFlag<string>(optsKey)) {
        createFilter(name, fieldKey, value, true);
      }
    });

    // Support basic ytdl-core filters manually, so that other
    // cli filters are supported when used together.
    const hasVideo = (format: ytdl.videoFormat): boolean => !!format.qualityLabel;
    const hasAudio = (format: ytdl.videoFormat): boolean => !!format.audioBitrate;

    switch (this.flags.filter) {
      case 'video':
        filters.push(['video', hasVideo]);
        break;
      case 'videoonly':
        filters.push(['videoonly', (format: ytdl.videoFormat): boolean => hasVideo(format) && !hasAudio(format)]);
        break;
      case 'audio':
        filters.push(['audio', hasAudio]);
        break;
      case 'audioonly':
        filters.push(['audioonly', (format: ytdl.videoFormat): boolean => !hasVideo(format) && hasAudio(format)]);
        break;
    }

    this.ytdlOptions.filter = (format: ytdl.videoFormat): boolean => filters.every((filter) => filter[1](format));
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
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 1);
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
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   * @returns {void}
   */
  private printVideoSize(readStream: Readable, size: number): void {
    const bar = this.ux.cli.progress({
      format: '[{bar}] {percentage}% | Speed: {speed}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      total: size,
    }) as SingleBar;
    bar.start(size, 0, {
      speed: 'N/A',
    });
    const streamSpeed = new StreamSpeed();
    streamSpeed.add(readStream);
    // Keep track of progress.
    const getSpeed = (): { speed: string } => ({
      speed: StreamSpeed.toHuman(streamSpeed.getSpeed(), { timeUnit: 's', precision: 3 }),
    });

    readStream.on('data', (data: Buffer) => {
      bar.increment(data.length, getSpeed());
    });

    // Update speed every second, in case download is rate limited,
    // which is the case with `audioonly` formats.
    const iid = setInterval(() => {
      bar.increment(0, getSpeed());
    }, 1000);

    readStream.on('end', () => {
      bar.stop();
      clearInterval(iid);
    });
  }

  /**
   * Gets info from a video additional formats and deciphered URLs.
   *
   * @returns {Promise<ytdl.videoInfo | undefined>} the video info object or undefined if it fails
   */
  private async getVideoInfo(): Promise<ytdl.videoInfo | undefined> {
    return await ytdl.getInfo(this.flags.url);
  }

  /**
   * Error handler
   *
   * @param {Error} error the error
   * @returns {void}
   */
  private onError(error: Error): void {
    this.ux.error(error.message);
    process.exit(1);
  }
}
