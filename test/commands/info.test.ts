import { expect, test } from '@oclif/test';
import { get } from '@salesforce/ts-types';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');
import { UX } from '../../src/Ux';
import * as util from '../../src/utils/utils';
import Info from '../../src/commands/info';

const videoUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const formats = [
  {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'highest',
    contentLength: 4096,
    audioBitrate: 100,
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
] as unknown as ytdl.videoFormat[];
const videoDetails = {
  title: 'My title',
  author: {
    name: 'Author Name',
  },
  averageRating: 5,
  viewCount: 100,
  publishDate: '2021-03-05',
  lengthSeconds: '10',
} as unknown as ytdl.VideoDetails;
const videoInfo = {
  videoDetails,
  formats,
} as unknown as ytdl.videoInfo;

describe('video info', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getInfoStub: sinon.SinonStub;
  let logStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves(videoInfo);
    logStub = sandbox.stub(UX.prototype, 'log').returns(UX.prototype);
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['info', '--url', videoUrl, '--json'])
    .it('retrieves video info then return as json', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      expect(jsonResponse).to.deep.equal({ result: videoInfo, status: 0 });
    });

  test
    .stdout()
    .command(['info', '--url', videoUrl])
    .it('print video metadata', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      expect(logStub.callCount).to.equal(6);
      expect(logStub.getCall(0).args[0]).to.include(videoInfo.videoDetails.title);
      expect(logStub.getCall(1).args[0]).to.include(videoInfo.videoDetails.author.name);
      expect(logStub.getCall(2).args[0]).to.include(videoInfo.videoDetails.averageRating);
      expect(logStub.getCall(3).args[0]).to.include(videoInfo.videoDetails.viewCount);
      expect(logStub.getCall(4).args[0]).to.include(videoInfo.videoDetails.publishDate);
      // It's not live so print the video duration
      expect(logStub.getCall(5).args[0]).to.include(
        util.toHumanTime(parseInt(videoInfo.videoDetails.lengthSeconds, 10))
      );
    });

  test
    .stdout()
    .command(['info', '--url', videoUrl, '-f'])
    .it('runs info', () => {
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]).to.include.keys(headers);
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info on live video', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const liveVideoFormat = {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    contentLength: 4096,
    isLive: true,
  } as unknown as ytdl.videoFormat;
  let getInfoStub: sinon.SinonStub;
  let logStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...videoInfo, ...{ formats: [liveVideoFormat] } });
    logStub = sandbox.stub(UX.prototype, 'log').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });
  test
    .stdout()
    .command(['info', '--url', videoUrl])
    .it('runs info', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      expect(logStub.callCount).to.equal(5);
      expect(logStub.getCall(0).args[0]).to.include(videoInfo.videoDetails.title);
      expect(logStub.getCall(1).args[0]).to.include(videoInfo.videoDetails.author.name);
      expect(logStub.getCall(2).args[0]).to.include(videoInfo.videoDetails.averageRating);
      expect(logStub.getCall(3).args[0]).to.include(videoInfo.videoDetails.viewCount);
      expect(logStub.getCall(4).args[0]).to.include(videoInfo.videoDetails.publishDate);
    });
});

