import * as fs from 'fs';
import { PassThrough, Writable } from 'stream';
import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');
import { SingleBar } from 'cli-progress';
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
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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

describe('do not download only return source video url', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const format = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
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
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--urlonly'])
    .it('do not download only return source video url', (ctx) => {
      expect(ctx.stdout).to.deep.include(format.url);
    });
});

describe('try to retrieve vode source url but getInfo throws', () => {
  const getInfoError = new Error('GetInfoError');
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.reject(getInfoError);
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--urlonly'])
    .catch((error) => {
      expect(error).to.be.instanceof(Error);
      expect(error).to.have.property('message').and.to.include(getInfoError.message);
    })
    .it('fails while trying to return the direct video url', (ctx) => {
      expect(ctx.stdout).to.be.equal('');
    });
});

describe('try to retrieve vode source url but getInfo returns undefined', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Promise.resolve() as unknown as Promise<ytdl.videoInfo>;
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--urlonly'])
    .it('fails while trying to return the direct video url', (ctx) => {
      expect(ctx.stdout).to.be.equal('');
    });
});

describe('video download quality options', () => {
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo, options?: ytdl.downloadOptions) => {
      expect(options).to.exist;
      expect(options).to.have.property('quality');
      expect(options?.quality).to.deep.equal(['278', '299']);
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
    .command(['download', '--url', videoUrl, '--output', output, '--quality', '278,299'])
    .it('given a list of quality filters return the first available one depending on the order of importance', () => {
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
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });
});

describe('download video without an output flag', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const audioOnlyFormat = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    bitrate: 4096,
    contentLength: 4096,
    audioBitrate: 256,
  } as unknown as ytdl.videoFormat;
  const mp4Format = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 4096,
    contentLength: 4096,
    audioBitrate: 256,
  } as unknown as ytdl.videoFormat;
  const webmFormat = {
    itag: '321',
    container: 'webm',
    qualityLabel: '720p',
    codecs: 'vp9',
    bitrate: 1024,
    contentLength: 4096,
  } as unknown as ytdl.videoFormat;
  const formats = [mp4Format, webmFormat, audioOnlyFormat] as unknown as ytdl.videoFormat[];
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
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(webmFormat);
      expect(format).to.be.true;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--quality', 'highest'])
    .it('download a video filtered by quality', () => {
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
    .command(['download', '--url', videoUrl, '--output', output, '--filter', 'video'])
    .it('download a video filtered by video', () => {
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
    .command(['download', '--url', videoUrl, '--output', output, '--filter', 'videoonly'])
    .it('download a video filtered by videoonly', () => {
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
    .command(['download', '--url', videoUrl, '--output', output, '--filter', 'audio'])
    .it('download a video filtered by audio', () => {
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
    .command(['download', '--url', videoUrl, '--output', output, '--filter', 'audioonly'])
    .it('download a video filtered by audioonly', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(audioOnlyFormat);
      expect(format).to.be.true;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output, '--filter', 'video'])
    .it('download a video filtered by video', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(mp4Format);
      expect(format).to.be.true;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });
});

describe('video download custom ranges', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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

describe('download a live video with known size with contentLenght and progress with a timer', () => {
  let clock: sinon.SinonFakeTimers;
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
  let progressStub: sinon.SinonStub;
  const singleBar = {
    increment: sinon.spy(),
    start: sinon.spy(),
    stop: sinon.spy(),
  };
  let createWriteStreamStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableFileStream>;
  beforeEach(() => {
    clock = sinon.useFakeTimers();
    writeStreamStub = sinon.createStubInstance(WritableFileStream);
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').callsFake((path) => {
      expect(path).to.be.equal(output);
      return writeStreamStub as unknown as WritableFileStream;
    });
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    progressStub = sandbox.stub(UX.prototype, 'progress').callsFake((params: Record<string, unknown>): SingleBar => {
      expect(params).to.have.property('total');
      return singleBar as unknown as SingleBar;
    });
    downloadFromInfoStub = sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      process.nextTick(() => {
        stream.emit('info', ...[info, webmFormat]);
        setImmediate(() =>
          stream.emit(
            'response',
            ...[
              {
                headers: {
                  'content-length': 512,
                },
              },
            ]
          )
        );
        setImmediate(() => {
          stream.emit('data', ...[buffer]);
        });
      });
      return stream;
    });
    // progressStub = sandbox.stub(UX.prototype, 'progress').returns(SingleBar.prototype);
    logStub = sandbox.stub(UX.prototype, 'log').returns(UX.prototype);
  });
  afterEach(() => {
    clock.restore();
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output])
    .it('download a live video', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(webmFormat);
      expect(format).to.be.true;
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
      clock.tick(700);
      expect(progressStub.callCount).to.be.equal(1);
      expect(progressStub.firstCall.firstArg).to.have.property('total').to.be.a('number').an.not.to.be.equal('0');
      expect(singleBar.increment.calledOnce).to.be.true;
      expect(singleBar.start.calledOnce).to.be.true;
      clock.tick(50);
      expect(singleBar.increment.callCount).to.be.equal(2);
    });
});

