import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { Command, flags as flagsConfig } from '@oclif/command';
import { OutputArgs, OutputFlags } from '@oclif/parser';
import cli from 'cli-ux';
import StreamSpeed = require('streamspeed');
import ytdl = require('ytdl-core');
import { ensureString, AnyJson, Dictionary, get, isBoolean, JsonMap, Optional } from '@salesforce/ts-types';
import * as util from '../util';

export interface IFlags {
  url: string;
  quality: string;
  filter: string;
  range: string;
  begin: string;
  urlonly: boolean;
  output: string;
  name: string;
  force: boolean;
}

export interface IFilter {
  [name: string]: (format: Record<string, string>) => boolean;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThrottledFunction<T extends (...args: any) => any> = (...args: Parameters<T>) => ReturnType<T>;

/**
 * Creates a throttled function that only invokes the provided function (`func`) at most once per within a given number of milliseconds
 * (`limit`)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any) => any>(func: T, limit: number): ThrottledFunction<T> {
  let inThrottle: boolean;
  let lastResult: ReturnType<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (this: any, ...args): ReturnType<T> {
    if (!inThrottle) {
      inThrottle = true;

      setTimeout(() => (inThrottle = false), limit);

      lastResult = func.apply(context, args);
    }

    return lastResult;
  };
}
const sleep = async (delay: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => {
      return resolve();
    }, delay);
  });

export default class Download extends Command {
  // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
  protected get statics(): typeof Download {
    return this.constructor as typeof Download;
  }
  public static description = 'download';
  public static examples = [
    `$ ytdl download 
hello world from ./src/hello.ts!
`,
  ];

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  public static flags = {
    help: flagsConfig.help({ char: 'h' }),
    url: flagsConfig.string({
      char: 'u',
      description: 'Youtube video or playlist url',
      required: true,
    }),
    quality: flagsConfig.string({
      char: 'q',
      description: 'Video quality to download, default: highest',
      default: 'highest',
    }),
    filter: flagsConfig.enum({
      description: 'Can be video, videoonly, audio, audioonly',
      options: ['video', 'videoonly', 'audio', 'audioonly'],
    }),
    range: flagsConfig.string({
      char: 'r',
      description: 'Byte range to download, ie 10355705-12452856',
    }),
    begin: flagsConfig.string({
      char: 'b',
      description: 'Time to begin video, format by 1:30.123 and 1m30s',
    }),
    urlonly: flagsConfig.boolean({
      description: 'Print direct download URL'
    }),
    output: flagsConfig.string({
      char: 'o',
      description: 'Save to file, template by {prop}, default: stdout or {title}',
    }),
    name: flagsConfig.string({
      char: 'n',
      description: 'name to print',
    }),
    force: flagsConfig.boolean({
      char: 'f',
    }),
  };

  // The parsed args for easy reference by this command; assigned in init
  protected args!: OutputArgs<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  // The parsed varargs for easy reference by this command
  protected varargs?: JsonMap;
  protected readStream?: Readable;
  protected ytdlOptions?: ytdl.downloadOptions;
  // The parsed flags for easy reference by this command; assigned in init
  protected flags!: OutputFlags<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  public async run(): Promise<void> {
    // Turn off strict parsing if varargs are set.  Otherwise use static strict setting.
    const strict = this.varargs ? !this.varargs : this.statics.strict;

    const { args, flags } = this.parse({
      flags: this.statics.flags,
      args: this.statics.args,
      strict,
    });
    this.flags = flags;
    this.args = args;

    if (this.flags.urlonly) {
      cli.log(await this.getDownloadUrl());
      process.exit(0);
    }

    this.ytdlOptions = this.buildDownloadOptions();
    this.readStream = ytdl(this.flags.url, this.ytdlOptions ?? {});
    this.setListeners(this.readStream);
  }

  public async getDownloadUrl(): Promise<string | undefined> {
    if (this.flags?.url) {
      const info = await ytdl.getInfo(this.flags?.url);
      return ytdl.chooseFormat(info.formats, this.ytdlOptions ?? {}).url;
    }
    return;
  }

  /**
   * Prints basic video information.
   *
   * @param {Object} info
   * @param {boolean} live
   */
  public printVideoInfo(info: ytdl.videoInfo, live: boolean): void {
    cli.log(`title: ${info.videoDetails.title}`);
    cli.log(`author: ${info.videoDetails.author.name}`);
    cli.log(`avg rating: ${info.videoDetails.averageRating}`);
    cli.log(`views: ${info.videoDetails.viewCount}`);
    if (!live) {
      // cli.log('length: ') + util.toHumanTime(info.videoDetails.lengthSeconds));
    }
  }

