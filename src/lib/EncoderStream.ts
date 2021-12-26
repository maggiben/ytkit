/*
 * @file         : worker.ts
 * @summary      : video download worker
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : downloads a video in a new worker
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

import { Readable, Writable } from 'stream';
import * as ytdl from 'ytdl-core';
import * as ffmpegStatic from 'ffmpeg-static';
import * as ffmpeg from 'fluent-ffmpeg';
import { AsyncCreatable } from '../utils/AsyncCreatable';
ffmpeg.setFfmpegPath(ffmpegStatic);

export class EncoderStream extends AsyncCreatable<EncoderStream.Options> {
  public stream!: Writable;
  public ffmpegCommand!: ffmpeg.FfmpegCommand;
  private audioBitrate = {
    lowest: 32,
    low: 64,
    normal: 128,
    decent: 196,
    good: 256,
    excellent: 320,
  };
  private formats!: ffmpeg.Formats;
  private codecs!: ffmpeg.Codecs;
  private formatCodec: EncoderStream.FormatCodec = {
    format: {
      aac: {
        audioCodec: EncoderStream.AudioCodec.aac,
      },
      flac: {
        audioCodec: EncoderStream.AudioCodec.flac,
      },
      ogg: {
        audioCodec: EncoderStream.AudioCodec.libopus,
      },
      mp3: {
        audioCodec: EncoderStream.AudioCodec.libmp3lame,
      },
      mp4: {
        videoCodec: EncoderStream.VideoCodec.libx264,
      },
      wav: {
        audioCodec: EncoderStream.AudioCodec.pcm_mulaw,
      },
      webm: {
        videoCodec: EncoderStream.VideoCodec.libvpx,
      },
    },
  };

  public constructor(private options: EncoderStream.Options) {
    super(options);
  }

  public static async getAvailableFormats(): Promise<ffmpeg.Formats> {
    return new Promise((resolve, reject) => {
      return ffmpeg.getAvailableFormats((error, formats) => {
        return error || !formats ? reject(error) : resolve(formats);
      });
    });
  }

  public static async getAvailableCodecs(): Promise<ffmpeg.Codecs> {
    return new Promise((resolve, reject) => {
      return ffmpeg.getAvailableCodecs((error, codecs) => {
        return error || !codecs ? reject(error) : resolve(codecs);
      });
    });
  }

  /**
   * Initializes an instance of the EncoderStream class.
   */
  public async init(): Promise<void> {
    this.formats = await EncoderStream.getAvailableFormats();
    this.codecs = await EncoderStream.getAvailableCodecs();
    this.encodeStream();
  }

  private encodeStream(): void {
    const { inputStream, outputStream, encodeOptions, metadata } = this.options;
    let encoder = ffmpeg().input(inputStream);
    encoder = encodeOptions.videoCodec ? encoder.videoCodec(encodeOptions.videoCodec) : encoder;
    encoder = encodeOptions.audioCodec ? encoder.audioCodec(encodeOptions.audioCodec) : encoder;
    encoder = encodeOptions.audioBitrate
      ? encoder.audioBitrate(this.audioBitrate[encodeOptions.audioBitrate])
      : encoder;
    encoder = encoder.format(encodeOptions.format);
    encoder = metadata ? this.setMetadata(metadata, encoder) : encoder;
    this.ffmpegCommand = encoder;
    this.stream = this.ffmpegCommand.pipe(outputStream, { end: true });
  }

  private setMetadata(metadata: EncoderStream.Metadata, encoder: ffmpeg.FfmpegCommand): ffmpeg.FfmpegCommand {
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

/* istanbul ignore next */
export namespace EncoderStream {
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
    libvpx = 'libvpx',
    copy = 'copy',
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

  export interface IFormats {
    [format: string]: {
      description: string;
      canDemux: boolean;
      canMux: boolean;
    };
  }

  export interface ICodecs {
    [codec: string]: {
      type: string;
      description: string;
      canDecode: boolean;
      canEncode: boolean;
      intraFrameOnly: boolean;
      isLossy: boolean;
      isLossless: boolean;
    };
  }

  export interface FormatCodec {
    format: {
      [key in keyof typeof EncoderStream.Format]?: {
        audioCodec?: keyof typeof EncoderStream.AudioCodec;
        videoCodec?: keyof typeof EncoderStream.VideoCodec;
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
    audioCodec?: keyof typeof EncoderStream.AudioCodec;
    /**
     * Set video codec
     */
    videoCodec?: keyof typeof EncoderStream.VideoCodec;
    /**
     * Set audio bitrate
     */
    audioBitrate?: keyof typeof EncoderStream.AudioBitrate;
    /**
     * Set output container
     */
    container?: keyof typeof EncoderStream.Container;
    /**
     * Set output format
     */
    format: keyof typeof EncoderStream.Format;
  }

  /**
   * Constructor options for EncoderStream.
   */
  export interface Options extends ffmpeg.FfmpegCommandOptions {
    /**
     * Input stream
     */
    inputStream: Readable;
    /**
     * Output stream
     */
    outputStream: Writable;
    /**
     * Media encoder options
     */
    encodeOptions: EncoderStream.EncodeOptions;
    /**
     * Vide metadata
     */
    metadata?: EncoderStream.Metadata;
  }
}
