import * as fs from 'fs';
import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');
import { UX } from '../../src/Ux';
import * as util from '../../src/utils/utils';

const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
const formats = [
  {
    itag: '123',
    container: 'mp4',
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    contentLength: 4096,
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
  const testVideoFormat = {
    itag: '123',
    container: 'mp4',
    codecs: 'mp4a.40.2',
    isLive: true,
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
    .it('runs info with no qualityLable and audioBitrate', () => {
      expect(getInfoStub.callCount).to.equal(1);
      expect(getInfoStub.firstCall.firstArg).to.equal(videoUrl);
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]).to.include.keys(headers);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].bitrate).to.be.equal('');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]['audio bitrate']).to.be.equal('100KB');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0].size).to.be.equal('');
      expect(tableStub.getCall(0).args[1]).to.deep.equal(headers);
    });
});

describe('video info error', () => {
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
