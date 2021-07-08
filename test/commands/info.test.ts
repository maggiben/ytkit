import * as fs from 'fs';
import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');
import { UX } from '../../src/Ux';
import * as util from '../../src/utils/utils';

describe('video info', () => {
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
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let logStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').resolves(videoInfo);
    logStub = sandbox.stub(UX.prototype, 'log').returns(UX.prototype);
    tableStub = sandbox.stub(UX.prototype, 'table').returns(UX.prototype);
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['info', '--url', 'https://www.youtube.com/watch?v=MglX7zcg0gw', '--json'])
    .it('runs info', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(jsonResponse).to.deep.equal({ result: videoInfo, status: 0 });
    });

  test
    .stdout()
    .command(['info', '--url', 'https://www.youtube.com/watch?v=MglX7zcg0gw'])
    .it('runs info', () => {
      fs.writeFileSync('info.txt', JSON.stringify(logStub.firstCall.args, null, 2), 'utf8');
      expect(logStub.getCall(0).args[0]).to.include(videoInfo.videoDetails.title);
      expect(logStub.getCall(1).args[0]).to.include(videoInfo.videoDetails.author.name);
      expect(logStub.getCall(2).args[0]).to.include(videoInfo.videoDetails.averageRating);
      expect(logStub.getCall(3).args[0]).to.include(videoInfo.videoDetails.viewCount);
      expect(logStub.getCall(4).args[0]).to.include(videoInfo.videoDetails.publishDate);
      expect(logStub.getCall(5).args[0]).to.include(
        util.toHumanTime(parseInt(videoInfo.videoDetails.lengthSeconds, 10))
      );
      expect(logStub.callCount).to.equal(6);
    });

  test
    .stdout()
    .command(['info', '--url', 'https://www.youtube.com/watch?v=MglX7zcg0gw', '-f'])
    .it('runs info', () => {
      const headers = ['itag', 'container', 'quality', 'codecs', 'bitrate', 'audio bitrate', 'size'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(tableStub.getCall(0).args[0][0]).to.include.keys(headers);
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