describe('download a live video with known size with contentLenght and progress with a timer with a quick end', () => {
  let clock: sinon.SinonFakeTimers;
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
  const stream = new ReadableFileStream({});
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let logStub: sinon.SinonStub;
  let progressStub: sinon.SinonStub;
  const singleBar = {
    increment: sinon.spy(),
    start: sinon.spy(),
    stop: sinon.spy(),
  };
  let createWriteStreamStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableFileStream>;
  beforeEach(() => {
    clock = sinon.useFakeTimers();
    writeStreamStub = sinon.createStubInstance(WritableFileStream);
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').callsFake((path) => {
      expect(path).to.be.equal(output);
      return writeStreamStub as unknown as WritableFileStream;
    });
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    progressStub = sandbox.stub(UX.prototype, 'progress').callsFake((params: Record<string, unknown>): SingleBar => {
      expect(params).to.have.property('total');
      return singleBar as unknown as SingleBar;
    });
    downloadFromInfoStub = sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      process.nextTick(() => {
        stream.emit('info', ...[info, webmFormat]);
        setImmediate(() => {
          stream.emit(
            'response',
            ...[
              {
                headers: {
                  'content-length': 512,
                },
              },
            ]
          );
          setImmediate(() => {
            stream.emit('data', buffer);
          });
          setImmediate(() => {
            stream.emit('end');
          });
        });
      });
      return stream;
    });
    // progressStub = sandbox.stub(UX.prototype, 'progress').returns(SingleBar.prototype);
    logStub = sandbox.stub(UX.prototype, 'log').returns(UX.prototype);
  });
  afterEach(() => {
    clock.restore();
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output])
    .it('download a live video with known size with contentLenght and progress with a timer with a quick end', () => {
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(webmFormat);
      expect(format).to.be.true;
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
      clock.tick(750);
      expect(progressStub.callCount).to.be.equal(1);
      expect(progressStub.firstCall.firstArg).to.have.property('total').to.be.a('number').an.not.to.be.equal('0');
      expect(singleBar.increment.callCount).to.be.equal(1);
      expect(singleBar.start.calledOnce).to.be.true;
      clock.tick(750);
      /* will not trigger */
      expect(singleBar.increment.callCount).to.be.equal(1);
    });
});

