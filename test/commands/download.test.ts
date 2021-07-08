import { PassThrough } from 'stream';
import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import ytdl = require('ytdl-core');

const string = 'DEADBEEF';
const buffer = Buffer.from(string, 'utf8');
let called = false;
const stream = new PassThrough({
  read() {
    if (!called) {
      this.push(buffer);
      called = true;
    }
  },
});

describe('video download', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
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
  beforeEach(() => {
    sandbox.stub(ytdl, 'getInfo').callsFake((url: string) => {
      expect(url).to.equal(videoUrl);
      return Promise.resolve(videoInfo);
    });
    sandbox.stub(ytdl, 'downloadFromInfo').callsFake((info: ytdl.videoInfo) => {
      expect(info).to.deep.equal(videoInfo);
      process.nextTick(() => {
        stream.emit('info', info, format);
      });
      return stream;
    });
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download', '--url', videoUrl, '--json', '--output', 'MyVideo.mp4'])
    .it('downloads a video', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(jsonResponse).to.deep.equal({ status: 0, result: videoInfo });
    });
});
