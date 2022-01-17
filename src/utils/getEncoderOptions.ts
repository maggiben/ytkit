/*
 * @file         : getEncoderOptions.ts
 * @summary      : Get getEncoderOptions from flags
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : Builds downloadOptions (filter) giver a set of flags
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 16 Jan 2022
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

import { OutputFlags } from '@oclif/parser';
import { get } from '@salesforce/ts-types';

/**
 * Builds EncodeOptions options based on the input flags
 *
 * @returns {EEncodeOptions}
 */

enum Options {
  format = 'format',
  audioCodec = 'audioCodec',
  videoCodec = 'videoCodec',
  videoBitrate = 'videoBitrate',
  audioBitrate = 'audioBitrate',
}

export type EncodeOptions = { [key in keyof typeof Options]: string | number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function getEncoderOptions(flags: OutputFlags<any>): EncodeOptions | undefined {
  const entries = Object.entries({
    format: get(flags, 'format') as string,
    audioCodec: get(flags, 'audioCodec') as string,
    videoCodec: get(flags, 'videoCodec') as string,
    videoBitrate: get(flags, 'videoBitrate') as number,
    audioBitrate: get(flags, 'audioBitrate') as number,
  }).filter((option) => Boolean(option[1]));

  return entries.length ? (Object.fromEntries(entries) as EncodeOptions) : undefined;
}
