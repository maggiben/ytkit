import * as fs from 'fs';
import * as stream from 'stream';
import { fail } from 'assert';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as ytdl from 'ytdl-core';
import * as ffmpeg from 'fluent-ffmpeg';
import { EncoderStream } from '../../src/lib/EncoderStream';

class CommandStub {
  public input: sinon.SinonStub;
  public videoCodec: sinon.SinonStub;
  public audioCodec: sinon.SinonStub;
  public audioBitrate: sinon.SinonStub;
  public videoBitrate: sinon.SinonStub;
  public format: sinon.SinonStub;
  public outputOptions: sinon.SinonStub;
  public pipe: sinon.SinonStub;
  public constructor() {
    this.input = sinon.stub().returns(this);
    this.videoCodec = sinon.stub().withArgs('h264').returns(this);
    this.audioCodec = sinon.stub().withArgs('libmp3lame').returns(this);
    this.audioBitrate = sinon.stub().withArgs(128).returns(this);
    this.videoBitrate = sinon.stub().withArgs(1024).returns(this);
    this.format = sinon.stub().withArgs('mp3').returns(this);
    this.outputOptions = sinon.stub().returns(this);
    this.pipe = sinon.stub().returns(sinon.createStubInstance(stream.Writable));
  }
}

describe('EncoderStream', () => {
  const videoFormat = {
    itag: 123,
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
  const formatsMock = {
    mp4: {
      description: 'QuickTime / MOV',
      canDemux: true,
      canMux: true,
    },
    mp3: {
      description: 'MP3 (MPEG audio layer 3)',
      canDemux: true,
      canMux: true,
    },
  };
  const codecsMock = {
    h264: {
      type: 'video',
      description:
        'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (decoders: h264 libopenh264 ) (encoders: libx264 libx264rgb libopenh264 h264_videotoolbox )',
      canDecode: true,
      canEncode: true,
      intraFrameOnly: false,
      isLossy: true,
      isLossless: true,
    },
    libmp3lame: {
      type: 'audio',
      description: 'MP3 (MPEG audio layer 3) (decoders: mp3float mp3 mp3_at ) (encoders: libmp3lame libshine )',
      intraFrameOnly: true,
      isLossy: true,
      isLossless: false,
      canEncode: true,
    },
  };
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let commandStub: CommandStub;

  beforeEach(() => {
    commandStub = new CommandStub();
    sandbox.stub(EncoderStream, 'command').returns(commandStub as unknown as ffmpeg.FfmpegCommand);
    sandbox.stub(ffmpeg, 'getAvailableFormats').callsFake((callback: ffmpeg.FormatsCallback) => {
      callback(undefined as unknown as Error, formatsMock);
    });
    sandbox.stub(ffmpeg, 'getAvailableCodecs').callsFake((callback: ffmpeg.CodecsCallback) => {
      callback(undefined as unknown as Error, codecsMock as unknown as ffmpeg.Codecs);
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('streams to ffmpeg and converts to mp3 with audio and video bitrate', async () => {
    const getEncoderOptions = (format: string): EncoderStream.EncodeOptions => {
      return {
        format,
        videoCodec: 'h264',
        audioCodec: 'libmp3lame',
        audioBitrate: 128,
        videoBitrate: 1024,
      };
    };
    const encoderStreamOptions: EncoderStream.Options = {
      encodeOptions: getEncoderOptions('mp3'),
      metadata: {
        videoInfo,
        videoFormat,
      },
      inputStream: sandbox.createStubInstance(fs.ReadStream),
      outputStream: sandbox.createStubInstance(fs.WriteStream),
    };
    const encoderStream = await EncoderStream.create(encoderStreamOptions);
    expect(encoderStream).to.be.instanceOf(EncoderStream);
    expect(encoderStream).to.have.property('stream').and.to.be.instanceOf(stream.Writable);
    expect(encoderStream).to.have.property('ffmpegCommand').and.to.be.instanceOf(CommandStub);
    expect(commandStub.audioBitrate.callCount).to.equal(1);
    expect(commandStub.videoBitrate.callCount).to.equal(1);
    expect(commandStub.videoCodec.callCount).to.equal(1);
    expect(commandStub.audioCodec.callCount).to.equal(1);
  });

  it('streams to ffmpeg and converts to mp3 with meta audio and video bitrate', async () => {
    const getEncoderOptions = (format: string): EncoderStream.EncodeOptions => {
      return {
        format,
        videoCodec: 'h264',
        audioCodec: 'libmp3lame',
      };
    };
    const encoderStreamOptions: EncoderStream.Options = {
      encodeOptions: getEncoderOptions('mp3'),
      metadata: {
        videoInfo,
        videoFormat,
      },
      inputStream: sandbox.createStubInstance(fs.ReadStream),
      outputStream: sandbox.createStubInstance(fs.WriteStream),
    };
    const encoderStream = await EncoderStream.create(encoderStreamOptions);
    expect(encoderStream).to.be.instanceOf(EncoderStream);
    expect(encoderStream).to.have.property('stream').and.to.be.instanceOf(stream.Writable);
    expect(encoderStream).to.have.property('ffmpegCommand').and.to.be.instanceOf(CommandStub);
    expect(commandStub.audioBitrate.callCount).to.equal(1);
    expect(commandStub.videoBitrate.callCount).to.equal(1);
    expect(commandStub.videoCodec.callCount).to.equal(1);
    expect(commandStub.audioCodec.callCount).to.equal(1);
  });

  it('streams to ffmpeg and converts to mp3 with no audio and video bitrate', async () => {
    const getEncoderOptions = (format: string): EncoderStream.EncodeOptions => {
      return {
        format,
      };
    };
    const encoderStreamOptions: EncoderStream.Options = {
      encodeOptions: getEncoderOptions('mp3'),
      metadata: {
        videoInfo,
        videoFormat: {
          itag: 123,
          container: 'mp4',
          qualityLabel: '1080p',
          codecs: 'mp4a.40.2',
          quality: 'high',
          contentLength: '4096',
        } as unknown as ytdl.videoFormat,
      },
      inputStream: sandbox.createStubInstance(fs.ReadStream),
      outputStream: sandbox.createStubInstance(fs.WriteStream),
    };
    const encoderStream = await EncoderStream.create(encoderStreamOptions);
    expect(encoderStream).to.be.instanceOf(EncoderStream);
    expect(encoderStream).to.have.property('stream').and.to.be.instanceOf(stream.Writable);
    expect(encoderStream).to.have.property('ffmpegCommand').and.to.be.instanceOf(CommandStub);
    expect(commandStub.audioBitrate.callCount).to.equal(0);
    expect(commandStub.videoBitrate.callCount).to.equal(0);
    expect(commandStub.videoCodec.callCount).to.equal(0);
    expect(commandStub.audioCodec.callCount).to.equal(0);
  });

  it('EncoderStream throws on invalid format ', async () => {
    const getEncoderOptions = (): EncoderStream.EncodeOptions => {
      return {
        format: 'flv',
        audioBitrate: 128,
        videoBitrate: 1024,
      };
    };
    const encoderStreamOptions: EncoderStream.Options = {
      encodeOptions: getEncoderOptions(),
      metadata: {
        videoInfo,
        videoFormat: {
          itag: 123,
          container: 'mp4',
          qualityLabel: '1080p',
          codecs: 'mp4a.40.2',
          quality: 'high',
          contentLength: '4096',
        } as unknown as ytdl.videoFormat,
      },
      inputStream: sandbox.createStubInstance(fs.ReadStream),
      outputStream: sandbox.createStubInstance(fs.WriteStream),
    };
    try {
      await EncoderStream.create(encoderStreamOptions);
      fail();
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      if (error instanceof Error) {
        expect(error?.message).to.equal('Invalid encoding options');
      }
    }
  });
});

describe('getAvailableFormats', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const formatsMock = {
    mp4: {
      description: 'QuickTime / MOV',
      canDemux: true,
      canMux: true,
    },
    mp3: {
      description: 'MP3 (MPEG audio layer 3)',
      canDemux: true,
      canMux: true,
    },
  };
  const codecsMock = {
    h264: {
      type: 'video',
      description:
        'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (decoders: h264 libopenh264 ) (encoders: libx264 libx264rgb libopenh264 h264_videotoolbox )',
      canDecode: true,
      canEncode: true,
      intraFrameOnly: false,
      isLossy: true,
      isLossless: true,
    },
    libmp3lame: {
      type: 'audio',
      description: 'MP3 (MPEG audio layer 3) (decoders: mp3float mp3 mp3_at ) (encoders: libmp3lame libshine )',
      intraFrameOnly: true,
      isLossy: true,
      isLossless: false,
      canEncode: true,
      canDecode: false,
    },
  };
  beforeEach(() => {
    sandbox.stub(ffmpeg, 'getAvailableFormats').callsFake((callback: ffmpeg.FormatsCallback) => {
      callback(undefined as unknown as Error, formatsMock);
    });
    sandbox.stub(ffmpeg, 'getAvailableCodecs').callsFake((callback: ffmpeg.CodecsCallback) => {
      callback(undefined as unknown as Error, codecsMock as unknown as ffmpeg.Codecs);
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('getAvailableFormats', async () => {
    const formats = await EncoderStream.getAvailableFormats();
    expect(formats).to.deep.equal(formatsMock);
  });

  it('getAvailableFormats throws', async () => {
    sandbox.restore();
    sandbox.stub(ffmpeg, 'getAvailableFormats').callsFake((callback: ffmpeg.FormatsCallback) => {
      callback(new Error('MyError'), undefined as unknown as ffmpeg.Formats);
    });
    try {
      await EncoderStream.getAvailableFormats();
      fail('MyError');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      if (error instanceof Error) {
        expect(error?.message).to.equal('MyError');
      }
    }
  });

  it('getAvailableCodecs', async () => {
    const formats = await EncoderStream.getAvailableCodecs();
    expect(formats).to.deep.equal(codecsMock);
  });
  it('getAvailableCodecs throws', async () => {
    sandbox.restore();
    sandbox.stub(ffmpeg, 'getAvailableCodecs').callsFake((callback: ffmpeg.CodecsCallback) => {
      callback(new Error('MyError'), undefined as unknown as ffmpeg.Codecs);
    });
    try {
      await EncoderStream.getAvailableCodecs();
      fail('MyError');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      if (error instanceof Error) {
        expect(error?.message).to.equal('MyError');
      }
    }
  });
});

describe('validateEncoderOptions', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const formatsMock = {
    mp4: {
      description: 'QuickTime / MOV',
      canDemux: true,
      canMux: true,
    },
    mp3: {
      description: 'MP3 (MPEG audio layer 3)',
      canDemux: true,
      canMux: true,
    },
  };
  const codecsMock = {
    h264: {
      type: 'video',
      description:
        'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (decoders: h264 libopenh264 ) (encoders: libx264 libx264rgb libopenh264 h264_videotoolbox )',
      canDecode: true,
      canEncode: true,
      intraFrameOnly: false,
      isLossy: true,
      isLossless: true,
    },
    libmp3lame: {
      type: 'audio',
      description: 'MP3 (MPEG audio layer 3) (decoders: mp3float mp3 mp3_at ) (encoders: libmp3lame libshine )',
      intraFrameOnly: true,
      isLossy: true,
      isLossless: false,
      canEncode: true,
    },
  };
  beforeEach(() => {
    sandbox.stub(ffmpeg, 'getAvailableFormats').callsFake((callback: ffmpeg.FormatsCallback) => {
      callback(undefined as unknown as Error, formatsMock);
    });
    sandbox.stub(ffmpeg, 'getAvailableCodecs').callsFake((callback: ffmpeg.CodecsCallback) => {
      callback(undefined as unknown as Error, codecsMock as unknown as ffmpeg.Codecs);
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('validateEncoderOptions on audio and video codec', async () => {
    const getEncoderOptions = (format: string): EncoderStream.EncodeOptions => {
      return {
        format,
        videoCodec: 'h264',
        audioCodec: 'libmp3lame',
        audioBitrate: 128,
        videoBitrate: 1024,
      };
    };
    const isValidEncoderOptions = await EncoderStream.validateEncoderOptions(getEncoderOptions('mp4'));
    expect(isValidEncoderOptions).to.be.true;
  });

  it('validateEncoderOptions on video codec', async () => {
    const getEncoderOptions = (format: string): EncoderStream.EncodeOptions => {
      return {
        format,
        videoCodec: 'h264',
        audioBitrate: 128,
        videoBitrate: 1024,
      };
    };
    const isValidEncoderOptions = await EncoderStream.validateEncoderOptions(getEncoderOptions('mp4'));
    expect(isValidEncoderOptions).to.be.true;
  });

  it('validateEncoderOptions on audio codec', async () => {
    const getEncoderOptions = (format: string): EncoderStream.EncodeOptions => {
      return {
        format,
        audioCodec: 'libmp3lame',
        audioBitrate: 128,
        videoBitrate: 1024,
      };
    };
    const isValidEncoderOptions = await EncoderStream.validateEncoderOptions(getEncoderOptions('mp4'));
    expect(isValidEncoderOptions).to.be.true;
  });

  it('validateEncoderOptions fails on audioCodec', async () => {
    const getEncoderOptions = (format: string): EncoderStream.EncodeOptions => {
      return {
        format,
        videoCodec: 'h264',
        audioCodec: 'libvorbis',
        audioBitrate: 128,
        videoBitrate: 1024,
      };
    };
    const isValidEncoderOptions = await EncoderStream.validateEncoderOptions(getEncoderOptions('mp3'));
    expect(isValidEncoderOptions).to.be.false;
  });

  it('validateEncoderOptions fails on videoCodec', async () => {
    const getEncoderOptions = (format: string): EncoderStream.EncodeOptions => {
      return {
        format,
        videoCodec: 'flv',
        audioCodec: 'libmp3lame',
        audioBitrate: 128,
        videoBitrate: 1024,
      };
    };
    const isValidEncoderOptions = await EncoderStream.validateEncoderOptions(getEncoderOptions('mp3'));
    expect(isValidEncoderOptions).to.be.false;
  });
});
