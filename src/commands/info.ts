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

import ytdl = require('ytdl-core');
import { get } from '@salesforce/ts-types';
import * as util from '../utils/utils';
import YtKitCommand from '../YtKitCommand';
import { flags, FlagsConfig } from '../YtKitFlags';

export default class Info extends YtKitCommand {
  public static readonly description = 'display information about a video';
  public static readonly examples = ['$ ytdl info -u https://www.youtube.com/watch?v=ABC1234'];

  public static readonly flagsConfig: FlagsConfig = {
    url: flags.string({
      char: 'u',
      description: 'Youtube video or playlist url',
      required: true,
    }),
  };

  private static readonly cache: Map<string, ytdl.videoInfo> = new Map();

  public async run(): Promise<ytdl.videoInfo | undefined> {
    await this.showVideoInfo();
    return await this.getVideoInfo();
  }

  /**
   * Prints basic video information.
   *
   * @param {videoInfo} info
   * @param {boolean} live
   * @returns {void}
   */
  public printVideoInfo(info: ytdl.videoInfo, live: boolean): void {
    this.ux.log(`title: ${info.videoDetails.title}`);
    this.ux.log(`author: ${info.videoDetails.author.name}`);
    this.ux.log(`avg rating: ${info.videoDetails.averageRating}`);
    this.ux.log(`views: ${info.videoDetails.viewCount}`);
    this.ux.log(`publish date: ${info.videoDetails.publishDate}`);
    if (!live) {
      this.ux.log(`length: ${util.toHumanTime(parseInt(info.videoDetails.lengthSeconds, 10))}`);
    }
  }

  /**
   * Prints basic video information.
   *
   * @param {Object} info
   * @param {boolean} live
   * @returns {void}
   */
  public async showVideoInfo(): Promise<void> {
    const info = await this.getVideoInfo();
    if (info) {
      this.printVideoInfo(
        info,
        info.formats.some((f) => f.isLive)
      );

      const formats = info.formats.map((format) => ({
        itag: format.itag,
        container: format.container,
        quality: format.qualityLabel || '',
        codecs: format.codecs,
        bitrate: format.qualityLabel ? util.toHumanSize(format.bitrate ?? 0) : '',
        'audio bitrate': format.audioBitrate ? `${format.audioBitrate}KB` : '',
        size: format.contentLength ? util.toHumanSize(parseInt(format.contentLength, 10) ?? 0) : '',
      }));
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      this.ux.table(formats, headers);
    }
  }

  protected getFlag<T>(flagName: string, defaultVal?: unknown): T {
    return get(this.flags, flagName, defaultVal) as T;
  }

  private async getVideoInfo(): Promise<ytdl.videoInfo | undefined> {
    const url = this.getFlag<string>('url');
    if (!Info.cache.has(url)) {
      Info.cache.set(url, await ytdl.getInfo(url));
    }
    return Info.cache.get(url);
  }
}
