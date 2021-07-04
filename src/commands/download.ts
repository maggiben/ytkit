import { Readable } from 'stream';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { Command, flags as flagsConfig } from '@oclif/command';
import { OutputArgs, OutputFlags } from '@oclif/parser';
import cli from 'cli-ux';
import StreamSpeed = require('streamspeed');
import ytdl = require('ytdl-core');
import { ensureString, get, JsonMap } from '@salesforce/ts-types';
import { SingleBar } from '@types/cli-progress';
import * as util from '../utils/utils';

export interface IFlags {
  url: string;
  quality: string;
  filter: string;
  range: string;
  ['filter-container']: string;
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
    const context = this;
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
  public static readonly description = 'download';
  public static readonly examples = [
    `$ ytdl download 
hello world from ./src/hello.ts!
`,
  ];

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  public static readonly flags = {
    help: flagsConfig.help({ char: 'h' }),
    url: flagsConfig.string({
      char: 'u',
      description: 'Youtube video or playlist url',
      required: true,
    }),
    quality: flagsConfig.string({
      char: 'q',
      description: 'Video quality to download, default: highest',
    }),
    filter: flagsConfig.enum({
      description: 'Can be video, videoonly, audio, audioonly',
      options: ['video', 'videoonly', 'audio', 'audioonly'],
    }),
    range: flagsConfig.string({
      char: 'r',
      description: 'Byte range to download, ie 10355705-12452856',
    }),
    'filter-container': flagsConfig.string({
      description: 'Filter in format container',
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
    info: flagsConfig.boolean({
      description: 'Print video info without downloading',
    }),
  };

  // The parsed args for easy reference by this command; assigned in init
  protected args!: OutputArgs<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  // The parsed varargs for easy reference by this command
  protected varargs?: JsonMap;
  protected readStream!: Readable;
  protected ytdlOptions!: ytdl.downloadOptions;
  // The parsed flags for easy reference by this command; assigned in init
  protected flags!: OutputFlags<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  protected output!: string;
  protected extension?: string;
  // protected readonly stdoutMutable: boolean = Boolean(
  //   process.stdout && process.stdout.cursorTo && process.stdout.clearLine
  // );

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

    this.setOutput(this.flags.output);

    cli.styledObject(this.flags);

    if (this.flags.urlonly) {
      cli.log(await this.getDownloadUrl());
      process.exit(0);
    }

    if (this.flags.info) {
      await this.showVideoInfo();
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
      cli.log(`length: ${util.toHumanTime(parseInt(info.videoDetails.lengthSeconds, 10))}`);
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
        'audio bitrate': format.audioBitrate ? `${format.audioBitrate}KB` : '',
        size: format.contentLength ? util.toHumanSize(parseInt(format.contentLength, 10) ?? 0) : '',
      }));
      cli.table(formats, {
        itag: {},
        container: {},
        quality: {},
        codecs: {},
        bitrate: {},
        'audio bitrate': {},
        size: {},
      });
    }
  }

  protected getFlag<T>(flagName: string, defaultVal?: unknown): T {
    return get(this.flags, flagName, defaultVal) as T;
  }

  private setOutput(output: string): void {
    this.output = output;
    const regexp = new RegExp(/(\.\w+)?$/);
    this.extension = regexp
      .exec(output ?? '')
      ?.slice(1, 2)
      .pop();

    if (output) {
      if (this.extension && !this.flags.quality && !this.flags['filter-container']) {
        this.flags['filter-container'] = `^${this.extension.slice(1)}$`;
      }
    } else if (process.stdout.isTTY) {
      this.output = '{videoDetails.title}';
    }
  }

  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   */
  private buildDownloadOptions(): ytdl.downloadOptions {
    const options: ytdl.downloadOptions = {};
    const qualityFlag = this.getFlag<string>('quality');
    const isMultiple = /,/.test(qualityFlag);
    const quality = isMultiple ? qualityFlag.split(',') : qualityFlag;

    const range = this.getFlag<string>('range');
    if (range) {
      const ranges = range.split('-').map((r: string) => parseInt(r, 10));
      options.range = { start: ranges[0], end: ranges[1] };
    }
    return {
      ...options,
      quality,
    };
  }

  private setListeners(readStream: Readable): void {
    const onError = (error: Error): void => this.onError(error);

    readStream.on('info', (info: ytdl.videoInfo, format: ytdl.videoFormat) => {
      if (!this.flags.output) {
        readStream.pipe(process.stdout).on('error', onError);
        return;
      }

      let output = util.tmpl(this.output, [info, format]);
      if (!this.extension && format.container) {
        output += '.' + format.container;
      }
      // Parses & sanitises output filename for any illegal characters
      const parsedOutput = path.parse(output);
      output = path.format({
        dir: parsedOutput.dir,
        base: parsedOutput.base,
      });

      readStream.pipe(fs.createWriteStream(output)).on('error', onError);

      // Print information about the video if not streaming to stdout.
      this.printVideoInfo(info, format.isLive);

      const sizeUnknown = !('clen' in format) && (format.isLive || format.isHLS || format.isDashMPD);

      if (sizeUnknown) {
        this.printLiveVideoSize(readStream);
      } else if (format.contentLength) {
        this.printVideoSize(readStream, parseInt(format.contentLength, 10));
      } else {
        readStream.once('response', (response) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (response.headers['content-length']) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const size = parseInt(response.headers['content-length'], 10);
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
  private printLiveVideoSize(readStream: Readable): void {
    let dataRead = 0;
    const updateProgress = throttle(() => {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 1);
      let line = `size: ${util.toHumanSize(dataRead)}`;
      if (dataRead >= 1024) {
        line += ` (${dataRead} bytes)`;
      }
      process.stdout.write(line);
    }, 250);

    readStream.on('data', (data) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dataRead += data.length;
      updateProgress();
    });

    readStream.on('end', () => {
      cli.log(`downloaded: ${util.toHumanSize(dataRead)}`);
    });
  }

  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   */
  private printVideoSize(readStream: Readable, size: number): void {
    const bar: SingleBar = cli.progress({
      format: '[{bar}] {percentage}% | Speed: {speed}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      total: size,
    }) as SingleBar;
    bar.start(size, 0);
    const streamSpeed = new StreamSpeed();
    streamSpeed.add(readStream);
    // Keep track of progress.
    const getSpeed = (): { speed: string } => ({
      speed: StreamSpeed.toHuman(streamSpeed.getSpeed(), { timeUnit: 's', precision: 3 }),
    });

    readStream.on('data', (data) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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

  private onError(error: Error): void {
    cli.error(error.message);
    process.exit(1);
  }
}
