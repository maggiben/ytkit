/*
 * @file         : info.ts
 * @summary      : video info command
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : displays information about a video
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

import * as ytdl from 'ytdl-core';
import { AnyJson } from '@salesforce/ts-types';
import * as utils from '../utils/utils';
import { YtKitCommand } from '../YtKitCommand';
import { flags, FlagsConfig } from '../YtKitFlags';

export interface IOutputVideoMeta {
  label: string;
  path: string;
  requires?: string | boolean | ((value: unknown) => boolean);
  transformValue?: (number: number) => string;
}

export default class Info extends YtKitCommand {
  public static id = 'info';
  public static readonly description = 'display information about a video';
  public static readonly examples = ['$ ytdl info -u https://www.youtube.com/watch?v=aqz-KE-bpKQ'];

  public static readonly flagsConfig: FlagsConfig = {
    url: flags.string({
      char: 'u',
      description: 'Youtube video or playlist url',
      required: true,
    }),
    formats: flags.boolean({
      char: 'f',
      description: 'Display available video formats',
    }),
  };

  protected videoInfo?: ytdl.videoInfo;

  public async run(): Promise<ytdl.videoInfo | string> {
    try {
      this.videoInfo = await this.getVideoInfo();
      if (this.videoInfo) {
        this.showVideoInfo();
      }
      return this.videoInfo;
    } catch (error) {
      this.ux.error(error as Error);
      throw new Error((error as Error).message);
    }
  }

  /**
   * Prepares video metadata information.
   *
   * @returns {IOutputVideoMeta[]} a collection of labels and values to print
   */
  private prepareVideoMetaBatch(): IOutputVideoMeta[] {
    return [
      {
        label: 'title',
        path: 'title',
      },
      {
        label: 'author',
        path: 'author.name',
      },
      {
        label: 'avg rating',
        path: 'averageRating',
      },
      {
        label: 'views',
        path: 'viewCount',
      },
      {
        label: 'publish date',
        path: 'publishDate',
      },
      {
        label: 'length',
        path: 'lengthSeconds',
        requires: utils.getValueFrom<ytdl.videoFormat[]>(this.videoInfo, 'formats').some((format) => format.isLive),
        transformValue: utils.toHumanTime,
      },
    ];
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
    this.prepareVideoMetaBatch().forEach((outputVideoMeta: IOutputVideoMeta) => {
      const { label } = outputVideoMeta;
      const value = utils.getValueFrom<string>(this.videoInfo, `videoDetails.${outputVideoMeta.path}`, '');
      if (!outputVideoMeta.requires) {
        if (outputVideoMeta.transformValue) {
          return this.logStyledProp(label, outputVideoMeta.transformValue(parseInt(value, 10)));
        }
        return this.logStyledProp(label, value);
      }
    });
  }

  /**
   * Prepares table rows.
   *
   * @returns {AnyJson}
   */
  private prepareTableRows(): AnyJson {
    return utils.getValueFrom<ytdl.videoFormat[]>(this.videoInfo, 'formats').map((format) => ({
      itag: utils.getValueFrom<string>(format, 'itag', ''),
      container: utils.getValueFrom<string>(format, 'container', ''),
      quality: utils.getValueFrom<string>(format, 'qualityLabel', ''),
      codecs: this.getCodec(format),
      /* istanbul ignore else */
      bitrate: utils.getValueFromMeta(format, 'bitrate', format.qualityLabel, '', utils.toHumanSize),
      'audio bitrate': utils.getValueFromMeta(format, 'audioBitrate', format.audioBitrate, '', utils.toHumanSize),
      size: utils.getValueFromMeta(format, 'contentLength', format.contentLength, '', utils.toHumanSize),
    }));
  }

  private getCodec(format: ytdl.videoFormat): string {
    return utils.getValueFrom<string>(format, 'codecs', '');
  }

  /**
   * Prints video format information.
   *
   * @param {Object} videoInfo the video info object
   * @returns {Promise<void>}
   */
  private printVideoFormats(): void {
    const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
    this.ux.table(this.prepareTableRows(), headers);
  }

  /**
   * Prints basic video information.
   *
   * @param {Object} videoInfo the video info object
   * @returns {Promise<void>}
   */
  private showVideoInfo(): void {
    if (this.flags.formats) {
      this.printVideoFormats();
    } else {
      this.printVideoMeta();
    }
  }

  /**
   * Gets info from a video additional formats and deciphered URLs.
   *
   * @returns {Promise<ytdl.videoInfo | undefined>} the video info object or undefined if it fails
   */
  private async getVideoInfo(): Promise<ytdl.videoInfo> {
    try {
      return await ytdl.getInfo(this.getFlag<string>('url'));
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }
}
