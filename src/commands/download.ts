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
import { OutputArgs, OutputFlags } from '@oclif/parser';
import StreamSpeed = require('streamspeed');
import ytdl = require('ytdl-core');
import { get, JsonMap } from '@salesforce/ts-types';
import { SingleBar } from 'cli-progress';
import YtKitCommand from '../YtKitCommand';
import { flags, FlagsConfig } from '../YtKitFlags';
import * as util from '../utils/utils';

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

export interface IFilter {
  [name: string]: (format: Record<string, string>) => boolean;
}

export default class Download extends YtKitCommand {
  // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
  public static readonly description = 'download video';
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
      description: 'Filter out format resolution',
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

  public async run(): Promise<void> {
    this.ytdlOptions = this.buildDownloadOptions();

    this.setFilters();
    this.setOutput(this.flags.output);

    this.ux.styledObject(this.flags);

    if (this.flags.urlonly) {
      const url = await this.getDownloadUrl();
      if (url) {
        this.ux.cli.url(url, url);
      }
      process.exit(0);
    }

    this.readStream = ytdl(this.flags.url, this.ytdlOptions ?? {});
    this.setListeners(this.readStream);
  }

  public async getDownloadUrl(): Promise<string | undefined> {
    if (this.flags?.url) {
      const info = await ytdl.getInfo(this.flags?.url);
      return ytdl.chooseFormat(info.formats, this.ytdlOptions ?? {}).url;
    }
    return;
  }

  /**
   * Prints basic video information.
   *
   * @param {Object} info
   * @param {boolean} live
   */
  public printVideoInfo(info: ytdl.videoInfo, live: boolean): void {
    this.ux.log(`title: ${info.videoDetails.title}`);
    this.ux.log(`author: ${info.videoDetails.author.name}`);
    this.ux.log(`avg rating: ${info.videoDetails.averageRating}`);
    this.ux.log(`views: ${info.videoDetails.viewCount}`);
    if (!live) {
      this.ux.log(`length: ${util.toHumanTime(parseInt(info.videoDetails.lengthSeconds, 10))}`);
    }
  }

  protected getFlag<T>(flagName: string, defaultVal?: unknown): T {
    return get(this.flags, flagName, defaultVal) as T;
  }

  private setOutput(output: string): void {
    this.output = output;
    const regexp = new RegExp(/(\.\w+)?$/);
    this.extension = regexp
      .exec(output ?? '')
      ?.slice(1, 2)
      .pop();

    if (output) {
      if (this.extension && !this.flags.quality && !this.flags['filter-container']) {
        this.flags['filter-container'] = `^${this.extension.slice(1)}$`;
      }
    } else if (process.stdout.isTTY) {
      this.output = '{videoDetails.title}';
    }
  }

  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
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

  private setListeners(readStream: Readable): void {
    const onError = (error: Error): void => this.onError(error);

    readStream.on('info', (info: ytdl.videoInfo, format: ytdl.videoFormat) => {
      if (!this.flags.output) {
        readStream.pipe(process.stdout).on('error', onError);
        return;
      }

      let output = util.tmpl(this.output, [info, format]);
      if (!this.extension && format.container) {
        output += '.' + format.container;
      }
      // Parses & sanitises output filename for any illegal characters
      const parsedOutput = path.parse(output);
      output = path.format({
        dir: parsedOutput.dir,
        base: parsedOutput.base,
      });

      readStream.pipe(fs.createWriteStream(output)).on('error', onError);

      // Print information about the video if not streaming to stdout.
      this.printVideoInfo(info, format.isLive);

      const sizeUnknown = !('clen' in format) && (format.isLive || format.isHLS || format.isDashMPD);

      if (sizeUnknown) {
        this.printLiveVideoSize(readStream);
      } else if (format.contentLength) {
        this.printVideoSize(readStream, parseInt(format.contentLength, 10));
      } else {
        readStream.once('response', (response) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (response.headers['content-length']) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const size = parseInt(response.headers['content-length'], 10);
            this.printVideoSize(readStream, size);
          } else {
            this.printLiveVideoSize(readStream);
          }
        });
      }
    });
  }

  private setFilters(): void {
    // Create filters.
    // ((format: Record<string, string>) => boolean))
    const filters: Array<[string, (format: ytdl.videoFormat) => boolean]> = [];

    /**
     * @param {string} name
     * @param {string} field
     * @param {string} regexpStr
     * @param {boolean|undefined} negated
     */
    const createFilter = (name: string, field: string, regexpStr: string, negated?: boolean): void => {
      const regexp = new RegExp(regexpStr, 'i');
      // (format: Record<string, string>): boolean => Boolean(negated !== regexp.test(format[field])),
      filters.push([
        name,
        (format: ytdl.videoFormat): boolean =>
          Boolean(negated !== regexp.test(format[field as keyof ytdl.videoFormat] as string)),
      ]);
    };

    ['container', 'resolution:qualityLabel', 'encoding'].forEach((field) => {
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

    this.ytdlOptions.filter = (format: ytdl.videoFormat): boolean => {
      return filters.every((filter) => filter[1](format));
    };

    this.ux.styledObject(this.ytdlOptions as Record<string, unknown>);
  }

  /**
   * Prints size of a live video, playlist, or video format that does not
   * have a content size either in its format metadata or its headers.
   */
  private printLiveVideoSize(readStream: Readable): void {
    let dataRead = 0;
    const updateProgress = util.throttle(() => {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 1);
      let line = `size: ${util.toHumanSize(dataRead)}`;
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
      this.ux.log(`downloaded: ${util.toHumanSize(dataRead)}`);
    });
  }

  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   */
  private printVideoSize(readStream: Readable, size: number): void {
    const bar = this.ux.cli.progress({
      format: '[{bar}] {percentage}% | Speed: {speed}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      total: size,
    }) as SingleBar;
    bar.start(size, 0);
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

  private onError(error: Error): void {
    this.ux.error(error.message);
    process.exit(1);
  }
}
