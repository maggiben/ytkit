/*
 * @file         : videoMeta.ts
 * @summary      : video metadata transformer
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : Prepares video metadata information
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 06 Dec 2021
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
import * as utils from './utils';

export declare interface IOutputVideoMeta {
  label: string;
  from?: ytdl.videoInfo | ytdl.videoFormat | Record<string, unknown>;
  path: string;
  requires?: string | boolean | ((value: unknown) => boolean);
  transformValue?: (value: string) => string;
}

/**
 * Prepares video metadata information.
 *
 * @returns {IOutputVideoMeta[]} a collection of labels and values to print
 */
export default function videoMeta(
  videoInfo: ytdl.videoInfo,
  videoFormat: ytdl.videoFormat,
  output: string
): IOutputVideoMeta[] {
  return [
    {
      label: 'title',
      from: videoInfo,
      path: 'videoDetails.title',
    },
    {
      label: 'author',
      from: videoInfo,
      path: 'videoDetails.author.name',
    },
    {
      label: 'avg rating',
      from: videoInfo,
      path: 'videoDetails.averageRating',
    },
    {
      label: 'views',
      from: videoInfo,
      path: 'videoDetails.viewCount',
    },
    {
      label: 'publish date',
      from: videoInfo,
      path: 'videoDetails.publishDate',
    },
    {
      label: 'length',
      from: videoInfo,
      path: 'videoDetails.lengthSeconds',
      requires: utils.getValueFrom<ytdl.videoFormat[]>(videoInfo, 'formats').some((format) => format.isLive),
      transformValue: (value: string): string => utils.toHumanTime(parseInt(value, 10)),
    },
    {
      label: 'quality',
      from: videoFormat,
      path: 'quality',
      requires: !utils.getValueFrom<string>(videoFormat, 'qualityLabel'),
    },
    {
      label: 'video bitrate:',
      from: videoFormat,
      path: 'bitrate',
      requires: !utils.getValueFrom<string>(videoFormat, 'qualityLabel'),
      transformValue: (value: string): string => utils.toHumanSize(parseInt(value, 10)),
    },
    {
      label: 'audio bitrate',
      from: videoFormat,
      path: 'audioBitrate',
      requires: !utils.getValueFrom<string>(videoFormat, 'audioBitrate'),
      transformValue: (value: string): string => `${value}KB`,
    },
    {
      label: 'codecs',
      from: videoFormat,
      path: 'codecs',
    },
    {
      label: 'itag',
      from: videoFormat,
      path: 'itag',
    },
    {
      label: 'container',
      from: videoFormat,
      path: 'container',
    },
    {
      label: 'output',
      from: { output },
      path: 'output',
    },
  ];
}
