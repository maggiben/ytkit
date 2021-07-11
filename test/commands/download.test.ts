import * as fs from 'fs';
import { PassThrough, Writable } from 'stream';
import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');
import { UX } from '../../src/Ux';
import * as utils from '../../src/utils/utils';
import Download from '../../src/commands/download';

class WritableFileStream extends fs.WriteStream {}
class WritableSocketStream extends Writable {}

class ReadableFileStream extends PassThrough {}
const bufferString = 'DEADBEEF';
const buffer = Buffer.from(bufferString, 'utf8');
const passThorughStream = () => {
  let called = false;
  return new ReadableFileStream({
    read() {
      if (!called) {
        this.push(buffer);
        called = true;
      }
    },
    // _write(chunk: Buffer, encoding: string, callback: (error?: Error) => void) {
    //   console.log('chunk', chunk);
    //   if (chunk.toString().indexOf('a') >= 0) {
    //     callback(new Error('chunk is invalid'));
    //   } else {
    //     callback();
    //   }
    // },
  });
};

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
    lengthSeconds: 3600,
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let logStub: sinon.SinonStub;
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
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', ...[info, format]);
        setImmediate(() => stream.emit('end'));
      });
      return stream;
    });
    logStub = sandbox.stub(UX.prototype, 'log').callsFake((input: string) => {
      expect(input.length).to.not.be.equal(0);
      return UX.prototype;
    });
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
      expect(logStub.callCount).to.be.equal(13);
      [
        videoInfo.videoDetails.title,
        videoInfo.videoDetails.author.name,
        videoInfo.videoDetails.averageRating,
        videoInfo.videoDetails.viewCount,
        videoInfo.videoDetails.publishDate,
        utils.toHumanTime(parseInt(videoInfo.videoDetails.lengthSeconds, 10)),
        format.quality,
        utils.toHumanSize(format.bitrate ?? 0),
        `${format.audioBitrate}KB`,
        format.codecs,
        format.itag,
        format.container,
        output,
      ].forEach((value: string | number | undefined, index: number) => {
        expect(logStub.getCall(index).args[0]).to.include(value);
      });
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
        stream.emit('info', ...[info, format]);
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

describe('download a video using custom filters', () => {
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
  const mp4Format = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 4096,
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
  let downloadFromInfoStub: sinon.SinonStub;
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
    downloadFromInfoStub = sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      stream.setMaxListeners(stream.getMaxListeners() + 1);
      process.nextTick(() => {
        stream.emit('info', ...[info, mp4Format]);
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
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(webmFormat);
      expect(format).to.be.true;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--unfilter-container', 'webm'])
    .it('download a video un-filtered by container', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(mp4Format);
      expect(format).to.be.true;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--filter-resolution', '1080p'])
    .it('download a video filtered by resolution', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(mp4Format);
      expect(format).to.be.true;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--unfilter-resolution', '1080p'])
    .it('download a video un filtered by resolution', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(webmFormat);
      expect(format).to.be.true;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--quality', 'lowest'])
    .it('download a video filtered by quality', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      if (ytdlOptions && typeof ytdlOptions.filter == 'function') {
        const format = ytdlOptions.filter(webmFormat);
        expect(format).to.be.true;
      }
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--quality', 'highest'])
    .it('download a video filtered by quality', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      if (ytdlOptions && typeof ytdlOptions.filter == 'function') {
        const format = ytdlOptions.filter(mp4Format);
        expect(format).to.be.true;
      }
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });
});

describe('video download custom ranges', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
  const format = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'highest',
    contentLength: 4096,
    audioBitrate: 100,
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
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
    lengthSeconds: 3600,
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let downloadFromInfoStub: sinon.SinonStub;
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    downloadFromInfoStub = sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', ...[info, format]);
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
    .command(['download', '--url', videoUrl, '--range', '10-100'])
    .it('downloads a video given a certain range', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.range).to.deep.equal({ start: 10, end: 100 });
    });
});

describe('download a live video with size unknown', () => {
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
  const mp4Format = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    bitrate: 4096,
    clen: true,
    isLive: true,
  } as unknown as ytdl.videoFormat;
  const webmFormat = {
    itag: '321',
    container: 'webm',
    codecs: 'vp9',
    bitrate: 1024,
    clen: true,
    isLive: true,
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
  let logStub: sinon.SinonStub;
  let createWriteStreamStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
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
    downloadFromInfoStub = sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      process.nextTick(() => {
        stream.emit('info', ...[info, webmFormat]);
        setImmediate(() =>
          stream.emit('response', [
            {
              headers: {
                'content-length': 512,
              },
            },
          ])
        );
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
    .command(['download', '--url', videoUrl, '--output', output])
    .it('download a live video', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[2] as ytdl.downloadOptions;
      if (ytdlOptions && typeof ytdlOptions.filter == 'function') {
        const format = ytdlOptions.filter(webmFormat);
        expect(format).to.be.true;
      }
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
      expect(logStub.callCount).to.be.equal(9);
      [
        videoInfo.videoDetails.title,
        videoInfo.videoDetails.author.name,
        videoInfo.videoDetails.averageRating,
        videoInfo.videoDetails.viewCount,
        videoInfo.videoDetails.publishDate,
        webmFormat.codecs,
        webmFormat.itag,
        webmFormat.container,
        output,
      ].forEach((value: string | number, index: number) => {
        expect(logStub.getCall(index).args[0]).to.include(value);
      });
    });
});

describe('video download file stream', () => {
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
    lengthSeconds: 3600,
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let pipeStub: sinon.SinonStub;
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
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', ...[info, format]);
        setImmediate(() => stream.emit('end'));
      });
      pipeStub = sandbox.stub(stream, 'pipe').callsFake((destination: NodeJS.WritableStream) => {
        return destination;
      });
      return stream;
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--json', '--output', output])
    .it('downloads a video checks it pipes the stream to a file', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(pipeStub.callCount).to.be.equal(1);
      expect(pipeStub.firstCall.firstArg).to.be.instanceOf(WritableFileStream);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
      expect(jsonResponse).to.deep.equal({ status: 0, result: videoInfo });
    });
});

