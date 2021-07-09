import * as fs from 'fs';
import { PassThrough } from 'stream';
import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');
import { UX } from '../../src/Ux';
import * as util from '../../src/utils/utils';

const bufferString = 'DEADBEEF';
const buffer = Buffer.from(bufferString, 'utf8');
const passThorughStream = () => {
  let called = false;
  return new PassThrough({
    read() {
      if (!called) {
        this.push(buffer);
        called = true;
      }
    },
  });
};

class WritableFileStream extends fs.WriteStream {}

describe('video download', () => {
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
  const format = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
    contentLength: 4096,
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  const formats = [format] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title: 'My Title',
    author: {
      name: 'Author Name',
    },
    averageRating: 5,
    viewCount: 100,
    publishDate: '2021-03-05',
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let createWriteStreamStub: sinon.SinonStub;
  let logStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableFileStream>;
  beforeEach(() => {
    writeStreamStub = sinon.createStubInstance(WritableFileStream);
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').callsFake((path) => {
      expect(path).to.be.equal(output);
      return writeStreamStub as unknown as WritableFileStream;
    });
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', info, format);
        setImmediate(() => stream.emit('end'));
      });
      return stream;
    });
    logStub = sandbox.stub(UX.prototype, 'log').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--json', '--output', output])
    .it('downloads a video', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
      expect(jsonResponse).to.deep.equal({ status: 0, result: videoInfo });
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output])
    .it('downloads a video output to a file', () => {
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--json', '--output', output, '--quality', '278'])
    .it('downloads a video of a certain quality type', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
      expect(jsonResponse).to.deep.equal({ status: 0, result: videoInfo });
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--quality', '278'])
    .it('downloads a video and prints video metadata', () => {
      expect(logStub.callCount).to.equal(13);
      expect(logStub.getCall(0).args[0]).to.include(videoInfo.videoDetails.title);
      expect(logStub.getCall(1).args[0]).to.include(videoInfo.videoDetails.author.name);
      expect(logStub.getCall(2).args[0]).to.include(videoInfo.videoDetails.averageRating);
      expect(logStub.getCall(3).args[0]).to.include(videoInfo.videoDetails.viewCount);
      expect(logStub.getCall(4).args[0]).to.include(videoInfo.videoDetails.publishDate);
      // It's not live so print the video duration
      expect(logStub.getCall(5).args[0]).to.include(
        util.toHumanTime(parseInt(videoInfo.videoDetails.lengthSeconds, 10))
      );
      expect(logStub.getCall(6).args[0]).to.include(format.quality);
      expect(logStub.getCall(7).args[0]).to.include(`${util.toHumanSize(format.bitrate ?? 0)}`);
      expect(logStub.getCall(8).args[0]).to.include(format.audioBitrate);
      expect(logStub.getCall(9).args[0]).to.include(format.codecs);
      expect(logStub.getCall(10).args[0]).to.include(format.itag);
      expect(logStub.getCall(11).args[0]).to.include(format.container);
      expect(logStub.getCall(12).args[0]).to.include(output);
    });
});

describe('download video without an output flag', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
  const format = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    contentLength: 4096,
  } as unknown as ytdl.videoFormat;
  const formats = [format] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title: 'My Title',
    author: {
      name: 'Author Name',
    },
    averageRating: 5,
    viewCount: 100,
    publishDate: '2021-03-05',
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let createWriteStreamStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableFileStream>;
  beforeEach(() => {
    writeStreamStub = sinon.createStubInstance(WritableFileStream);
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').callsFake((path) => {
      expect(path).to.be.equal(`${videoDetails.title}.${format.container}`);
      return writeStreamStub as unknown as WritableFileStream;
    });
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', info, format);
        setImmediate(() => stream.emit('end'));
      });
      return stream;
    });
    sandbox.stub(UX.prototype, 'log').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });
  test
    .stdout()
    .command(['download', '--url', videoUrl])
    .it('downloads a video output', () => {
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(`${videoDetails.title}.${format.container}`);
    });
});

describe('download a video filtered by container', () => {
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
  const mp4Format = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    contentLength: 4096,
  } as unknown as ytdl.videoFormat;
  const webmFormat = {
    itag: '321',
    container: 'webm',
    qualityLabel: '720p',
    codecs: 'vp9',
    bitrate: 1024,
    contentLength: 4096,
  } as unknown as ytdl.videoFormat;
  const formats = [mp4Format, webmFormat] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title: 'My Title',
    author: {
      name: 'Author Name',
    },
    averageRating: 5,
    viewCount: 100,
    publishDate: '2021-03-05',
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let createWriteStreamStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableFileStream>;
  beforeEach(() => {
    writeStreamStub = sinon.createStubInstance(WritableFileStream);
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').callsFake((path) => {
      expect(path).to.be.equal(output);
      return writeStreamStub as unknown as WritableFileStream;
    });
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo, ytdlOptions?: ytdl.downloadOptions) => {
      expect(info).to.deep.equal(videoInfo);
      if (ytdlOptions && typeof ytdlOptions.filter == 'function') {
        const format = ytdlOptions.filter(webmFormat);
        expect(format).to.be.true;
      }
      // expect(ytdlOptions.format)
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', info, webmFormat);
        setImmediate(() => stream.emit('end'));
      });
      return stream;
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--filter-container', 'webm'])
    .it('download a video filtered by container', () => {
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });
});
