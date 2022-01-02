import * as workerThreads from 'worker_threads';
import * as fs from 'fs';
import { PassThrough } from 'stream';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { OutputFlags } from '@oclif/parser';
import * as ytpl from 'ytpl';
import * as ytdl from 'ytdl-core';
import { AsyncCreatable } from '../../src/utils/AsyncCreatable';
import { DownloadWorker } from '../../src/lib/DownloadWorker';
import TimeoutStream from '../../src/lib/TimeoutStream';
import { EncoderStream } from '../../src/lib/EncoderStream';

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

const passThorughTimeoutStream = (timeout: number) => {
  let called = false;
  return new ReadableFileStream({
    read() {
      if (!called) {
        setTimeout(() => {
          this.push(buffer);
        }, timeout);
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
  const parentPortStub = {
    on: sinon.spy(),
    postMessage: sinon.spy(),
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
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
      'flags',
      'item',
      'output',
      'outputStream',
      'parentPort',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });
});

describe('DownloadWorker download stream timeouts', () => {
  const timeout = 1000;
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
  const stream = passThorughTimeoutStream(timeout + 10);
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const writeStreamStub = sinon.createStubInstance(WritableFileStream);
  let createWriteStreamStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let exitStub: sinon.SinonStub;
  const parentPortStub = {
    on: sandbox.spy(),
    postMessage: sandbox
      .stub()
      .onCall(0)
      .callsFake((value: Record<string, unknown>) => {
        expect(value).to.have.keys(['type', 'source', 'details']);
        expect(value).to.have.property('type').and.to.be.equal('videoInfo');
      })
      .onCall(1)
      .callsFake((value: Record<string, unknown>) => {
        expect(value).to.have.keys(['type', 'source', 'details']);
        expect(value).to.have.property('type').and.to.be.equal('info');
      })
      .onCall(2)
      .callsFake((value: Record<string, unknown>) => {
        expect(value).to.have.keys(['type', 'source', 'details']);
        expect(value).to.have.property('type').and.to.be.equal('contentLength');
      })
      .onCall(3)
      .callsFake((value: Record<string, unknown>) => {
        expect(value).to.have.keys(['type', 'source', 'error']);
      }),
  };
  beforeEach(() => {
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').withArgs(output).returns(writeStreamStub);
    writeStreamStub.path = output;
    getInfoStub = sandbox.stub(ytdl, 'getInfo').withArgs(videoUrl).resolves(videoInfo);
    downloadFromInfoStub = sandbox
      .stub(ytdl, 'downloadFromInfo')
      .withArgs(videoInfo)
      .callsFake((info: ytdl.videoInfo) => {
        expect(info).to.deep.equal(videoInfo);
        // simulate ytdl info signal then end the stream
        process.nextTick(() => {
          stream.emit('info', ...[info, format]);
          // setImmediate(() => stream.emit('end'));
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

  it('DownloadWorker download stream timeouts', async () => {
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
      timeout,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.greaterThanOrEqual(1);
    expect(parentPortStub.postMessage.getCall(3).firstArg).to.have.keys(['type', 'source', 'error']);
    expect(parentPortStub.postMessage.getCall(3).firstArg).to.have.property('error').and.to.be.instanceOf(Error);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    expect(downloadWorker).to.have.keys([
      'contentLength',
      'downloadOptions',
      'encoderOptions',
      'flags',
      'item',
      'output',
      'outputStream',
      'parentPort',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });
});

describe('DownloadWorker endoced', () => {
  const title = 'My Title';
  const outputFormat = 'mp3';
  const output = `${title}.${outputFormat}`;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flags: OutputFlags<any> = {
    filter: 'audioonly',
  };
  const stream = passThorughStream();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const writeStreamStub = sinon.createStubInstance(WritableFileStream);
  const encoderStreamStub = sinon.createStubInstance(EncoderStream);
  let createWriteStreamStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let exitStub: sinon.SinonStub;
  let createStub: sinon.SinonStub;
  const parentPortStub = {
    on: sinon.spy(),
    postMessage: sinon.spy(),
  };
  beforeEach(() => {
    createWriteStreamStub = sandbox.stub(fs, 'createWriteStream').withArgs(output).returns(writeStreamStub);
    writeStreamStub.path = output;
    const ffmpegCommandStub = {
      once: sinon.stub().withArgs('error').returns(encoderStreamStub.ffmpegCommand),
    };
    createStub = sandbox.stub(EncoderStream, 'create').resolves({
      ffmpegCommand: ffmpegCommandStub,
      stream: sinon.spy(),
    } as unknown as AsyncCreatable<EncoderStream.Options>);
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
    exitStub = sandbox.stub(process, 'exit');
    exitStub.withArgs(0).returns(undefined as never);
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

  it('DownloadWorker downloads and encodes a video to mp3', async () => {
    const encoderStream: EncoderStream.EncodeOptions = {
      format: outputFormat,
    };
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
      encoderOptions: encoderStream,
      flags,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
  });
  it('DownloadWorker downloads and fails to encodes a video to mp3', async () => {
    createStub.restore();
    exitStub.restore();
    exitStub = sandbox.stub(process, 'exit');
    exitStub.withArgs(1).returns(undefined as never);
    const ffmpegCommandStub = {
      once: sinon
        .stub()
        .withArgs('error')
        .callsFake((listener: (...args: unknown[]) => void) => {
          return listener();
        }),
    };
    createStub = sandbox.stub(EncoderStream, 'create').resolves({
      ffmpegCommand: ffmpegCommandStub,
      stream: sinon.spy(),
    } as unknown as AsyncCreatable<EncoderStream.Options>);
    const encoderStream: EncoderStream.EncodeOptions = {
      format: outputFormat,
    };
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
      encoderOptions: encoderStream,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
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
  let getInfoStub: sinon.SinonStub;
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
    sandbox.stub(fs, 'createWriteStream').withArgs(output).returns(writeStreamStub);
    getInfoStub = sandbox.stub(ytdl, 'getInfo').withArgs(videoUrl).resolves(videoInfo);
    sandbox
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.greaterThanOrEqual(1);
    expect(exitStub.firstCall.firstArg).to.equal(1);
    expect(downloadWorker).to.have.keys([
      'downloadOptions',
      'encoderOptions',
      'flags',
      'item',
      'output',
      'parentPort',
      'timeout',
    ]);
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(createWriteStreamStub.callCount).to.be.equal(0);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(0);
    expect(exitStub.callCount).to.be.greaterThanOrEqual(1);
    expect(exitStub.firstCall.firstArg).to.equal(1);
    expect(parentPortStub.postMessage.firstCall.firstArg).to.have.keys(['type', 'source', 'error']);
    expect(parentPortStub.postMessage.firstCall.firstArg).to.have.property('error').and.to.be.instanceOf(Error);
    expect(downloadWorker).to.have.keys([
      'downloadOptions',
      'encoderOptions',
      'flags',
      'item',
      'output',
      'parentPort',
      'timeout',
    ]);
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
  const parentPortStub = {
    on: sinon.spy(),
    postMessage: sinon.spy(),
  };
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
    exitStub = sandbox.stub(process, 'exit');
    exitStub.withArgs(0).returns(undefined as never);
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
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
      'flags',
      'item',
      'output',
      'outputStream',
      'parentPort',
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
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
      'flags',
      'item',
      'output',
      'outputStream',
      'parentPort',
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
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
      'flags',
      'item',
      'output',
      'outputStream',
      'parentPort',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });

  it('DownloadWorker throws when trying to determine video size', async () => {
    downloadFromInfoStub.restore();
    downloadFromInfoStub = sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      // simulate ytdl info signal then end the stream
      process.nextTick(() => {
        stream.emit('info', ...[info, format]);
        setImmediate(() => {
          stream.emit('error', new Error('MyError'));
          setImmediate(() => stream.emit('end'));
        });
      });
      return stream;
    });
    exitStub.restore();
    exitStub = sandbox.stub(process, 'exit');
    exitStub.withArgs(1).returns(undefined as never);
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.callCount).to.be.equal(0);
    expect(downloadWorker).to.have.keys([
      'downloadOptions',
      'encoderOptions',
      'flags',
      'item',
      'output',
      'parentPort',
      'downloadStream',
      'timeout',
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
  const parentPortStub = {
    on: sinon.spy(),
    postMessage: sinon.spy(),
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
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
      'flags',
      'item',
      'output',
      'parentPort',
      'downloadStream',
      'timeout',
    ]);
  });
});

describe('DownloadWorker timeout stream', () => {
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
  const timeoutStreamStub = sinon.createStubInstance(TimeoutStream);
  const writeStreamStub = sinon.createStubInstance(WritableFileStream);
  let createWriteStreamStub: sinon.SinonStub;
  let getInfoStub: sinon.SinonStub;
  let downloadFromInfoStub: sinon.SinonStub;
  let exitStub: sinon.SinonStub;
  let existsSyncStub: sinon.SinonStub;
  const parentPortStub = {
    on: sinon.spy(),
    postMessage: sinon.spy(),
  };
  beforeEach(() => {
    writeStreamStub.path = output;
    existsSyncStub = sandbox.stub(fs, 'existsSync');
    existsSyncStub.withArgs(output).returns(true);
    sandbox.stub(fs, 'unlinkSync').withArgs(output).returns();
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
        });
        return stream;
      });
    sandbox.stub(workerThreads, 'parentPort').get(() => {
      return {
        on: sinon.spy(),
        postMessage: sinon.spy(),
      };
    });

    exitStub = sandbox
      .stub(process, 'exit')
      .withArgs(1)
      .returns(undefined as never);
    sandbox
      .stub(TimeoutStream.prototype, 'once')
      .withArgs('timeout', sinon.match.any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .callsFake((event: string | symbol, listener: (...args: any[]) => void): TimeoutStream => {
        if (event === 'timeout') {
          listener();
        }
        return timeoutStreamStub;
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('DownloadWorker download timeouts', async () => {
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.greaterThanOrEqual(1);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(existsSyncStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    expect(downloadWorker).to.have.keys([
      'contentLength',
      'downloadOptions',
      'encoderOptions',
      'flags',
      'item',
      'output',
      'outputStream',
      'parentPort',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });

  it('DownloadWorker download timeouts fails to remove output file', async () => {
    existsSyncStub.restore();
    existsSyncStub.withArgs(output).returns(true);
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
      parentPort: parentPortStub as unknown as workerThreads.MessagePort,
    };
    const downloadWorker = await DownloadWorker.create(downloadWorkerOptions);
    expect(downloadWorker).to.be.instanceOf(DownloadWorker);
    expect(getInfoStub.callCount).to.be.equal(1);
    expect(downloadFromInfoStub.callCount).to.be.equal(1);
    expect(exitStub.callCount).to.be.greaterThanOrEqual(1);
    expect(createWriteStreamStub.callCount).to.be.equal(1);
    expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    expect(downloadWorker).to.have.keys([
      'contentLength',
      'downloadOptions',
      'encoderOptions',
      'flags',
      'item',
      'output',
      'outputStream',
      'parentPort',
      'downloadStream',
      'timeout',
      'timeoutStream',
      'videoFormat',
      'videoInfo',
    ]);
  });
});
