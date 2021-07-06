import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { AnyJson } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');

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
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  // let ytdlGetInfoStub: sinon.SinonStub;
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').resolves(videoInfo);
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', 'https://www.youtube.com/watch?v=MglX7zcg0gw', '--json'])
    .it('runs info', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as AnyJson;
      expect(jsonResponse).to.deep.equal({ result: videoInfo, status: 0 });
    });
});

describe('video info', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').rejects('Not a YouTube domain');
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout({
      print: true,
    })
    .command(['info', '--url', 'https://www.wrong.domain.com', '--json'])
    .it('runs info on an unsupported domain and returns error', (ctx) => {
      const error = {
        status: 1,
        name: 'Error',
        message: 'Not a YouTube domain',
      }
      const jsonResponse = JSON.parse(ctx.stdout) as AnyJson;
      expect(jsonResponse).to.deep.equal({ result: {}, status: 1 });
    });
});