  /**
   * Prints basic video information.
   *
   * @param {Object} info
   * @param {boolean} live
   */
  public async showVideoInfo(): Promise<void> {
    if (this.flags?.url) {
      const info = await ytdl.getInfo(this.flags?.url);
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
        // 'audio bitrate': format.audioBitrate ? format.audioBitrate + 'KB' : '',
        // size: format.contentLength ? util.toHumanSize(format.contentLength) : '',
      }));
      console.log('FORMATES', formats);
    }
    return;
  }

  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   */
  private buildDownloadOptions(): ytdl.downloadOptions {
    const options: ytdl.downloadOptions = {};
    const quality = /,/.test(this.flags.quality) ? this.flags.quality.split(',') : this.flags.quality;
    if (this.flags?.range) {
      const ranges = this.flags?.range.split('-').map((range: string) => parseInt(range, 10));
      options.range = { start: ranges[0], end: ranges[1] };
    }
    return {
      ...options,
      quality,
    };
  }

  private setListeners(readStream: Readable) {
    const onError = (error: Error): void => this.onError(error);

    readStream.on('info', (info, format) => {
      if (!this.flags.output) {
        readStream.pipe(process.stdout).on('error', onError);
        return;
      }

      // output = util.tmpl(output, [info, format]);
      // if (!ext && format.container) {
      //   output += '.' + format.container;
      // }

      let output = this.flags.output ?? 'myvide.mp4';

      // Parses & sanitises output filename for any illegal characters
      const parsedOutput = path.parse(output);
      output = path.format({
        dir: parsedOutput.dir,
        base: parsedOutput.base,
      });

      readStream.pipe(fs.createWriteStream(output)).on('error', onError);

      // Print information about the video if not streaming to stdout.
      this.printVideoInfo(info, format.isLive);

      // Print format information.
      // console.log(label('itag: ') + format.itag);
      // console.log(label('container: ') + format.container);
      if (format.qualityLabel) {
        // console.log(label('quality: ') + format.qualityLabel);
        // console.log(label('video bitrate: ') + util.toHumanSize(format.bitrate));
      }
      if (format.audioBitrate) {
        // console.log(label('audio bitrate: ') + format.audioBitrate + 'KB');
      }
      // console.log(label('codecs: ') + format.codecs);
      // console.log(label('output: ') + output);

      // Print an incremental size if format size is unknown.
      const sizeUnknown = !format.clen && (format.isLive || format.isHLS || format.isDashMPD);

      if (sizeUnknown) {
        this.printLiveVideoSize(readStream);
      } else if (format.contentLength) {
        this.printVideoSize(readStream, parseInt(format.contentLength, 10));
      } else {
        readStream.once('response', (res) => {
          if (res.headers['content-length']) {
            const size = parseInt(res.headers['content-length'], 10);
            this.printVideoSize(readStream, size);
          } else {
            this.printLiveVideoSize(readStream);
          }
        });
      }
    });
  }

  private init(): string[] {
    // Create filters.
    // ((format: Record<string, string>) => boolean))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any[] = [];

    /**
     * @param {string} name
     * @param {string} field
     * @param {string} regexpStr
     * @param {boolean|undefined} negated
     */
    const createFilter = (name: string, field: string, regexpStr: string, negated?: boolean) => {
      const regexp = new RegExp(regexpStr, 'i');
      filters.push([name, (format: Record<string, string>): boolean => negated !== regexp.test(format[field])]);
    };

    // ['container', 'resolution:qualityLabel', 'encoding'].forEach((field) => {
    //   // eslint-disable-next-line prefer-const
    //   let [fieldName, fieldKey] = field.split(':');
    //   fieldKey = fieldKey || fieldName;
    //   let optsKey = 'filter' + fieldName[0].toUpperCase() + fieldName.slice(1);
    //   const value = this.options[optsKey];
    //   let name = `${fieldName}=${value}`;
    //   if (opts[optsKey]) {
    //     createFilter(name, fieldKey, value, false);
    //   }
    //   optsKey = 'un' + optsKey;
    //   if (opts[optsKey]) {
    //     createFilter(name, fieldKey, value, true);
    //   }
    // });

    // Support basic ytdl-core filters manually, so that other
    // cli filters are supported when used together.
    // const hasVideo = (format) => !!format.qualityLabel;
    // const hasAudio = (format) => !!format.audioBitrate;

    // switch (this.flags.filter) {
    //   case 'video':
    //     filters.push(['video', hasVideo]);
    //     break;
    //   case 'videoonly':
    //     filters.push(['videoonly', (format) => hasVideo(format) && !hasAudio(format)]);
    //     break;
    //   case 'audio':
    //     filters.push(['audio', hasAudio]);
    //     break;
    //   case 'audioonly':
    //     filters.push(['audioonly', (format) => !hasVideo(format) && hasAudio(format)]);
    //     break;
    // }

    // this.ytdlOptions.filter = (format) => {
    //   return filters.every(filter => filter[1](format));
    // };
  }

  /**
   * Prints size of a live video, playlist, or video format that does not
   * have a content size either in its format metadata or its headers.
   */
  private printLiveVideoSize(readStream: Readable) {
    let dataRead = 0;
    const updateProgress = throttle(() => {
      let line = `size: ${util.toHumanSize(dataRead)}`;
      if (dataRead >= 1024) {
        line += ` (${dataRead} bytes)`;
      }
      process.stdout.write(line);
    }, 500);

    readStream.on('data', (data) => {
      dataRead += data.length;
      updateProgress();
    });

    readStream.on('end', () => {
      cli.log(`downloaded: ${util.toHumanSize(dataRead)}`);
    });
  };
  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   */
  private printVideoSize(readStream: Readable, size?: number): void {
    const bar = cli.progress({
      format: '[{bar}] {percentage}% | Speed: {speed}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      total: size,
    });
    bar.start(size);
    const streamSpeed = new StreamSpeed();
    streamSpeed.add(readStream);
    // Keep track of progress.
    const getSpeed = (): { speed: string } => ({
      speed: StreamSpeed.toHuman(streamSpeed.getSpeed(), { timeUnit: 's', precision: 3 }),
    });

    readStream.on('data', (data) => {
      bar.increment(data.length, getSpeed());
    });

    // Update speed every second, in case download is rate limited,
    // which is the case with `audioonly` formats.
    const iid = setInterval(() => {
      bar.increment(0, getSpeed());
    }, 1000);

    readStream.on('end', () => {
      bar.stop();
      clearInterval(iid);
    });
  }

  private onError(error: Error) {
    cli.error(error.message);
    process.exit(1);
  }
}
