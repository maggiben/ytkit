import * as path from 'path';
// import { fail } from 'assert';
import * as nock from 'nock';
import { expect, assert } from 'chai';
import * as sinon from 'sinon';
import { Scheduler } from '../../src/utils/scheduler';

const YT_HOST = 'https://www.youtube.com';
const PLAYLIST_PATH = '/playlist';
process.env.YTDL_NO_UPDATE = 'true';
process.env.NODE_ENV = 'test';

describe('scheduler', () => {
  before(() => {
    nock.disableNetConnect();
  });

  after(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('runs all tasks exit with success', async () => {
    const limit = 30;
    const pages = 0;
    const scope = nock(YT_HOST)
      .get(PLAYLIST_PATH)
      .query({ gl: 'US', hl: 'en', list: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV' })
      .replyWithFile(200, 'test/pages/firstpage_01.html');

    const options: Scheduler.Options = {
      playlistId: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV',
      playlistOptions: {
        gl: 'US',
        hl: 'en',
        limit,
        pages,
      },
    };
    process.env.NODE_WORKER = path.join(__dirname, '..', 'mocks', 'worker_ok.js');
    const scheduler = new Scheduler(options);
    const results = await scheduler.download();
    expect(results).to.be.a('array').and.to.have.length(limit);
    results.forEach((result) => {
      expect(result?.code).to.equal(0);
    });
    scope.done();
  });

  it('runs all tasks exit with fail', async () => {
    const limit = 10;
    const pages = 0;
    const scope = nock(YT_HOST)
      .get(PLAYLIST_PATH)
      .query({ gl: 'US', hl: 'en', list: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV' })
      .replyWithFile(200, 'test/pages/firstpage_01.html');

    const options: Scheduler.Options = {
      playlistId: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV',
      retries: 2,
      playlistOptions: {
        gl: 'US',
        hl: 'en',
        limit,
        pages,
      },
    };
    process.env.NODE_WORKER = path.join(__dirname, '..', 'mocks', 'worker_nok.js');
    const scheduler = new Scheduler(options);
    const results = await scheduler.download();
    expect(results).to.be.a('array').and.to.have.length(limit);
    results.forEach((result) => {
      if (result) {
        const { item } = result;
        expect(result.code).to.equal(1);
        expect(result.error).to.include(item.id).and.to.include('exited');
      } else {
        assert.fail('no results');
      }
    });
    scope.done();
  });

  it('runs all tasks some fail but scheduler retries', async () => {
    const limit = 20;
    const pages = 0;
    const scope = nock(YT_HOST)
      .get(PLAYLIST_PATH)
      .query({ gl: 'US', hl: 'en', list: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV' })
      .replyWithFile(200, 'test/pages/firstpage_01.html');

    const options: Scheduler.Options = {
      playlistId: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV',
      playlistOptions: {
        gl: 'US',
        hl: 'en',
        limit,
        pages,
      },
    };
    process.env.NODE_WORKER = path.join(__dirname, '..', 'mocks', 'worker_some_fail.js');
    const onStub: sinon.SinonStub = sinon.stub(Scheduler.prototype, 'emit').returns(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // .callsFake((eventName: string | symbol, listener: (...args: any[]) => void) => {
    //   console.log('eventName', eventName);
    //   expect(eventName).to.be.a('string').and.to.have.length.greaterThan(0);
    //   expect(listener).to.be.a('function');
    //   return sinon.createStubInstance(Scheduler);
    // });
    const scheduler = new Scheduler(options);
    const results = await scheduler.download();
    expect(results).to.be.a('array').and.to.have.length(limit);
    const hasErrors = results.every((result) => {
      return !!result?.code;
    });
    expect(hasErrors).to.be.false;
    expect(onStub.callCount).to.be.greaterThan(1);
    onStub.restore();
    scope.done();
  });
});

describe('scheduler error', () => {
  let onStub: sinon.SinonStub;
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  before(() => {
    nock.disableNetConnect();
  });

  beforeEach(() => {
    onStub = sandbox.stub(Scheduler.prototype, 'emit').returns(true);
  });

  after(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    onStub.restore();
    sandbox.restore();
  });

  it('runs all tasks every throw error', async () => {
    const limit = 10;
    const pages = 0;
    const scope = nock(YT_HOST)
      .get(PLAYLIST_PATH)
      .query({ gl: 'US', hl: 'en', list: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV' })
      .replyWithFile(200, 'test/pages/firstpage_01.html');

    const options: Scheduler.Options = {
      playlistId: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV',
      output: 'myvid.mp4',
      timeout: 150,
      maxconnections: 10,
      retries: 2,
      playlistOptions: {
        gl: 'US',
        hl: 'en',
        limit,
        pages,
      },
    };
    process.env.NODE_WORKER = path.join(__dirname, '..', 'mocks', 'worker_error.js');
    const scheduler = new Scheduler(options);
    const results = await scheduler.download();
    expect(results).to.be.a('array').and.to.have.length(limit);
    const hasErrors = results.every((result) => {
      return !!result?.code;
    });
    expect(hasErrors).to.be.true;
    expect(onStub.callCount).to.be.greaterThan(1);
    scope.done();
  });
});

describe('scheduler retries', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let onlineCounter = 0;
  let emitStub: sinon.SinonStub;
  before(() => {
    nock.disableNetConnect();
  });

  beforeEach(() => {
    emitStub = sandbox.stub(Scheduler.prototype, 'emit').callsFake((eventName: string | symbol): boolean => {
      if (eventName === 'online') {
        onlineCounter += 1;
      }
      return true;
    });
  });

  after(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    emitStub.restore();
    sandbox.restore();
  });

  it('runs all tasks every exit with fail and retries 2 times', async () => {
    const limit = 20;
    const pages = 0;
    const retries = 2;
    const scope = nock(YT_HOST)
      .get(PLAYLIST_PATH)
      .query({ gl: 'US', hl: 'en', list: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV' })
      .replyWithFile(200, 'test/pages/firstpage_01.html');

    const options: Scheduler.Options = {
      playlistId: 'PL0123456789ABCDEFGHIJKLMNOPQRSTUV',
      retries,
      playlistOptions: {
        gl: 'US',
        hl: 'en',
        limit,
        pages,
      },
    };
    process.env.NODE_WORKER = path.join(__dirname, '..', 'mocks', 'worker_nok.js');
    const scheduler = new Scheduler(options);
    const results = await scheduler.download();
    expect(results).to.be.a('array').and.to.have.length(limit);
    expect(onlineCounter).to.equal(limit * (retries + 1));
    scope.done();
  });
});