describe('download a live video with known size with no contentLenght', () => {
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
              headers: undefined,
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
      const ytdlOptions = downloadFromInfoStub.firstCall.args[1] as ytdl.downloadOptions;
      expect(ytdlOptions.filter).to.a('function');
      const filter = ytdlOptions.filter as (format: ytdl.videoFormat) => boolean;
      const format = filter(webmFormat);
      expect(format).to.be.true;
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

describe('download a live video with size unknown', () => {
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const mp4Format = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    bitrate: 4096,
    isLive: true,
  } as unknown as ytdl.videoFormat;
  const webmFormat = {
    itag: '321',
    container: 'webm',
    codecs: 'vp9',
    bitrate: 1024,
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
  let createWriteStreamStub: sinon.SinonStub;
  let throttleStub: sinon.SinonStub;
  let cursotToStub: sinon.SinonStub;
  let clearLineStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableFileStream>;
  beforeEach(() => {
    writeStreamStub = sinon.createStubInstance(WritableFileStream);
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').callsFake((path) => {
      expect(path).to.be.equal(output);
      return writeStreamStub as unknown as WritableFileStream;
    });
    throttleStub = sinon
      .stub(utils, 'throttle')
      .callsFake(
        (callback: () => utils.ThrottledFunction<() => void>, limit: number): utils.ThrottledFunction<() => void> => {
          expect(limit).to.be.a('number');
          expect(callback).to.be.a('function');
          /* first time the throttle is called it applies the function with arg because inThrottle is initialli false */
          callback();
          return () => callback();
        }
      );
    cursotToStub = sandbox.stub(UX.prototype, 'cursorTo').callsFake((str: NodeJS.WritableStream, dir: number): UX => {
      expect(dir).to.be.a('number');
      return UX.prototype;
    });

    clearLineStub = sandbox.stub(UX.prototype, 'clearLine').callsFake((str: NodeJS.WritableStream, dir: number): UX => {
      expect(dir).to.be.a('number');
      return UX.prototype;
    });

    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      process.nextTick(() => {
        stream.emit('info', ...[info, webmFormat]);
        setImmediate(() => stream.emit('response', undefined));
        setImmediate(() => stream.emit('end'));
      });
      return stream;
    });
  });
  afterEach(() => {
    /* it's important to restore utils to it's original state because other tests might fail */
    throttleStub.restore();
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output])
    .it('download a live video with size unknown', () => {
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
      expect(throttleStub.calledOnce).to.be.true;
      expect(cursotToStub.callCount).to.be.equal(1);
      expect(clearLineStub.callCount).to.be.equal(1);
    });
});

describe('download a live video with size unknown with chunks bigger than 1024 bytes', () => {
  const output = 'MyVideo.mp4';
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghiklmnopqrstuvwxyz';
  const randomStr = (length = 5) =>
    new Array(length)
      .fill(null)
      .map(() => charset.charAt(Math.floor(Math.random() * charset.length)))
      .join('');
  const randomBuffer = Buffer.from(randomStr(1024), 'utf8');
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const mp4Format = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    bitrate: 4096,
    isLive: true,
  } as unknown as ytdl.videoFormat;
  const webmFormat = {
    itag: '321',
    container: 'webm',
    codecs: 'vp9',
    bitrate: 1024,
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
  let streamReadCalled = false;
  const stream = new ReadableFileStream({
    read() {
      if (!streamReadCalled) {
        this.push(randomBuffer);
        streamReadCalled = true;
      }
    },
  });
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let createWriteStreamStub: sinon.SinonStub;
  let throttleStub: sinon.SinonStub;
  let cursotToStub: sinon.SinonStub;
  let clearLineStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableFileStream>;
  beforeEach(() => {
    writeStreamStub = sinon.createStubInstance(WritableFileStream);
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').callsFake((path) => {
      expect(path).to.be.equal(output);
      return writeStreamStub as unknown as WritableFileStream;
    });
    throttleStub = sinon
      .stub(utils, 'throttle')
      .callsFake(
        (callback: () => utils.ThrottledFunction<() => void>, limit: number): utils.ThrottledFunction<() => void> => {
          expect(limit).to.be.a('number');
          expect(callback).to.be.a('function');
          /* first time the throttle is called it applies the function with arg because inThrottle is initialli false */
          callback();
          return () => callback();
        }
      );
    cursotToStub = sandbox.stub(UX.prototype, 'cursorTo').callsFake((str: NodeJS.WritableStream, dir: number): UX => {
      expect(dir).to.be.a('number');
      return UX.prototype;
    });

    clearLineStub = sandbox.stub(UX.prototype, 'clearLine').callsFake((str: NodeJS.WritableStream, dir: number): UX => {
      expect(dir).to.be.a('number');
      return UX.prototype;
    });

    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      process.nextTick(() => {
        stream.emit('info', ...[info, webmFormat]);
        setImmediate(() => stream.emit('response', undefined));
        setImmediate(() => stream.emit('end'));
      });
      return stream;
    });
  });
  afterEach(() => {
    /* it's important to restore utils to it's original state because other tests might fail */
    throttleStub.restore();
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--output', output])
    .it('download a live video with size unknown', () => {
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
      expect(throttleStub.calledOnce).to.be.true;
      expect(cursotToStub.callCount).to.be.equal(1);
      expect(clearLineStub.callCount).to.be.equal(1);
    });
});

