import { EventEmitter } from 'stream';
import { expect, test } from '@oclif/test';
import cli from 'cli-ux';
import * as sinon from 'sinon';
import { JsonMap } from '@salesforce/ts-types';
import Playlist from '../../../src/commands/download/playlist';
import { Scheduler } from '../../../src/lib/scheduler';

interface CliMock {
  action: {
    start: sinon.SinonSpy;
    stop: sinon.SinonSpy;
  };
  log: sinon.SinonSpy;
  table: sinon.SinonSpy;
  multibar: sinon.SinonStub;
}

const PLAYLIST_ID = 'PL6B3937A5D230E335';
const PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;
const INVALID_UTL = 'http:my-bad-url.com';
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

describe('download:playlist', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let downloadStub: sinon.SinonStub;
  let cliMock: CliMock;
  beforeEach(() => {
    cliMock = {
      action: {
        start: sinon.spy(),
        stop: sinon.spy(),
      },
      log: sinon.spy(),
      table: sinon.spy(),
      multibar: sinon.stub().returns({
        create: sinon.stub().returns({
          stop: sinon.spy(),
        }),
        remove: sinon.spy(),
      }),
    };
    sandbox.stub(cli, 'action').get(() => cliMock.action);
    sandbox.stub(cli, 'log').get(() => cliMock.log);
    sandbox.stub(cli, 'table').get(() => cliMock.table);
    downloadStub = sandbox.stub(Scheduler.prototype, 'download').resolves([
      {
        item: PLAYLIST_ITEM,
        code: 0,
      },
    ]);
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['download:playlist', '--url', PLAYLIST_URL, '--json'])
    .it('downloads a playlist', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(downloadStub.callCount).to.be.equal(1);
      expect(downloadStub.firstCall.firstArg).to.equal(undefined);
      expect(jsonResponse).to.have.property('status').and.be.equal(0);
      expect(jsonResponse).to.have.property('result').and.to.have.length(1);
    });

  test
    .stdout()
    .command(['download:playlist', '--url', PLAYLIST_URL, '--format', 'mp3', '--json'])
    .it('downloads a playlist and formats each item', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(downloadStub.callCount).to.be.equal(1);
      expect(downloadStub.firstCall.firstArg).to.equal(undefined);
      expect(jsonResponse).to.have.property('status').and.be.equal(0);
      expect(jsonResponse).to.have.property('result').and.to.have.length(1);
    });

  test
    .stdout()
    .command(['download:playlist', '--url', INVALID_UTL, '--json'])
    .it('fails on invalid playlist url', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
      expect(jsonResponse).to.have.property('status').and.be.equal(1);
      expect(jsonResponse.name).to.equal('Error');
    });

  describe('download scheduler resutns a mix of good items and undefined, code 1 and error', () => {
    beforeEach(() => {
      downloadStub.restore();
      downloadStub = sandbox.stub(Scheduler.prototype, 'download').resolves([
        undefined,
        {
          item: PLAYLIST_ITEM,
          code: 1,
          error: new Error('MyError'),
        },
        {
          item: PLAYLIST_ITEM,
        },
      ] as Scheduler.Result[]);
    });
    afterEach(() => {
      downloadStub.restore();
    });
    after(() => {
      downloadStub.restore();
    });

    test
      .stdout()
      .command(['download:playlist', '--url', PLAYLIST_URL, '--json'])
      .it('download scheduler resutns a mix of good items and undefined, code 1 and error', (ctx) => {
        const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
        expect(jsonResponse).to.have.property('status').and.be.equal(0);
        expect(jsonResponse).to.have.property('result').and.to.have.length(1);
      });
  });

  describe('download scheduler throws', () => {
    const error = new Error('MyError');
    beforeEach(() => {
      downloadStub.restore();
      downloadStub = sandbox.stub(Scheduler.prototype, 'download').rejects(error);
    });
    afterEach(() => {
      downloadStub.restore();
    });
    after(() => {
      downloadStub.restore();
    });

    test
      .stdout()
      .command(['download:playlist', '--url', PLAYLIST_URL, '--json'])
      .it('download scheduler throws', (ctx) => {
        const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
        expect(jsonResponse).to.have.property('status').and.be.equal(1);
        expect(jsonResponse).to.have.property('message').and.be.equal(error.message);
      });
  });

  describe('download scheduler resutns undefined, code 1 and error', () => {
    beforeEach(() => {
      downloadStub.restore();
      downloadStub = sandbox.stub(Scheduler.prototype, 'download').resolves([
        undefined,
        {
          code: 1,
        },
        {
          error: new Error('MyError'),
        },
      ] as Scheduler.Result[]);
    });
    afterEach(() => {
      downloadStub.restore();
    });
    after(() => {
      downloadStub.restore();
    });
    test
      .stdout()
      .command(['download:playlist', '--url', PLAYLIST_URL, '--json'])
      .it('download scheduler resutns undefined', (ctx) => {
        const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
        expect(jsonResponse).to.have.property('status').and.be.equal(0);
        expect(jsonResponse).to.have.property('result').and.to.have.length(0);
      });
  });

  describe('handles scheduler messages', () => {
    const eventEmitter = new EventEmitter();
    beforeEach(() => {
      downloadStub.restore();
      downloadStub = sandbox.stub(Scheduler.prototype, 'download').resolves([
        {
          item: PLAYLIST_ITEM,
          code: 0,
        },
      ]);
      sandbox
        .stub(EventEmitter.prototype, 'once')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .callsFake((event: string | symbol, listener: (...args: any[]) => void): Scheduler => {
          if (event === 'playlistItems') {
            listener({
              details: {
                playlistItems: [PLAYLIST_ITEM],
              },
            });
          }
          return eventEmitter as unknown as Scheduler;
        });
      sandbox
        .stub(EventEmitter.prototype, 'on')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .callsFake((event: string | symbol, listener: (...args: any[]) => void): Scheduler => {
          switch (event) {
            case 'contentLength': {
              listener({
                source: PLAYLIST_ITEM,
                details: {
                  contentLength: 1024,
                },
              });
              break;
            }
            case 'end': {
              listener({
                source: PLAYLIST_ITEM,
              });
              break;
            }
            case 'timeout': {
              listener({
                source: PLAYLIST_ITEM,
              });
              break;
            }
            case 'exit': {
              listener({
                source: PLAYLIST_ITEM,
              });
              break;
            }
            case 'progress': {
              listener({
                source: PLAYLIST_ITEM,
                details: {
                  progress: {
                    transferred: 128,
                    eta: 60,
                    percentage: 15,
                    speed: 512,
                  },
                },
              });
              break;
            }
          }
          return eventEmitter as unknown as Scheduler;
        });
    });

    test
      .stdout()
      .command(['download:playlist', '--url', PLAYLIST_URL, '--json'])
      .it('downloads a playlist and handles events', (ctx) => {
        const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
        expect(downloadStub.callCount).to.be.equal(1);
        expect(downloadStub.firstCall.firstArg).to.equal(undefined);
        expect(jsonResponse).to.have.property('status').and.be.equal(0);
        expect(jsonResponse).to.have.property('result').and.to.have.length(1);
      });
  });

  describe('handles scheduler messages with bad data', () => {
    const eventEmitter = new EventEmitter();
    beforeEach(() => {
      downloadStub.restore();
      downloadStub = sandbox.stub(Scheduler.prototype, 'download').resolves([
        {
          item: PLAYLIST_ITEM,
          code: 0,
        },
      ]);
      sandbox
        .stub(EventEmitter.prototype, 'once')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .callsFake((event: string | symbol, listener: (...args: any[]) => void): Scheduler => {
          if (event === 'playlistItems') {
            listener({});
          }
          return eventEmitter as unknown as Scheduler;
        });
      sandbox
        .stub(EventEmitter.prototype, 'on')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .callsFake((event: string | symbol, listener: (...args: any[]) => void): Scheduler => {
          switch (event) {
            case 'contentLength': {
              listener({
                source: PLAYLIST_ITEM,
              });
              break;
            }
            case 'end': {
              listener({
                source: { ...PLAYLIST_ITEM, id: 'bad-id' },
              });
              break;
            }
            case 'timeout': {
              listener({
                source: { ...PLAYLIST_ITEM, id: 'bad-id' },
              });
              break;
            }
            case 'exit': {
              listener({
                source: { ...PLAYLIST_ITEM, id: 'bad-id' },
              });
              break;
            }
            case 'progress': {
              listener({
                source: { ...PLAYLIST_ITEM, id: 'bad-id' },
              });
              break;
            }
          }
          return eventEmitter as unknown as Scheduler;
        });
    });

    test
      .stdout()
      .command(['download:playlist', '--url', PLAYLIST_URL, '--json'])
      .it('handles scheduler messages with bad data', (ctx) => {
        const jsonResponse = JSON.parse(ctx.stdout) as JsonMap;
        expect(downloadStub.callCount).to.be.equal(1);
        expect(downloadStub.firstCall.firstArg).to.equal(undefined);
        expect(jsonResponse).to.have.property('status').and.be.equal(0);
        expect(jsonResponse).to.have.property('result').and.to.have.length(1);
      });
  });

  test
    .stdout()
    .command(['download:playlist', '--url', PLAYLIST_URL])
    .it('downloads a playlist', () => {
      expect(downloadStub.callCount).to.be.equal(1);
      expect(downloadStub.firstCall.firstArg).to.equal(undefined);
      expect(cliMock.table.firstCall.firstArg).to.deep.equal([
        {
          title: PLAYLIST_ITEM.title,
          author: PLAYLIST_ITEM.author.name,
          duration: PLAYLIST_ITEM.duration,
          id: PLAYLIST_ITEM.id,
        },
      ]);
      expect(cliMock.table.firstCall.args[1]).to.have.keys(Playlist.result.tableColumnData as string[]);
    });
});

describe('test the class', () => {
  it('test class static properties', () => {
    expect(Playlist.id).to.be.equal('download:playlist');
    expect(Playlist.description).to.be.equal('download a youtube playlist');
    expect(Playlist.examples).to.deep.equal([
      '$ ytdl download:playlist -u https://www.youtube.com/playlist?list=PL6B3937A5D230E335',
    ]);
  });
});
