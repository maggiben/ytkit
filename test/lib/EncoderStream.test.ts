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
    title: 'Caminandes 3- Llamigos',
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
        videoId: 'SkVqJ1SGeL0',
        shortDescription: 'My Description',
        title: 'Caminandes 3- Llamigos',
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
      };
    };
    const inputStream = fs.createReadStream(path.join(inputDir, 'Caminandes 3- Llamigos.webm'));
    const outputStream = fs.createWriteStream(path.join(outputDir, 'Caminandes 3- Llamigos.mp3'));
    const encoderStreamOptions: EncoderStream.Options = {
      encodeOptions: getEncoderOptions(EncoderStream.Format.mp3),
      metadata: {
        videoInfo,
        videoFormat,
      },
      inputStream,
      outputStream,
    };
    const encoderStream = await EncoderStream.create(encoderStreamOptions);
    expect(encoderStream).to.be.instanceOf(EncoderStream);
    try {
      const filename = path.join(outputDir, 'Caminandes 3- Llamigos.mp3');
      await waitForStreamEnd(encoderStream.ffmpegCommand, filename);
    } catch (error) {
      fail(error as Error);
    }
  });
});
