// import { PassThrough, Writable } from 'stream';
import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
// import * as ytdl from 'ytdl-core';
// import { SingleBar } from 'cli-progress';
// import { UX } from '../../../src/Ux';
// import * as utils from '../../../src/utils/utils';
import Download from '../../../src/commands/playlist/download';

import { Scheduler } from '../../../src/lib/scheduler';

const PLAYLIST_ID = 'PL6B3937A5D230E335';
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;
const PLAYLIST_ITEM = {
  title: 'Sprite Fright - Blender Open Movie',
  index: 1,
  id: '_cMxraX_5RE',
  shortUrl: 'https://www.youtube.com/watch?v=_cMxraX_5RE',
  url: 'https://www.youtube.com/watch?v=_cMxraX_5RE&list=PL6B3937A5D230E335&index=1',
  author: {
    url: 'https://www.youtube.com/c/BlenderAnimationStudio',
    channelID: 'UCz75RVbH8q2jdBJ4SnwuZZQ',
    name: 'Blender Studio',
  },
  thumbnails: [
    {
      url: 'https://i.ytimg.com/vi/_cMxraX_5RE/hqdefault.jpg?sqp=-oaymwEjCNACELwBSFryq4qpAxUIARUAAAAAGAElAADIQj0AgKJDeAE=&rs=AOn4CLAawq_99a-qv3WIeHLodnlDxHXjuA',
      width: 336,
      height: 188,
    },
    {
      url: 'https://i.ytimg.com/vi/_cMxraX_5RE/hqdefault.jpg?sqp=-oaymwEjCPYBEIoBSFryq4qpAxUIARUAAAAAGAElAADIQj0AgKJDeAE=&rs=AOn4CLAnIwHsAKWiTeLDygnaRyXcszHi9w',
      width: 246,
      height: 138,
    },
    {
      url: 'https://i.ytimg.com/vi/_cMxraX_5RE/hqdefault.jpg?sqp=-oaymwEiCMQBEG5IWvKriqkDFQgBFQAAAAAYASUAAMhCPQCAokN4AQ==&rs=AOn4CLBfy4KGznAu_iZwmetNDdW4AFbGVQ',
      width: 196,
      height: 110,
    },
    {
      url: 'https://i.ytimg.com/vi/_cMxraX_5RE/hqdefault.jpg?sqp=-oaymwEiCKgBEF5IWvKriqkDFQgBFQAAAAAYASUAAMhCPQCAokN4AQ==&rs=AOn4CLAlfET7HsMy2Cy5YkdvJO6_lxk3VQ',
      width: 168,
      height: 94,
    },
  ],
  bestThumbnail: {
    url: 'https://i.ytimg.com/vi/_cMxraX_5RE/hqdefault.jpg?sqp=-oaymwEjCNACELwBSFryq4qpAxUIARUAAAAAGAElAADIQj0AgKJDeAE=&rs=AOn4CLAawq_99a-qv3WIeHLodnlDxHXjuA',
    width: 336,
    height: 188,
  },
  isLive: false,
  duration: '10:30',
  durationSec: 630,
  isPlayable: true,
};
process.env.YTDL_NO_UPDATE = 'true';

describe('playlist download', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  const schedulerStub = sinon.createStubInstance(Scheduler);
  let downloadStub: sinon.SinonStub;
  // let logStub: sinon.SinonStub;
  beforeEach(() => {
    // logStub = sandbox.stub(UX.prototype, 'log').callsFake((input: string) => {
    //   expect(input.length).to.not.be.equal(0);
    //   return UX.prototype;
    // });
    // schedulerStub.on.callsFake(
    //   (event: string | symbol, listener: (...args: any[]) => void): sinon.SinonStubbedInstance<Scheduler> => {
    //     console.log('event', event, 'listener', listener);
    //     return schedulerStub;
    //   }
    // );
    // schedulerStub.download.resolves([
    //   {
    //     item: PLAYLIST_ITEM,
    //     code: 0,
    //   },
    // ]);
    downloadStub = sandbox.stub(Scheduler.prototype, 'download').resolves([
      {
        item: PLAYLIST_ITEM,
        code: 0,
      },
    ]);

    sandbox.stub(Scheduler.prototype, 'on').callsFake(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: string | symbol, listener: (...args: any[]) => void): sinon.SinonStubbedInstance<Scheduler> => {
        // eslint-disable-next-line no-console
        // console.log('event', event);
        return schedulerStub;
      }
    );
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['playlist:download', '--url', PLAYLIST_URL, '--json'])
    .it('downloads a playlist', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(downloadStub.callCount).to.be.equal(1);
      expect(downloadStub.firstCall.firstArg).to.equal(undefined);
      expect(jsonResponse).to.deep.equal({ status: 0, result: [{ code: 0, item: PLAYLIST_ITEM }] });
    });

  /*
  test
    .stdout()
    .command(['video:download', '--url', videoUrl, '--output', output])
    .it('downloads a video output to a file', () => {
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
    });

  test
    .stdout()
    .command(['video:download', '--url', videoUrl, '--json', '--output', output, '--quality', '278'])
    .it('downloads a video of a certain quality type', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(createWriteStreamStub.callCount).to.be.equal(1);
      expect(createWriteStreamStub.firstCall.firstArg).to.be.equal(output);
      expect(jsonResponse).to.deep.equal({ status: 0, result: videoInfo });
    });

  test
    .stdout()
    .command(['video:download', '--url', videoUrl, '--output', output, '--quality', '278'])
    .it('downloads a video and prints video metadata', () => {
      expect(logStub.callCount).to.be.equal(13);
      [
        videoInfo.videoDetails.title,
        videoInfo.videoDetails.author.name,
        videoInfo.videoDetails.averageRating,
        videoInfo.videoDetails.viewCount,
        videoInfo.videoDetails.publishDate,
        utils.toHumanTime(parseInt(videoInfo.videoDetails.lengthSeconds, 10)),
        format.quality,
        utils.toHumanSize(format.bitrate ?? 0),
        `${format.audioBitrate}KB`,
        format.codecs,
        format.itag,
        format.container,
        output,
      ].forEach((value: string | number | undefined, index: number) => {
        expect(logStub.getCall(index).args[0]).to.include(value);
      });
    });
  */
});

describe('test the class', () => {
  it('test class static properties', () => {
    expect(Download.id).to.be.equal('playlist:download');
    expect(Download.description).to.be.equal('download a youtube playlist');
    expect(Download.examples).to.deep.equal([
      '$ ytdl playlist:download -u https://www.youtube.com/playlist?list=PL6B3937A5D230E335',
    ]);
  });
});
