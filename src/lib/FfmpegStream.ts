/*
 * @file         : worker.ts
 * @summary      : video download worker
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : downloads a video in a new worker
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 06 Dev 2021
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

import { Readable, Writable } from 'stream';
import * as ytdl from 'ytdl-core';
import * as ffmpegStatic from 'ffmpeg-static';
import * as ffmpeg from 'fluent-ffmpeg';
ffmpeg.setFfmpegPath(ffmpegStatic);

export class FfmpegStream {
  public stream: Writable;
  public ffmpegCommand: ffmpeg.FfmpegCommand;
  private audioBitrate = {
    lowest: 32,
    low: 64,
    normal: 128,
    decent: 196,
    good: 256,
    excellent: 320,
  };

  private formatCodec: FfmpegStream.FormatCodec = {
    format: {
      aac: {
        audioCodec: FfmpegStream.AudioCodec.aac,
      },
      flac: {
        audioCodec: FfmpegStream.AudioCodec.flac,
      },
      ogg: {
        audioCodec: FfmpegStream.AudioCodec.libopus,
      },
      mp3: {
        audioCodec: FfmpegStream.AudioCodec.libmp3lame,
      },
      mp4: {
        videoCodec: FfmpegStream.VideoCodec.libx264,
      },
      avi: {
        videoCodec: FfmpegStream.VideoCodec.mpeg2,
      },
      wav: {
        audioCodec: FfmpegStream.AudioCodec.pcm_mulaw,
      },
    },
  };

  public constructor(private inputSteam: Readable, private outputStream: Writable, options: FfmpegStream.Options) {
    const { encodeOptions, metadata } = options
    let encoder = ffmpeg(this.inputSteam);
    encoder = encodeOptions.videoCodec ? encoder.videoCodec(encodeOptions.videoCodec) : encoder;
    encoder = encodeOptions.audioCodec ? encoder.audioCodec(encodeOptions.audioCodec) : encoder;
    encoder = encodeOptions.audioBitrate
      ? encoder.audioBitrate(this.audioBitrate[encodeOptions.audioBitrate])
      : encoder;
    encoder = encodeOptions.format ? encoder.format(encodeOptions.format) : encoder;
    this.ffmpegCommand = encoder;
    encoder = metadata ? this.setMetadata(metadata) : encoder;
    this.stream = encoder.pipe(this.outputStream, { end: true });
  }

  private setMetadata(
    metadata: FfmpegStream.Metadata,
    encoder: ffmpeg.FfmpegCommand = this.ffmpegCommand
  ): ffmpeg.FfmpegCommand {
    const { videoId, title, author, shortDescription } = metadata.videoInfo.player_response.videoDetails;
    return encoder
      .outputOptions('-metadata', `title=${title}`)
      .outputOptions('-metadata', `author=${author}`)
      .outputOptions('-metadata', `artist=${author}`)
      .outputOptions('-metadata', `description=${shortDescription}`)
      .outputOptions('-metadata', `comment=${shortDescription}`)
      .outputOptions('-metadata', `episode_id=${videoId}`)
      .outputOptions('-metadata', 'network=YouTube');
  }
}

export namespace FfmpegStream {
  export enum AudioCodec {
    aac = 'aac',
    flac = 'flac',
    libopus = 'libopus',
    libmp3lame = 'libmp3lame',
    libvorbis = 'libvorbis',
    pcm_mulaw = 'pcm_mulaw',
  }

  export enum VideoCodec {
    gif = 'gif',
    png = 'png',
    libx264 = 'libx264',
    mpeg2 = 'mpeg2',
  }

  export enum AudioBitrate {
    lowest = 'lowest',
    low = 'low',
    normal = 'normal',
    decent = 'decent',
    good = 'gppd',
    excellent = 'excellent',
  }

  export enum Container {
    flac = 'flac',
    ogg = 'ogg',
    mp3 = 'mp3',
    mp4 = 'mp4',
    avi = 'avi',
  }

  export enum Format {
    aac = 'aac',
    flac = 'flac',
    ogg = 'ogg',
    mp3 = 'mp3',
    mp4 = 'mp4',
    webm = 'webm',
    avi = 'avi',
    wav = 'wav',
  }

  export interface FormatCodec {
    format: {
      [key in keyof typeof FfmpegStream.Format]?: {
        audioCodec?: keyof typeof FfmpegStream.AudioCodec;
        videoCodec?: keyof typeof FfmpegStream.VideoCodec;
      };
    };
  }

  export interface Metadata {
    /**
     * video info.
     */
    videoInfo: ytdl.videoInfo;
    /**
     * video format.
     */
    videoFormat: ytdl.videoFormat;
  }

  export interface EncodeOptions {
    /**
     * Set audio codec
     */
    audioCodec?: keyof typeof FfmpegStream.AudioCodec;
    /**
     * Set video codec
     */
    videoCodec?: keyof typeof FfmpegStream.VideoCodec;
    /**
     * Set audio bitrate
     */
    audioBitrate?: keyof typeof FfmpegStream.AudioBitrate;
    /**
     * Set output container
     */
    container?: keyof typeof FfmpegStream.Container;
    /**
     * Set output format
     */
    format?: keyof typeof FfmpegStream.Format;
  }

  /**
   * Constructor options for FfmpegStream.
   */
  export interface Options extends ffmpeg.FfmpegCommandOptions {
    /**
     * Media encoder options
     */
    encodeOptions: FfmpegStream.EncodeOptions;
    /**
     * Vide metadata
     */
    metadata: FfmpegStream.Metadata;
  }
}
