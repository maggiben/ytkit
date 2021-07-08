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
import * as util from '../utils/utils';
import { YtKitCommand } from '../YtKitCommand';
import { flags, FlagsConfig } from '../YtKitFlags';
import { getValueFrom } from '../utils/utils';

export default class Info extends YtKitCommand {
  public static readonly description = 'display information about a video';
  public static readonly examples = ['$ ytdl info -u https://www.youtube.com/watch?v=ABC1234'];

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

  public async run(): Promise<ytdl.videoInfo | undefined> {
    const videoInfo = await this.getVideoInfo();
    await this.showVideoInfo(videoInfo);
    return videoInfo;
  }

  /**
   * Prints video metadata information.
   *
   * @param {videoInfo} info
   * @param {boolean} live
   * @returns {void}
   */
  private printVideoMeta(videoInfo: ytdl.videoInfo, live: boolean): void {
    this.ux.log(`title: ${videoInfo.videoDetails.title}`);
    this.ux.log(`author: ${videoInfo.videoDetails.author.name}`);
    this.ux.log(`avg rating: ${videoInfo.videoDetails.averageRating}`);
    this.ux.log(`views: ${videoInfo.videoDetails.viewCount}`);
    this.ux.log(`publish date: ${videoInfo.videoDetails.publishDate}`);
    if (!live) {
      this.ux.log(`length: ${util.toHumanTime(parseInt(videoInfo.videoDetails.lengthSeconds, 10))}`);
    }
  }

  /**
   * Prints video format information.
   *
   * @param {Object} videoInfo the video info object
   * @returns {Promise<void>}
   */
  private printVideoFormats(videoInfo: ytdl.videoInfo): void {
    const result = videoInfo.formats.map((format) => ({
      itag: getValueFrom<string>(format, 'itag', ''),
      container: getValueFrom<string>(format, 'container', ''),
      quality: getValueFrom<string>(format, 'qualityLabel', ''),
      codecs: getValueFrom<string>(format, 'codecs'),
      bitrate: this.getValueFromMeta(format, 'bitrate', format.qualityLabel, '', util.toHumanSize),
      'audio bitrate': this.getValueFromMeta(
        format,
        'audioBitrate',
        format.audioBitrate,
        '',
        (audioBitrate: string) => `${audioBitrate}KB`
      ),
      size: this.getValueFromMeta(format, 'contentLength', format.contentLength, '', (contentLength: string) =>
        util.toHumanSize(parseInt(contentLength, 10))
      ),
    }));
    const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
    this.ux.table(result, headers);
  }

  private getValueFromMeta<T>(
    from: unknown,
    path: string,
    depends?: unknown,
    defaultValue?: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform?: (input: any) => T
  ): T | undefined {
    if (depends) {
      if (transform) {
        return transform(getValueFrom<T>(from, path, defaultValue));
      }
      return getValueFrom<T>(from, path, defaultValue);
    }
    return defaultValue as T | undefined;
  }

  /**
   * Prints basic video information.
   *
   * @param {Object} videoInfo the video info object
   * @returns {Promise<void>}
   */
  private async showVideoInfo(videoInfo?: ytdl.videoInfo): Promise<void> {
    const info = videoInfo ?? (await this.getVideoInfo());
    if (info) {
      if (this.flags.formats) {
        this.printVideoFormats(info);
      } else {
        this.printVideoMeta(
          info,
          info.formats.some((f) => f.isLive)
        );
      }
    }
  }

  /**
   * Gets info from a video additional formats and deciphered URLs.
   *
   * @returns {Promise<ytdl.videoInfo | undefined>} the video info object or undefined if it fails
   */
  private async getVideoInfo(): Promise<ytdl.videoInfo | undefined> {
    return await ytdl.getInfo(this.flags.url);
  }
}
