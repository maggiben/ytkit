import * as fs from 'fs';
import * as path from 'path';
import { fail } from 'assert';
import { expect } from 'chai';
import * as ytdl from 'ytdl-core';
import * as ffmpeg from 'fluent-ffmpeg';
import * as utils from '../../src/utils/utils';
import { EncoderStream } from '../../src/lib/EncoderStream';

const waitForStreamEnd = (ffmpegCommand: ffmpeg.FfmpegCommand, filename: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpegCommand
      .once('end', () => {
        expect(fs.existsSync(filename)).to.be.true;
        return resolve();
      })
      .once('error', reject);
  });
};

describe('EncoderStream', () => {
  const inputDir = path.join(__dirname, '..', 'assets');
  const outputDir = path.join(__dirname, 'output');
  // const output = 'out.mp4';
  const videoFormat = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
    contentLength: 4096,
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  const formats = [videoFormat] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title: 'Big Buck Bunny',
    author: {
      name: 'Author Name',
    },
    averageRating: 5,
    viewCount: 100,
    publishDate: '2021-03-05',
    lengthSeconds: 3600,
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    // eslint-disable-next-line camelcase
    player_response: {
      videoDetails: {
        videoId: 'YE7VzlLtp',
        shortDescription: 'My Description',
        title: 'Big Buck Bunny',
        author: 'Blender',
      },
    },
    formats,
  } as unknown as ytdl.videoInfo;

  beforeEach(() => {
    fs.mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    if (utils.getNodeVersion().major < 16) {
      fs.rmdirSync(outputDir, { recursive: true });
    } else {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('streams to ffmpeg and converts to mp3', async () => {
    const getEncoderOptions = (format: EncoderStream.Format): EncoderStream.EncodeOptions => {
      return {
        format,
        audioCodec: EncoderStream.AudioCodec.libmp3lame,
        audioBitrate: EncoderStream.AudioBitrate.normal,
        container: EncoderStream.Container.mp3,
      };
    };
    const inputSteam = fs.createReadStream(path.join(inputDir, 'Big Buck Bunny.webm'));
    const outputStream = fs.createWriteStream(path.join(outputDir, 'Big Buck Bunny.mp3'));
    const encoderStreamOptions: EncoderStream.Options = {
      encodeOptions: getEncoderOptions(EncoderStream.Format.mp3),
      metadata: {
        videoInfo,
        videoFormat,
      },
      inputSteam,
      outputStream,
    };
    const encoderStream = await EncoderStream.create(encoderStreamOptions);
    expect(encoderStream).to.be.instanceOf(EncoderStream);
    try {
      const filename = path.join(outputDir, 'Big Buck Bunny.mp3');
      await waitForStreamEnd(encoderStream.ffmpegCommand, filename);
    } catch (error) {
      fail(error as Error);
    }
  });

  it('streams to ffmpeg and converts mp4 to webm', async () => {
    const getEncoderOptions = (format: EncoderStream.Format): EncoderStream.EncodeOptions => {
      return {
        format,
        videoCodec: EncoderStream.VideoCodec.libvpx,
        container: EncoderStream.Container.mp4,
      };
    };
    const inputSteam = fs.createReadStream(path.join(inputDir, 'Big Buck Bunny.mp4'));
    const outputStream = fs.createWriteStream(path.join(outputDir, 'Big Buck Bunny.webm'));
    const encoderStreamOptions: EncoderStream.Options = {
      encodeOptions: getEncoderOptions(EncoderStream.Format.webm),
      metadata: {
        videoInfo,
        videoFormat,
      },
      inputSteam,
      outputStream,
    };
    const encoderStream = await EncoderStream.create(encoderStreamOptions);
    expect(encoderStream).to.be.instanceOf(EncoderStream);
    try {
      const filename = path.join(outputDir, 'Big Buck Bunny.webm');
      await waitForStreamEnd(encoderStream.ffmpegCommand, filename);
    } catch (error) {
      fail(error as Error);
    }
  });
});
