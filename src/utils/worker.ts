import { workerData, parentPort } from 'worker_threads';
import { EventEmitter, Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import ytdl = require('ytdl-core');
import tsNode = require('ts-node');
import * as utils from './utils';
import CreatableEventEmitter from './CreatableEventEmitter';
tsNode.register();

const a = async (videoId: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(videoId);
    }, 1000);
  });
};

export interface IDownloader {
  url: string;
  output: string;
  downloadOptions: ytdl.downloadOptions;
}

export namespace DownloadWorker {
  /**
   * Constructor options for DownloadWorker.
   */
  export interface Options {
    /**
     * Youtube url.
     */
    url: string;
    /**
     * Output file name.
     */
    output?: string;
    /**
     * Video download options.
     */
    downloadOptions?: ytdl.downloadOptions;
  }
}

class DownloadWorker extends CreatableEventEmitter<DownloadWorker.Options> {
  protected readStream!: Readable;
  private url: string;
  private output?: string;
  private videoId: string | undefined;
  private downloadOptions?: ytdl.downloadOptions;
  private videoInfo!: ytdl.videoInfo;
  private videoFormat!: ytdl.videoFormat;

  public constructor(options: DownloadWorker.Options) {
    super(options);
    this.url = options.url;
    this.videoId = utils.getYoutubeVideoId(options.url);
    this.output = options.output ?? '{videoDetails.title}';
    this.downloadOptions = options.downloadOptions;
  }

  /**
   * Initializes an instance of the Downloader class.
   */
  public async init(): Promise<void> {
    await this.downloadVideo();
  }

  private async downloadVideo(): Promise<ytdl.videoInfo | undefined> {
    const videoInfo = await this.getVideoInfo();
    if (videoInfo) {
      this.readStream = ytdl.downloadFromInfo(videoInfo, this.downloadOptions);
      this.readStream.on('error', this.error.bind(this));
      const infoAndVideoFormat = await this.setVideInfoAndVideoFormat();
      this.videoInfo = infoAndVideoFormat.videoInfo;
      this.videoFormat = infoAndVideoFormat.videoFormat;
      if (this.videoInfo && this.videoFormat) {
        this.setVideoOutput();
        return infoAndVideoFormat.videoInfo;
      }
      return videoInfo;
    }
  }

  /**
   * Pipes the download stream to either a file to stdout
   * also sets the error handler function
   *
   * @returns {void}
   */
  private setVideoOutput(): fs.WriteStream | NodeJS.WriteStream {
    /* stream to file */
    return this.readStream.pipe(fs.createWriteStream(this.getOutputFile()));
  }

  /**
   * Output human readable information about a video download
   * It handles live video too
   *
   * @returns {void}
   */
  private outputHuman(): void {
    // Print information about the video if not streaming to stdout.

    const sizeUnknown =
      !utils.getValueFrom(this.videoFormat, 'clen') &&
      (utils.getValueFrom(this.videoFormat, 'isLive') ||
        utils.getValueFrom(this.videoFormat, 'isHLS') ||
        utils.getValueFrom(this.videoFormat, 'isDashMPD'));

    if (sizeUnknown) {
      // this.printLiveVideoSize(this.readStream);
    } else if (utils.getValueFrom(this.videoFormat, 'contentLength')) {
      return this.printVideoSize(parseInt(utils.getValueFrom(this.videoFormat, 'contentLength'), 10));
    } else {
      this.readStream.once('response', (response) => {
        if (utils.getValueFrom(response, 'headers.content-length')) {
          return this.printVideoSize(parseInt(utils.getValueFrom(response, 'headers.content-length'), 10));
        } else {
          // return this.printLiveVideoSize(this.readStream);
        }
      });
    }
  }

  /**
   * Prints video size with a progress bar as it downloads.
   *
   * @param {number} size
   * @returns {void}
   */
  private printVideoSize(contentLength: number): void {
    parentPort?.postMessage({
      type: 'contentLength',
      videoId: this.videoId,
      contentLength,
    });

    this.readStream.on('data', (data: Buffer) => {
      utils.throttle(() => {
        parentPort?.postMessage({
          type: 'data',
          videoId: this.videoId,
          length: data.length,
        });
      }, 250);
    });
  }

  /**
   * Gets the ouput file fiven a file name or string template
   *
   * Templates are based on videoInfo properties for example:
   * --ouput {videoDetails.author.name} will generate a file who's name
   * will start with the video author's name
   * If no extension is given we'll use the video format container property
   *
   * @returns {string} output file
   */
  private getOutputFile(
    output: string = this.output ?? '{videoDetails.title}',
    videoInfo: ytdl.videoInfo = this.videoInfo,
    videoFormat: ytdl.videoFormat = this.videoFormat
  ): string {
    return path.format({
      name: utils.tmpl(output, [videoInfo, videoFormat]),
      ext: `.${utils.getValueFrom<string>(videoFormat, 'container', '')}`,
    });
  }

  /**
   * Sets videoInfo & videoFormat variables when they become available
   * though the stream
   *
   * @returns {string} output file
   */
  private setVideInfoAndVideoFormat(): Promise<{ videoInfo: ytdl.videoInfo; videoFormat: ytdl.videoFormat }> {
    return new Promise((resolve, reject) => {
      this.readStream.once('info', (videoInfo: ytdl.videoInfo, videoFormat: ytdl.videoFormat): void => {
        return resolve({ videoInfo, videoFormat });
      });
      this.readStream.on('error', reject);
    });
  }

  private error(error: Error): boolean {
    return this.emit('error', error);
  }

  /**
   * Gets info from a video additional formats and deciphered URLs.
   *
   * @returns {Promise<ytdl.videoInfo | undefined>} the video info object or undefined if it fails
   */
  private async getVideoInfo(): Promise<ytdl.videoInfo | undefined> {
    return await ytdl.getInfo(this.url);
  }
}

export default void (async (options: DownloadWorker.Options): Promise<DownloadWorker> => {
  return await DownloadWorker.create(options);
  // eslint-disable-next-line no-console
  console.log(options);
  // const result = await a(videoId);
  // parentPort?.postMessage({
  //   type: 'caca',
  //   videoId: result,
  // });
  // parentPort?.postMessage({
  //   type: 'length',
  //   total: 55000,
  // });
  // return result;
})(workerData as DownloadWorker.Options);