describe('video info table formats', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...videoInfo, ...{ formats } });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });
  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with formats', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(get(tableStub.getCall(0).firstArg, '0')).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].itag).to.be.equal('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].container).to.be.equal('mp4');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].quality).to.be.equal('1080p');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('1KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100B');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('4KB');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats no contentLength', () => {
  const alternateFormats = [
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'highest',
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
  ] as unknown as ytdl.videoFormat[];
  const alternateVideoInfo = {
    videoDetails,
    formats: alternateFormats,
  } as unknown as ytdl.videoInfo;
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...alternateVideoInfo });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });
  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with formats no contentLength', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(get(tableStub.getCall(0).firstArg, '0')).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].itag).to.be.equal('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].container).to.be.equal('mp4');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].quality).to.be.equal('1080p');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('1KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100B');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats with contentLength', () => {
  const alternateFormats = [
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'highest',
      contentLength: 4096,
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'highest',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      itag: '123',
      qualityLabel: '1080p',
      contentLength: 4096,
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
  ] as unknown as ytdl.videoFormat[];
  const alternateVideoInfo = {
    videoDetails,
    formats: alternateFormats,
  } as unknown as ytdl.videoInfo;
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...alternateVideoInfo });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    getInfoStub.restore();
    sandbox.restore();
  });
  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with formats with contentLength', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(get(tableStub.getCall(0).firstArg, '0')).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].itag).to.be.equal('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].container).to.be.equal('mp4');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].quality).to.be.equal('1080p');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('1KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100B');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('4KB');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats with no audioBitrate', () => {
  const alternateFormats = [
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'highest',
      contentLength: 4096,
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'highest',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      itag: '123',
      qualityLabel: '1080p',
      contentLength: 4096,
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
  ] as unknown as ytdl.videoFormat[];
  const alternateVideoInfo = {
    videoDetails,
    formats: alternateFormats,
  } as unknown as ytdl.videoInfo;
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...alternateVideoInfo });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    getInfoStub.restore();
    sandbox.restore();
  });
  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with formats with no audioBitrate', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(get(tableStub.getCall(0).firstArg, '0')).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].itag).to.be.equal('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].container).to.be.equal('mp4');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].quality).to.be.equal('1080p');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('1KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100B');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('4KB');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats with codec', () => {
  const alternateFormats = [
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'highest',
      contentLength: 4096,
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'highest',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      itag: '123',
      qualityLabel: '1080p',
      contentLength: 4096,
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
  ] as unknown as ytdl.videoFormat[];
  const alternateVideoInfo = {
    videoDetails,
    formats: alternateFormats,
  } as unknown as ytdl.videoInfo;
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...alternateVideoInfo });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    getInfoStub.restore();
    sandbox.restore();
  });
  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with formats with audioBitrate', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(get(tableStub.getCall(0).firstArg, '0')).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].itag).to.be.equal('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].container).to.be.equal('mp4');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].quality).to.be.equal('1080p');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].codecs).to.be.equal('mp4a.40.2');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('1KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100B');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('4KB');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats with no codec', () => {
  const alternateFormats = [
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      bitrate: 1024,
      quality: 'highest',
      contentLength: 4096,
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      itag: '123',
      container: 'mp4',
      qualityLabel: '1080p',
      codecs: 'mp4a.40.2',
      bitrate: 1024,
      quality: 'highest',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
    {
      itag: '123',
      qualityLabel: '1080p',
      contentLength: 4096,
      audioBitrate: 100,
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    },
  ] as unknown as ytdl.videoFormat[];
  const alternateVideoInfo = {
    videoDetails,
    formats: alternateFormats,
  } as unknown as ytdl.videoInfo;
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...alternateVideoInfo });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    getInfoStub.restore();
    sandbox.restore();
  });
  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with formats with no codec', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(get(tableStub.getCall(0).firstArg, '0')).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].itag).to.be.equal('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].container).to.be.equal('mp4');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].quality).to.be.equal('1080p');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].codecs).to.be.equal('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('1KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100B');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('4KB');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats no qualityLabel', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const testVideoFormat = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...videoInfo, ...{ formats: [testVideoFormat] } });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });
  test
    .stdout()
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with no qualityLabel', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(get(tableStub.getCall(0).firstArg, '0')).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].itag).to.be.equal('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100B');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats no audioBitrate', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const testVideoFormat = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    qualityLabel: '1080p',
    bitrate: 1024,
    contentLength: 1024,
  } as unknown as ytdl.videoFormat;
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...videoInfo, ...{ formats: [testVideoFormat] } });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });
  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with no audioBitrate', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('1KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('1KB');

      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const testVideoFormat = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    qualityLabel: '1080p',
    bitrate: 1024,
  } as unknown as ytdl.videoFormat;
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...videoInfo, ...{ formats: [testVideoFormat] } });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });
  test
    .stdout()
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with no audioBitrate', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('1KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info table formats', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const testVideoFormat = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  let getInfoStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    getInfoStub = sandbox.stub(ytdl, 'getInfo').resolves({ ...videoInfo, ...{ formats: [testVideoFormat] } });
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });
  test
    .stdout()
    .command(['info', '--url', videoUrl, '--formats'])
    .it('runs info with no audioBitrate & qualityLabel', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100B');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info error on a non youtube domain', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const errorMessage = 'Not a YouTube domain';
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').rejects(new Error(errorMessage));
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['info', '--url', 'https://www.wrong.domain.com', '--json'])
    .it('runs info on an unsupported domain and returns error', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(jsonResponse.message).to.equal(errorMessage);
    });
});

describe('video info returns undefined', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').resolves(undefined);
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['info', '--url', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', '--json'])
    .it('runs info on an unsupported domain and returns error', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      /* TODO: must return something even when getInfo comes empty please fix */
      expect(jsonResponse.message).to.equal(undefined);
    });
});

describe('test the class', () => {
  it('test class static properties', () => {
    expect(Info.id).to.be.equal('info');
    expect(Info.description).to.be.equal('display information about a video');
    expect(Info.examples).to.deep.equal(['$ ytdl info -u https://www.youtube.com/watch?v=aqz-KE-bpKQ']);
  });
});
