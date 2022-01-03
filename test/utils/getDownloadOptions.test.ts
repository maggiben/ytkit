import { assert, expect } from 'chai';
// import * as sinon from 'sinon';
import * as ytdl from 'ytdl-core';
import { OutputFlags } from '@oclif/parser';
import getDownloadOptions from '../../src/utils/getDownloadOptions';

const formats = [
  // audio & audioonly
  {
    mimeType: 'audio/webm; codecs=opus',
    qualityLabel: null,
    bitrate: 143544,
    audioBitrate: 160,
    itag: 251,
    initRange: {
      start: '0',
      end: '265',
    },
    indexRange: {
      start: '266',
      end: '283',
    },
    lastModified: '1529696175929552',
    contentLength: '139256',
    quality: 'tiny',
    projectionType: 'RECTANGULAR',
    audioQuality: 'AUDIO_QUALITY_MEDIUM',
    approxDurationMs: '7761',
    audioSampleRate: '48000',
    audioChannels: 2,
    loudnessDb: -15.566111,
    hasVideo: false,
    hasAudio: true,
    container: 'webm',
    codecs: 'opus',
    videoCodec: null,
    audioCodec: 'opus',
    isLive: false,
    isHLS: false,
    isDashMPD: false,
  },
  // video & videoonly
  {
    mimeType: 'video/mp4; codecs=avc1.42001E, mp4a.40.2',
    qualityLabel: '360p',
    bitrate: 576769,
    audioBitrate: 96,
    itag: 18,
    width: 640,
    height: 360,
    lastModified: '1529692529596816',
    contentLength: '894858',
    quality: 'medium',
    fps: 30,
    projectionType: 'RECTANGULAR',
    averageBitrate: 574132,
    audioQuality: 'AUDIO_QUALITY_LOW',
    approxDurationMs: '12469',
    audioSampleRate: '44100',
    audioChannels: 2,
    hasVideo: true,
    hasAudio: true,
    container: 'mp4',
    codecs: 'avc1.42001E, mp4a.40.2',
    videoCodec: 'avc1.42001E',
    audioCodec: 'mp4a.40.2',
    isLive: false,
    isHLS: false,
    isDashMPD: false,
  },
  // webm
  {
    mimeType: 'video/webm; codecs=vp9',
    qualityLabel: '480p',
    bitrate: 578472,
    audioBitrate: null,
    itag: 244,
    width: 854,
    height: 480,
    initRange: {
      start: '0',
      end: '199',
    },
    indexRange: {
      start: '200',
      end: '233',
    },
    lastModified: '1529693989469133',
    contentLength: '545103',
    quality: 'large',
    fps: 30,
    projectionType: 'RECTANGULAR',
    averageBitrate: 563923,
    approxDurationMs: '7733',
    hasVideo: true,
    hasAudio: false,
    container: 'webm',
    codecs: 'vp9',
    videoCodec: 'vp9',
    audioCodec: null,
    isLive: false,
    isHLS: false,
    isDashMPD: false,
  },
  {
    itag: '18',
    mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
    container: 'mp4',
    qualityLabel: '360p',
    codecs: 'avc1.42001E, mp4a.40.2',
    videoCodec: 'avc1.42001E',
    audioCodec: 'mp4a.40.2',
    bitrate: 500000,
    audioBitrate: 96,
    url: 'https://googlevideo.com/',
    hasVideo: true,
    hasAudio: true,
  },
  {
    itag: '19',
    mimeType: 'audio/mp4; codecs="avc1.42001E, mp4a.40.2"',
    container: 'mp4',
    qualityLabel: null,
    codecs: 'avc1.42001E, mp4a.40.2',
    videoCodec: null,
    audioCodec: 'avc1.42001E, mp4a.40.2',
    bitrate: 500000,
    audioBitrate: 96,
    url: 'https://googlevideo.com/',
    hasVideo: false,
    hasAudio: true,
  },
  {
    itag: '43',
    mimeType: 'video/webm; codecs="vp8.0, vorbis"',
    container: 'webm',
    qualityLabel: '360p',
    codecs: 'vp8.0, vorbis',
    videoCodec: 'vp8.0',
    audioCodec: 'vorbis',
    bitrate: 500000,
    audioBitrate: 128,
    url: 'https://googlevideo.com/',
    hasVideo: true,
    hasAudio: true,
  },
  {
    itag: '133',
    mimeType: 'video/mp4; codecs="avc1.4d400d"',
    container: 'mp4',
    qualityLabel: '240p',
    codecs: 'avc1.4d400d',
    videoCodec: 'avc1.4d400d',
    audioCodec: null,
    bitrate: 300000,
    audioBitrate: null,
    url: 'https://googlevideo.com/',
    hasVideo: true,
    hasAudio: false,
  },
  {
    itag: '36',
    mimeType: 'video/3gpp; codecs="mp4v.20.3, mp4a.40.2"',
    container: '3gp',
    qualityLabel: '240p',
    codecs: 'mp4v.20.3, mp4a.40.2',
    videoCodec: 'mp4v.20.3',
    audioCodec: 'mp4a.40.2',
    bitrate: 170000,
    audioBitrate: 38,
    url: 'https://googlevideo.com/',
    hasVideo: true,
    hasAudio: true,
  },
  {
    itag: '5',
    mimeType: 'video/flv; codecs="Sorenson H.283, mp3"',
    container: 'flv',
    qualityLabel: '240p',
    codecs: 'Sorenson H.283, mp3',
    videoCodec: 'Sorenson H.283',
    audioCodec: 'mp3',
    bitrate: 250000,
    audioBitrate: 64,
    url: 'https://googlevideo.com/',
    hasVideo: true,
    hasAudio: true,
  },
  {
    itag: '160',
    mimeType: 'video/mp4; codecs="avc1.4d400c"',
    container: 'mp4',
    qualityLabel: '144p',
    codecs: 'avc1.4d400c',
    videoCodec: 'avc1.4d400c',
    audioCodec: null,
    bitrate: 100000,
    audioBitrate: null,
    url: 'https://googlevideo.com/',
    hasVideo: true,
    hasAudio: false,
  },
  {
    itag: '17',
    mimeType: 'video/3gpp; codecs="mp4v.20.3, mp4a.40.2"',
    container: '3gp',
    qualityLabel: '144p @ 60fps',
    codecs: 'mp4v.20.3, mp4a.40.2',
    videoCodec: 'mp4v.20.3',
    audioCodec: 'mp4a.40.2',
    bitrate: 50000,
    audioBitrate: 24,
    url: 'https://googlevideo.com/',
    hasVideo: true,
    hasAudio: true,
  },
  {
    itag: '140',
    mimeType: 'audio/mp4; codecs="mp4a.40.2"',
    container: 'mp4',
    qualityLabel: null,
    codecs: 'mp4a.40.2',
    videoCodec: null,
    audioCodec: 'mp4a.40.2',
    bitrate: null,
    audioBitrate: 128,
    url: 'https://googlevideo.com/',
    hasVideo: false,
    hasAudio: true,
  },
  {
    itag: '139',
    mimeType: 'audio/mp4; codecs="mp4a.40.2"',
    container: 'mp4',
    qualityLabel: null,
    codecs: 'mp4a.40.2',
    videoCodec: null,
    audioCodec: 'mp4a.40.2',
    bitrate: null,
    audioBitrate: null,
    hasVideo: false,
    hasAudio: false,
  },
  {
    itag: '138',
    mimeType: 'audio/mp4; codecs="mp4a.40.2"',
    container: 'mp4',
    qualityLabel: null,
    codecs: 'mp4a.40.2',
    videoCodec: null,
    audioCodec: 'mp4a.40.2',
    bitrate: null,
    audioBitrate: null,
    url: 'https://googlevideo.com/',
    hasVideo: false,
    hasAudio: false,
  },
] as unknown as ytdl.videoFormat[];

