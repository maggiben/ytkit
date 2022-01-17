/*
 * @file         : getDownloadOptions.ts
 * @summary      : Get downloadOptions from flags
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : Builds downloadOptions (filter) giver a set of flags
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 01 Jan 2022
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
import { OutputFlags } from '@oclif/parser';
import { get } from '@salesforce/ts-types';

/**
 * Builds download options based on the following input flags
 *
 * @returns {ytdl.downloadOptions}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function getDownloadOptions(flags: OutputFlags<any>): ytdl.downloadOptions {
  const options: ytdl.downloadOptions = {};
  const qualityFlag = get(flags, 'quality') as string;
  const quality = /,/.test(qualityFlag) ? qualityFlag.split(',') : qualityFlag;
  const range = get(flags, 'range') as string;

  // range: A byte range in the form INT-INT that specifies part of the file to download
  if (range) {
    const ranges = range.split('-').map((r: string) => parseInt(r, 10));
    options.range = { start: ranges[0], end: ranges[1] };
  }
  // quality: Video quality to download.
  if (quality) {
    options.quality = quality;
  }

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

  // options:
  // --filter-container REGEXP      Filter in format container
  // --unfilter-container REGEXP    Filter out format container
  // --filter-resolution REGEXP     Filter in format resolution
  // --unfilter-resolution REGEXP   Filter out format resolution
  // --filter-encoding REGEXP       Filter in format encoding
  // --unfilter-encoding REGEXP     Filter out format encoding
  ['container', 'resolution:qualityLabel', 'encoding'].forEach((field) => {
    // eslint-disable-next-line prefer-const
    let [fieldName, fieldKey] = field.split(':');
    fieldKey = fieldKey || fieldName;
    let optsKey = `filter-${fieldName}`;
    const value = get(flags, optsKey) as string;
    const name = `${fieldName}=${value}`;
    if (value) {
      createFilter(name, fieldKey, value, false);
    }
    optsKey = 'un' + optsKey;
    if (get(flags, optsKey)) {
      const optsValue = get(flags, optsKey) as string;
      createFilter(name, fieldKey, optsValue, true);
    }
  });

  // Support basic ytdl-core filters manually, so that other
  // cli filters are supported when used together.
  const hasVideo = (format: ytdl.videoFormat): boolean => !!format.qualityLabel;
  const hasAudio = (format: ytdl.videoFormat): boolean => !!format.audioBitrate;

  switch (flags.filter) {
    case 'audioandvideo':
      filters.push(['audioandvideo', (format: ytdl.videoFormat): boolean => hasVideo(format) && hasAudio(format)]);
      break;
    case 'videoandaudio':
      filters.push(['videoandaudio', (format: ytdl.videoFormat): boolean => hasVideo(format) && hasAudio(format)]);
      break;
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

  options.filter = (format: ytdl.videoFormat): boolean => filters.every((filter) => filter[1](format));

  return options;
}
