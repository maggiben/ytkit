/*
 * @file         : playlist.ts
 * @summary      : playlist download command
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : downloads a all playlist videos given a playlist url
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

import * as ytpl from 'ytpl';
import { JsonArray } from '@salesforce/ts-types';
import * as progressStream from 'progress-stream';
import { SingleBar } from 'cli-progress';
import { YtKitCommand, YtKitResult } from '../../YtKitCommand';
import { flags, FlagsConfig } from '../../YtKitFlags';
import { utils, getEncoderOptions } from '../../utils';
import { Scheduler } from '../../lib/scheduler';
import { EncoderStream } from '../../lib/EncoderStream';

export default class Playlist extends YtKitCommand {
  public static id = 'download:playlist';
  public static readonly description = 'download a youtube playlist';
  public static readonly examples = [
    '$ ytdl download:playlist -u https://www.youtube.com/playlist?list=PL6B3937A5D230E335',
  ];
  public static readonly result: YtKitResult = {
    tableColumnData: ['title', 'author', 'duration', 'id'],
  };
  public static readonly flagsConfig: FlagsConfig = {
    url: flags.string({
      char: 'u',
      description: 'Youtube playlist url',
      required: true,
    }),
    quality: flags.string({
      description: 'Video quality to download, default: highest can use ITAG',
    }),
    filter: flags.enum({
      description: 'Can be video, videoonly, audio, audioonly',
      options: ['audioandvideo', 'videoandaudio', 'video', 'videoonly', 'audio', 'audioonly'],
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

  protected tableColumnData = ['title', 'author:{author.name}', 'duration', 'id'];

  public async run(): Promise<JsonArray | Array<Scheduler.Result | undefined>> {
    const playlistId = ytpl.validateID(this.getFlag('url')) && (await ytpl.getPlaylistID(this.getFlag('url')));
    if (playlistId) {
      const results = await this.downloadPlaylist(playlistId);
      return this.getRows(results);
    }
    throw new Error('Invalid playlist url');
  }

  private async downloadPlaylist(playlistId: string): Promise<Array<Scheduler.Result | undefined>> {
    const progressbars = new Map<string, SingleBar>();
    const scheduler = new Scheduler({
      playlistId,
      playlistOptions: {
        gl: 'US',
        hl: 'en',
        limit: Infinity,
      },
      output: this.getFlag<string>('output'),
      maxconnections: this.getFlag<number>('maxconnections'),
      retries: this.getFlag<number>('retries'),
      flags: this.flags,
      encoderOptions: getEncoderOptions(this.flags) as EncoderStream.EncodeOptions,
    });

    this.ux.cli.action.start('Retrieving playlist contents', this.ux.chalk.yellow('loading'), { stdout: true });

    const multibar = new this.ux.multibar({
      clearOnComplete: true,
      hideCursor: true,
      format: '[{bar}] | {percentage}% | ETA: {timeleft} | Speed: {speed} | Title: {title} ',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    scheduler
      .once('playlistItems', (message: Scheduler.Message) => {
        const length = (message.details?.playlistItems as ytpl.Item[])?.length;
        this.ux.cli.action.stop(`total items: ${this.ux.chalk.yellow(length)}`);
      })
      .on('contentLength', (message: Scheduler.Message) => {
        const progressBar = multibar.create(message.details?.contentLength as number, 0, {
          timeleft: 'N/A',
          percentage: '0',
          title: message.source.title,
          speed: utils.toHumanSize(0),
          elapsed: utils.toHumanTime(0),
          retries: this.getFlag<number>('retries'),
        });
        progressbars.set(message.source.id, progressBar);
      })
      .on('end', (message: Scheduler.Message) => {
        const progressbar = progressbars.get(message.source.id);
        if (progressbar) {
          progressbar.stop();
          multibar.remove(progressbar);
        }
      })
      .on('timeout', (message: Scheduler.Message) => {
        const progressbar = progressbars.get(message.source.id);
        if (progressbar) {
          progressbar.stop();
          multibar.remove(progressbar);
        }
      })
      .on('exit', (message: Scheduler.Message) => {
        const progressbar = progressbars.get(message.source.id);
        if (progressbar) {
          progressbar.stop();
          multibar.remove(progressbar);
        }
      })
      .on('progress', (message: Scheduler.Message) => {
        const progress = message.details?.progress as progressStream.Progress;
        const progressbar = progressbars.get(message.source.id);
        progressbar?.update(progress.transferred, {
          timeleft: utils.toHumanTime(progress.eta),
          percentage: progress.percentage,
          title: message.source.title,
          speed: utils.toHumanSize(progress.speed),
        });
      });

    let results: Array<Scheduler.Result | undefined> = [];
    try {
      results = await scheduler.download();
      progressbars.forEach((progressbar) => {
        progressbar.stop();
        multibar.remove(progressbar);
      });
      multibar.stop();
      const failed = results.filter((result) => Boolean(result?.code || result?.error)).length;
      const completed = results.length - failed;
      this.ux.cli.log(`completed: ${this.ux.chalk.green(completed)} failed: ${this.ux.chalk.red(failed)}`);
      return results;
    } catch (error) {
      this.ux.cli.warn('failed to fetch the playlist');
      throw error;
    }
  }

  /**
   * get table rows
   *
   * @returns {Array<Record<string, string>>} an array of rows that contains the records
   */
  private getRows(results: Array<Scheduler.Result | undefined>): Array<Record<string, string>> {
    const items = results.filter((result) => {
      return Boolean(result && result.item && !(result.code || result.error));
    }) as Scheduler.Result[];
    return items.map((result) => {
      return this.tableColumnData.reduce((column, current) => {
        const [label, template] = current.split(':');
        if (template) {
          const value = template.replace(/\{([\w.-]+)\}/g, (match: string, prop: string) => {
            return utils.getValueFrom<string>(result.item, prop);
          });
          return {
            ...column,
            [label]: value,
          };
        }
        return {
          ...column,
          [label]: utils.getValueFrom<string>(result.item, label),
        };
      }, {});
    });
  }
}
