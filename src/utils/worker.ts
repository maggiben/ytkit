import { workerData, parentPort } from 'worker_threads';
import { Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import ytdl = require('ytdl-core');
import * as ytpl from 'ytpl';
import tsNode = require('ts-node');
import * as progressStream from 'progress-stream';
import * as utils from './utils';
import { AsyncCreatable } from './AsyncCreatable';
tsNode.register();

export namespace DownloadWorker {
  /**
   * Constructor options for DownloadWorker.
   */
  export interface Options {
    /**
     * Playlist item.
     */
    item: ytpl.Item;
    /**
     * Output file name.
     */
    output?: string;
    /**
     * Video download options.
     */
    downloadOptions?: ytdl.downloadOptions;
  }

  export interface Message {
    type: string;
    item: ytpl.Item;
    error: Error;
    details: Record<string, unknown>;
  }
}

class DownloadWorker extends AsyncCreatable<DownloadWorker.Options> {
  protected readStream!: Readable;
  private item: ytpl.Item;
  private output?: string;
  private videoId: string | undefined;
  private downloadOptions?: ytdl.downloadOptions;
  private videoInfo!: ytdl.videoInfo;
  private videoFormat!: ytdl.videoFormat;

  public constructor(options: DownloadWorker.Options) {
    super(options);
    this.item = options.item;
    this.videoId = utils.getYoutubeVideoId(this.item.shortUrl);
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
        this.reporter();
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
  private reporter(): void {
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
    const strPrgs = progressStream({
      length: contentLength,
      time: 100,
      drain: true,
    });

    parentPort?.postMessage({
      type: 'contentLength',
      item: this.item,
      details: {
        contentLength,
      },
    });

    this.readStream.pipe(strPrgs);

    strPrgs.on('progress', (progress) => {
      parentPort?.postMessage({
        type: 'progress',
        item: this.item,
        details: {
          progress,
        },
      });
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
      this.readStream.once('error', reject);
    });
  }

  private error(error: Error): void {
    parentPort?.postMessage({
      type: 'error',
      item: this.item,
      error,
    });
  }

  /**
   * Gets info from a video additional formats and deciphered URLs.
   *
   * @returns {Promise<ytdl.videoInfo | undefined>} the video info object or undefined if it fails
   */
  private async getVideoInfo(): Promise<ytdl.videoInfo | undefined> {
    return await ytdl.getInfo(this.item.shortUrl);
  }
}

export default void (async (options: DownloadWorker.Options): Promise<DownloadWorker> => {
  return await DownloadWorker.create(options);
})(workerData as DownloadWorker.Options);
