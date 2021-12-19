import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import * as ytdl from 'ytdl-core';
import { FfmpegStream } from '../../src/lib/FfmpegStream';

describe('FfmpegStream', () => {
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
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('streams to ffmpeg and converts to mp3', (done) => {
    const getEncoderOptions = (format: FfmpegStream.Format): FfmpegStream.EncodeOptions => {
      return {
        format,
        audioCodec: FfmpegStream.AudioCodec.libmp3lame,
        audioBitrate: FfmpegStream.AudioBitrate.normal,
        container: FfmpegStream.Container.mp3,
      };
    };
    const ffmpegStreamOptions: FfmpegStream.Options = {
      encodeOptions: getEncoderOptions(FfmpegStream.Format.mp3),
      metadata: {
        videoInfo,
        videoFormat,
      },
    };
    const readStream = fs.createReadStream(path.join(inputDir, 'Big Buck Bunny.webm'));
    const outputStream = fs.createWriteStream(path.join(outputDir, 'Big Buck Bunny.mp3'));
    const ffmpegStream = new FfmpegStream(readStream, outputStream, ffmpegStreamOptions);
    expect(ffmpegStream).to.be.instanceOf(FfmpegStream);
    ffmpegStream.ffmpegCommand
      .once('end', () => {
        expect(fs.existsSync(path.join(outputDir, 'Big Buck Bunny.mp3'))).to.be.true;
        done();
      })
      .once('error', done);
  });

  it('streams to ffmpeg and converts mp4 to webm', (done) => {
    const getEncoderOptions = (format: FfmpegStream.Format): FfmpegStream.EncodeOptions => {
      return {
        format,
        videoCodec: FfmpegStream.VideoCodec.libvpx,
        container: FfmpegStream.Container.mp4,
      };
    };
    const ffmpegStreamOptions: FfmpegStream.Options = {
      encodeOptions: getEncoderOptions(FfmpegStream.Format.webm),
    };
    const readStream = fs.createReadStream(path.join(inputDir, 'Big Buck Bunny.mp4'));
    const outputStream = fs.createWriteStream(path.join(outputDir, 'Big Buck Bunny.webm'));
    const ffmpegStream = new FfmpegStream(readStream, outputStream, ffmpegStreamOptions);
    expect(ffmpegStream).to.be.instanceOf(FfmpegStream);
    // const files = fs.readdirSync(outputDir, { withFileTypes: true });
    // ffmpegStream.ffmpegCommand.on('progress', e => console.log(e))
    ffmpegStream.ffmpegCommand
      .once('end', () => {
        expect(fs.existsSync(path.join(outputDir, 'Big Buck Bunny.webm'))).to.be.true;
        done();
      })
      .once('error', done);
  });
});