describe('getDownloadOptions quality', () => {
  it('getDownloadOptions quality highest', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      quality: 'highest',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('quality').and.to.be.equal('highest');
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[3]);
  });
  it('getDownloadOptions quality itags', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      quality: '18,19',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('quality').and.to.deep.equal(['18', '19']);
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[3]);
  });
});

describe('getDownloadOptions range', () => {
  it('getDownloadOptions quality highest', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      range: '0-10',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('range').and.to.deep.equal({ start: 0, end: 10 });
  });
});

describe('getDownloadOptions filter', () => {
  it('getDownloadOptions audio', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      filter: 'audio',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('filter').to.exist.and.to.be.a('function');
    const { filter }: { filter?: ytdl.Filter } = downloadOptions;
    if (typeof filter === 'function') {
      const result = formats.filter(filter);
      expect(result).to.be.a('array').and.to.have.length(9);
    } else {
      assert.fail('filter not a function');
    }
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[3]);
  });
  it('getDownloadOptions audioonly', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      filter: 'audioonly',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('filter').to.exist.and.to.be.a('function');
    const { filter }: { filter?: ytdl.Filter } = downloadOptions;
    if (typeof filter === 'function') {
      const result = formats.filter(filter);
      expect(result).to.be.a('array').and.to.have.length(3);
    } else {
      assert.fail('filter not a function');
    }
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[4]);
  });
  it('getDownloadOptions video', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      filter: 'video',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('filter').to.exist.and.to.be.a('function');
    const { filter }: { filter?: ytdl.Filter } = downloadOptions;
    if (typeof filter === 'function') {
      const result = formats.filter(filter);
      expect(result).to.be.a('array').and.to.have.length(9);
    } else {
      assert.fail('filter not a function');
    }
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[3]);
  });
  it('getDownloadOptions videoonly', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      filter: 'videoonly',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('filter').to.exist.and.to.be.a('function');
    const { filter }: { filter?: ytdl.Filter } = downloadOptions;
    if (typeof filter === 'function') {
      const result = formats.filter(filter);
      expect(result).to.be.a('array').and.to.have.length(3);
    } else {
      assert.fail('filter not a function');
    }
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[6]);
  });
  it('getDownloadOptions videoandaudio', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      filter: 'videoandaudio',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('filter').to.exist.and.to.be.a('function');
    const { filter }: { filter?: ytdl.Filter } = downloadOptions;
    if (typeof filter === 'function') {
      const result = formats.filter(filter);
      expect(result).to.be.a('array').and.to.have.length(6);
    } else {
      assert.fail('filter not a function');
    }
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[3]);
  });
  it('getDownloadOptions audioandvideo', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      filter: 'audioandvideo',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('filter').to.exist.and.to.be.a('function');
    const { filter }: { filter?: ytdl.Filter } = downloadOptions;
    if (typeof filter === 'function') {
      const result = formats.filter(filter);
      expect(result).to.be.a('array').and.to.have.length(6);
    } else {
      assert.fail('filter not a function');
    }
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[3]);
  });
});

describe('getDownloadOptions filter- & unfilter-', () => {
  it('getDownloadOptions --filter-container', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      'filter-container': 'mp4',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('filter').to.exist.and.to.be.a('function');
    const { filter }: { filter?: ytdl.Filter } = downloadOptions;
    if (typeof filter === 'function') {
      const result = formats.filter(filter);
      expect(result).to.be.a('array').and.to.have.length(8);
    } else {
      assert.fail('filter not a function');
    }
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[3]);
  });
  it('getDownloadOptions --unfilter-container', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      'unfilter-container': 'webm',
    };
    const downloadOptions = getDownloadOptions(flags);
    expect(downloadOptions).to.have.property('filter').to.exist.and.to.be.a('function');
    const { filter }: { filter?: ytdl.Filter } = downloadOptions;
    if (typeof filter === 'function') {
      const result = formats.filter(filter);
      expect(result).to.be.a('array').and.to.have.length(11);
    } else {
      assert.fail('filter not a function');
    }
    const format = ytdl.chooseFormat(formats, downloadOptions);
    expect(format).to.deep.equal(formats[3]);
  });
});