describe('video download file stream', () => {
  const output = 'MyVideo.mp4';
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
      return stream;
    });
    pipeStub = sandbox.stub(stream, 'pipe').callsFake((destination: NodeJS.WritableStream) => {
      return destination;
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
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
      return stream;
    });
    pipeStub = sandbox.stub(stream, 'pipe').callsFake((destination: NodeJS.WritableStream) => {
      return destination;
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

describe('video download stdout stream', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
  let writeSocketStreamStub: sinon.SinonStubbedInstance<WritableSocketStream>;
  beforeEach(() => {
    writeSocketStreamStub = sinon.createStubInstance(WritableSocketStream);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sandbox.stub(Download.prototype, 'isTTY' as any).returns(false);
    sandbox.stub(process, 'stdout').get(() => writeSocketStreamStub);
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
    });
});

/* TODO: test is not clear the handlers of the 'end' event are not being tested */
describe('video fails to set info', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', ...[undefined, undefined]);
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
    .command(['download', '--url', videoUrl, '--json'])
    .it('video fails to set info', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(jsonResponse).to.deep.equal({ status: 0, result: videoInfo });
    });
});

describe('video download stream error handling when download is active (simulate connection break)', () => {
  /* we use fake times here because the progressbar
   * timer wont receive the error signal and therefore wont clear the timer
   */
  let clock: sinon.SinonFakeTimers;
  const streamError = new Error('StreamError');
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
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
  let errorStub: sinon.SinonStub;
  let createWriteStreamStub: sinon.SinonStub;
  let writeStreamStub: sinon.SinonStubbedInstance<WritableFileStream>;
  beforeEach(() => {
    clock = sinon.useFakeTimers();
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
      // simulate ytdl info signal then error the stream
      process.nextTick(() => {
        stream.emit('info', ...[info, format]);
        /* emit an error this NEEDS to be called on process.nextTick */
        process.nextTick(() => {
          stream.emit('error', ...[streamError]);
        });
      });
      return stream;
    });
    errorStub = sandbox.stub(UX.prototype, 'error').callsFake((...args: unknown[]) => {
      expect(args.length).to.not.be.equal(0);
      return UX.prototype;
    });
  });
  afterEach(() => {
    clock.restore();
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl])
    .catch((error) => {
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.be.instanceOf(streamError.message);
      expect(errorStub.callCount).to.be.equal(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(errorStub.firstCall.firstArg).to.deep.include(streamError.message);
      expect(createWriteStreamStub.callCount).to.be.equal(1);
    });
});

describe('test the class', () => {
  it('test class static properties', () => {
    expect(Download.id).to.be.equal('download');
    expect(Download.description).to.be.equal('download video to a file or to stdout');
    expect(Download.examples).to.deep.equal(['$ ytdl download -u https://www.youtube.com/watch?v=aqz-KE-bpKQ']);
  });
});