describe('video download stdout stream', () => {
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
    lengthSeconds: 3600,
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let pipeStub: sinon.SinonStub;
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
        stream.emit('info', ...[info, format]);
        setImmediate(() => stream.emit('end'));
      });
      pipeStub = sandbox.stub(stream, 'pipe').callsFake((destination: NodeJS.WritableStream) => {
        return destination;
      });
      return stream;
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--json'])
    .it('downloads a video checks it pipes the stream to a stdout', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(pipeStub.callCount).to.be.equal(1);
      expect(pipeStub.firstCall.firstArg).to.be.instanceOf(WritableFileStream);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(`${videoDetails.title}.${format.container}`);
      expect(jsonResponse).to.deep.equal({ status: 0, result: videoInfo });
    });
});

describe('video download url only', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
  const format = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'highest',
    contentLength: 4096,
    audioBitrate: 100,
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
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
    lengthSeconds: 3600,
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let pipeStub: sinon.SinonStub;
  let stdoutStub: sinon.SinonStub;
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', ...[info, format]);
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
    .command(['download', '--url', videoUrl, '--urlonly'])
    .it('return a direct video link', (ctx) => {
      expect(ctx.stdout).to.include(format.url);
    });
});

describe('video download stdout stream', () => {
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
    lengthSeconds: 3600,
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let pipeStub: sinon.SinonStub;
  let stdoutStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableSocketStream>;
  beforeEach(() => {
    writeStreamStub = sinon.createStubInstance(WritableSocketStream);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sandbox.stub(Download.prototype, 'isTTY' as any).returns(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stdoutStub = sandbox.stub(Download.prototype, 'stdout' as any).callsFake(() => {
      return writeStreamStub;
    });
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', ...[info, format]);
        setImmediate(() => stream.emit('end'));
      });
      pipeStub = sandbox.stub(stream, 'pipe').callsFake((destination: NodeJS.WritableStream) => {
        expect(destination).to.be.instanceof(WritableSocketStream);
        return destination;
      });
      return stream;
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl])
    .it('downloads a video checks it pipes the stream to a stdout', () => {
      expect(pipeStub.callCount).to.be.equal(1);
      expect(stdoutStub.callCount).to.be.equal(1);
    });
});
