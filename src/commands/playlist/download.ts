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
import { OutputArgs } from '@oclif/parser';
import ytdl = require('ytdl-core');
import * as ytpl from 'ytpl';
import * as progressStream from 'progress-stream';
import { JsonMap } from '@salesforce/ts-types';
import { SingleBar } from 'cli-progress';
import { YtKitCommand } from '../../YtKitCommand';
import { flags, FlagsConfig } from '../../YtKitFlags';
import * as utils from '../../utils/utils';
import { Scheduler } from '../../lib/scheduler';
import { EncoderStream } from '../../lib/EncoderStream';

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
    const playlistId = ytpl.validateID(this.getFlag('url')) && (await ytpl.getPlaylistID(this.getFlag('url')));
    if (playlistId) {
      await this.downloadPlaylist(playlistId);
    } else {
      throw new Error('Invalid playlist url');
    }
  }

  private async downloadPlaylist(playlistId: string): Promise<number[] | void> {
    const progressbars = new Map<string, SingleBar>();
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
      format: '[{bar}] | {percentage}% | ETA: {timeleft} | Speed: {speed} | Title: {title} ',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
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
    });

    scheduler.on('progress', (message: Scheduler.Message) => {
      interface ExtendedProgress extends progressStream.Progress {
        elapsed: string;
      }
      const progress = message.details?.progress as ExtendedProgress;
      const progressbar = progressbars.get(message.source.id);
      progressbar?.update(progress.transferred, {
        timeleft: utils.toHumanTime(progress.eta),
        percentage: progress.percentage,
        title: message.source.title,
        speed: utils.toHumanSize(progress.speed),
      });
    });

    scheduler.on('exit', (message: Scheduler.Message) => {
      const progressbar = progressbars.get(message.source.id);
      if (progressbar) {
        progressbar.stop();
        multibar.remove(progressbar);
      }
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

  private getEncoderOptions(): EncoderStream.EncodeOptions | undefined {
    const format = this.getFlag<string>('format');
    if (format) {
      return {
        format,
      };
    }
  }
}
