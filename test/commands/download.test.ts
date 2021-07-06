import { Readable } from 'stream';
import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');

const buffer = Buffer.from('DEADBEEF', 'base64');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const stream = new Readable({
  read() {
    this.push(buffer);
  },
});

describe('video download', () => {
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
    sandbox.stub({ ytdl }, 'ytdl').returns(stream);
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', 'https://www.youtube.com/watch?v=MglX7zcg0gw', '--json'])
    .it('downloads a video', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(jsonResponse).to.deep.equal({ status: 0 });
    });
});
