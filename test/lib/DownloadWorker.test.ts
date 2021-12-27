import * as workerThreads from 'worker_threads';
import * as fs from 'fs';
import { PassThrough } from 'stream';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as ytpl from 'ytpl';
import * as ytdl from 'ytdl-core';
import { DownloadWorker } from '../../src/lib/DownloadWorker';

class WritableFileStream extends fs.WriteStream {}

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
  });
};

describe('DownloadWorker', () => {
  const title = 'My Title';
  const container = 'mp4';
  const output = `${title}.${container}`;
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const format = {
    itag: '123',
    container,
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
    contentLength: 4096,
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  const formats = [format] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title,
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
  const writeStreamStub = sinon.createStubInstance(WritableFileStream);
  let createWriteStreamStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let exitStub: sinon.SinonStub;
  beforeEach(() => {
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').withArgs(output).returns(writeStreamStub);
    getInfoStub = sandbox.stub(ytdl, 'getInfo').withArgs(videoUrl).resolves(videoInfo);
    downloadFromInfoStub = sandbox
      .stub(ytdl, 'downloadFromInfo')
      .withArgs(videoInfo)
      .callsFake((info: ytdl.videoInfo) => {
        expect(info).to.deep.equal(videoInfo);
        // simulate ytdl info signal then end the stream
        process.nextTick(() => {
          stream.emit('info', ...[info, format]);
          setImmediate(() => stream.emit('end'));
        });
        return stream;
      });
    exitStub = sandbox
      .stub(process, 'exit')
      .withArgs(0)
      .returns(undefined as never);
    sandbox.stub(workerThreads, 'parentPort').get(() => {
      return {
        on: sinon.spy(),
        postMessage: sinon.spy(),
      };
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('DownloadWorker downloads and saves a video', async () => {
    const downloadWorkerOptions: DownloadWorker.Options = {
      item: {
        title: 'MyVideo',
        index: 1,
        id: 'aqz-KE-bpKQ',
        shortUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        author: {
          name: 'Blender',
          url: 'https://www.youtube.com/c/blander',
          channelID: '1234',
        },
      } as ytpl.Item,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    expect(downloadWorker).to.have.keys([
      'contentLength',
      'downloadOptions',
      'encoderOptions',
      'item',
      'output',
      'outputStream',
      'progress',
      'progressStream',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });
});

describe('DownloadWorker receives kill message', () => {
  const title = 'My Title';
  const container = 'mp4';
  const output = `${title}.${container}`;
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const format = {
    itag: '123',
    container,
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
    contentLength: 4096,
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  const formats = [format] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title,
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
  const writeStreamStub = sinon.createStubInstance(WritableFileStream);
  let createWriteStreamStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let exitStub: sinon.SinonStub;
  const parentPortStub = {
    on: sandbox.stub().callsFake((event: string, listener: (message: string) => void) => {
      if (event === 'message') {
        const killMessage = Buffer.from(JSON.stringify({ type: 'kill' })).toString('base64');
        return listener(killMessage);
      }
      return;
    }),
    postMessage: sandbox.stub().callsFake((value: Record<string, unknown>) => {
      expect(value).to.have.keys(['type', 'source', 'error']);
    }),
  };

  beforeEach(() => {
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').withArgs(output).returns(writeStreamStub);
    getInfoStub = sandbox.stub(ytdl, 'getInfo').withArgs(videoUrl).resolves(videoInfo);
    downloadFromInfoStub = sandbox
      .stub(ytdl, 'downloadFromInfo')
      .withArgs(videoInfo)
      .callsFake((info: ytdl.videoInfo) => {
        expect(info).to.deep.equal(videoInfo);
        // simulate ytdl info signal then end the stream
        process.nextTick(() => {
          stream.emit('info', ...[info, format]);
          setImmediate(() => stream.emit('end'));
        });
        return stream;
      });
    exitStub = sandbox
      .stub(process, 'exit')
      .withArgs(1)
      .returns(undefined as never);
    sandbox.stub(workerThreads, 'parentPort').get(() => {
      return parentPortStub;
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('DownloadWorker downloads sends kill messages', async () => {
    const downloadWorkerOptions: DownloadWorker.Options = {
      item: {
        title: 'MyVideo',
        index: 1,
        id: 'aqz-KE-bpKQ',
        shortUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        author: {
          name: 'Blender',
          url: 'https://www.youtube.com/c/blander',
          channelID: '1234',
        },
      } as ytpl.Item,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.greaterThanOrEqual(1);
    expect(exitStub.firstCall.firstArg).to.equal(1);
    expect(downloadWorker).to.have.keys(['downloadOptions', 'encoderOptions', 'item', 'output', 'timeout']);
  });
});

describe('DownloadWorker receives undecodable message', () => {
  const title = 'My Title';
  const container = 'mp4';
  const output = `${title}.${container}`;
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const format = {
    itag: '123',
    container,
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
    contentLength: 4096,
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  const formats = [format] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title,
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
  const writeStreamStub = sinon.createStubInstance(WritableFileStream);
  let createWriteStreamStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let exitStub: sinon.SinonStub;
  const parentPortStub = {
    on: sandbox.stub().callsFake((event: string, listener: (message: string) => void) => {
      if (event === 'message') {
        return listener('not-a-json');
      }
      return;
    }),
    postMessage: sandbox.stub().callsFake((value: Record<string, unknown>) => {
      expect(value).to.have.keys(['type', 'source', 'error']);
    }),
  };

  beforeEach(() => {
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').withArgs(output).returns(writeStreamStub);
    getInfoStub = sandbox.stub(ytdl, 'getInfo').withArgs(videoUrl).resolves(videoInfo);
    downloadFromInfoStub = sandbox
      .stub(ytdl, 'downloadFromInfo')
      .withArgs(videoInfo)
      .callsFake((info: ytdl.videoInfo) => {
        expect(info).to.deep.equal(videoInfo);
        // simulate ytdl info signal then end the stream
        process.nextTick(() => {
          stream.emit('info', ...[info, format]);
          setImmediate(() => stream.emit('end'));
        });
        return stream;
      });
    exitStub = sandbox
      .stub(process, 'exit')
      .withArgs(1)
      .returns(undefined as never);
    sandbox.stub(workerThreads, 'parentPort').get(() => {
      return parentPortStub;
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('DownloadWorker downloads sends undecodable messages', async () => {
    const downloadWorkerOptions: DownloadWorker.Options = {
      item: {
        title: 'MyVideo',
        index: 1,
        id: 'aqz-KE-bpKQ',
        shortUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        author: {
          name: 'Blender',
          url: 'https://www.youtube.com/c/blander',
          channelID: '1234',
        },
      } as ytpl.Item,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(createWriteStreamStub.callCount).to.be.equal(0);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(0);
    expect(exitStub.callCount).to.be.greaterThanOrEqual(1);
    expect(exitStub.firstCall.firstArg).to.equal(1);
    expect(downloadWorker).to.have.keys(['downloadOptions', 'encoderOptions', 'item', 'output', 'timeout']);
  });
});

describe('DownloadWorker determine video size', () => {
  const title = 'My Title';
  const container = 'mp4';
  const output = `${title}.${container}`;
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const format = {
    itag: '123',
    container,
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  const formats = [format] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title,
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
  const writeStreamStub = sinon.createStubInstance(WritableFileStream);
  let createWriteStreamStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let exitStub: sinon.SinonStub;
  beforeEach(() => {
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').withArgs(output).returns(writeStreamStub);
    getInfoStub = sandbox.stub(ytdl, 'getInfo').withArgs(videoUrl).resolves(videoInfo);
    downloadFromInfoStub = sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', ...[info, format]);
        setImmediate(() => {
          stream.emit('response', {
            headers: {
              'content-length': 1024,
            },
          });
          setImmediate(() => stream.emit('end'));
        });
      });
      return stream;
    });
    exitStub = sandbox
      .stub(process, 'exit')
      .withArgs(0)
      .returns(undefined as never);
    sandbox.stub(workerThreads, 'parentPort').get(() => {
      return {
        on: sinon.spy(),
        postMessage: sinon.spy(),
      };
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('DownloadWorker determine size via response headers', async () => {
    const downloadWorkerOptions: DownloadWorker.Options = {
      item: {
        title: 'MyVideo',
        index: 1,
        id: 'aqz-KE-bpKQ',
        shortUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        author: {
          name: 'Blender',
          url: 'https://www.youtube.com/c/blander',
          channelID: '1234',
        },
      } as ytpl.Item,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    expect(downloadWorker).to.have.keys([
      'contentLength',
      'downloadOptions',
      'encoderOptions',
      'item',
      'output',
      'outputStream',
      'progress',
      'progressStream',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });

  it('DownloadWorker tries to determine size but gets empty headers', async () => {
    const isLiveFormat = {
      itag: '123',
      container,
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'high',
      audioBitrate: 100,
    } as unknown as ytdl.videoFormat;
    downloadFromInfoStub.restore();
    downloadFromInfoStub = sandbox
      .stub(ytdl, 'downloadFromInfo')
      .withArgs(videoInfo)
      .callsFake((info: ytdl.videoInfo) => {
        expect(info).to.deep.equal(videoInfo);
        // simulate ytdl info signal then end the stream
        process.nextTick(() => {
          stream.emit('info', ...[info, isLiveFormat]);
          setImmediate(() => {
            stream.emit('response', {
              headers: undefined,
            });
            setImmediate(() => stream.emit('end'));
          });
        });
        return stream;
      });
    const downloadWorkerOptions: DownloadWorker.Options = {
      item: {
        title: 'MyVideo',
        index: 1,
        id: 'aqz-KE-bpKQ',
        shortUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        author: {
          name: 'Blender',
          url: 'https://www.youtube.com/c/blander',
          channelID: '1234',
        },
      } as ytpl.Item,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    expect(downloadWorker).to.have.keys([
      'downloadOptions',
      'encoderOptions',
      'item',
      'output',
      'outputStream',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });

  it('DownloadWorker is live video', async () => {
    const isLiveFormat = {
      itag: '123',
      container,
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'high',
      audioBitrate: 100,
      isLive: true,
    } as unknown as ytdl.videoFormat;
    downloadFromInfoStub.restore();
    downloadFromInfoStub = sandbox
      .stub(ytdl, 'downloadFromInfo')
      .withArgs(videoInfo)
      .callsFake((info: ytdl.videoInfo) => {
        expect(info).to.deep.equal(videoInfo);
        // simulate ytdl info signal then end the stream
        process.nextTick(() => {
          stream.emit('info', ...[info, isLiveFormat]);
          setImmediate(() => stream.emit('end'));
        });
        return stream;
      });
    const downloadWorkerOptions: DownloadWorker.Options = {
      item: {
        title: 'MyVideo',
        index: 1,
        id: 'aqz-KE-bpKQ',
        shortUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        author: {
          name: 'Blender',
          url: 'https://www.youtube.com/c/blander',
          channelID: '1234',
        },
      } as ytpl.Item,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    expect(downloadWorker).to.have.keys([
      'downloadOptions',
      'encoderOptions',
      'item',
      'output',
      'outputStream',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });
});

describe('DownloadWorker fails to get setVideInfoAndVideoFormat', () => {
  const title = 'My Title';
  const container = 'mp4';
  const output = `${title}.${container}`;
  const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const format = {
    itag: '123',
    container,
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
    contentLength: 4096,
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  const formats = [format] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title,
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
  const writeStreamStub = sinon.createStubInstance(WritableFileStream);
  let createWriteStreamStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let exitStub: sinon.SinonStub;
  beforeEach(() => {
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').withArgs(output).returns(writeStreamStub);
    getInfoStub = sandbox.stub(ytdl, 'getInfo').withArgs(videoUrl).resolves(videoInfo);
    downloadFromInfoStub = sandbox
      .stub(ytdl, 'downloadFromInfo')
      .withArgs(videoInfo)
      .callsFake((info: ytdl.videoInfo) => {
        expect(info).to.deep.equal(videoInfo);
        // simulate ytdl info signal then end the stream
        process.nextTick(() => {
          stream.emit('info', undefined);
          setImmediate(() => stream.emit('end'));
        });
        return stream;
      });
    exitStub = sandbox
      .stub(process, 'exit')
      .withArgs(1)
      .returns(undefined as never);
    sandbox.stub(workerThreads, 'parentPort').get(() => {
      return {
        on: sinon.spy(),
        postMessage: sinon.spy(),
      };
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('DownloadWorker fails to get setVideInfoAndVideoFormat', async () => {
    const downloadWorkerOptions: DownloadWorker.Options = {
      item: {
        title: 'MyVideo',
        index: 1,
        id: 'aqz-KE-bpKQ',
        shortUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        author: {
          name: 'Blender',
          url: 'https://www.youtube.com/c/blander',
          channelID: '1234',
        },
      } as ytpl.Item,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.greaterThanOrEqual(1);
    expect(exitStub.firstCall.firstArg).to.be.equal(1);
    expect(createWriteStreamStub.callCount).to.be.equal(0);
    expect(downloadWorker).to.have.keys([
      'downloadOptions',
      'encoderOptions',
      'item',
      'output',
      'downloadStream',
      'timeout',
    ]);
  });
});
