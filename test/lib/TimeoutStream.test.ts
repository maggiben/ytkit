import { PassThrough } from 'stream';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as utils from '../../src/utils/utils';
import TimeoutStream from '../../src/lib/TimeoutStream';

const buffer = Buffer.from('DEADBEEF', 'utf8');

describe('TimeoutStream', () => {
  const timeout = 1000;
  const stream = new PassThrough();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('TimeoutStream', () => {
    const timeoutStream = new TimeoutStream({ timeout });
    stream.pipe(timeoutStream);
    expect(timeoutStream.elapsed(false)).to.be.equal(0);
  });
});

describe('TimeoutStream timeout', () => {
  const timeout = 1000;
  const stream = new PassThrough();
  let clock: sinon.SinonFakeTimers;
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();

  beforeEach(() => {
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('TimeoutStream timeout', (done) => {
    const timeoutStream = new TimeoutStream({ timeout });
    timeoutStream.once('timeout', () => {
      done();
    });
    stream.pipe(timeoutStream);
    stream.push(buffer);
    expect(timeoutStream.elapsed(false)).to.be.equal(0);
    clock.tick(timeout);
    expect(timeoutStream.elapsed(false)).to.be.equal(1);
  });

  it('TimeoutStream timeout elapsed', (done) => {
    const timeoutStream = new TimeoutStream({ timeout });
    timeoutStream.once('timeout', () => {
      done();
    });
    stream.pipe(timeoutStream);
    stream.push(buffer);
    expect(timeoutStream.elapsed()).to.be.equal(utils.toHumanTime(0));
    clock.tick(timeout);
    expect(timeoutStream.elapsed()).to.be.equal(utils.toHumanTime(1));
  });
});

describe('TimeoutStream clearTimeout', () => {
  const timeout = 1000;
  const stream = new PassThrough();
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('TimeoutStream clearTimeout call end on timeoutStream', (done) => {
    const timeoutStream = new TimeoutStream({ timeout });
    timeoutStream.once('clearTimeout', () => {
      done();
    });
    stream.pipe(timeoutStream);
    timeoutStream.end();
  });

  it('TimeoutStream clearTimeout call close on timeoutStream', (done) => {
    const timeoutStream = new TimeoutStream({ timeout });
    timeoutStream.once('clearTimeout', () => {
      done();
    });
    stream.pipe(timeoutStream);
    timeoutStream.emit('close');
  });

  it('TimeoutStream clearTimeout call finish on timeoutStream', (done) => {
    const timeoutStream = new TimeoutStream({ timeout });
    timeoutStream.once('clearTimeout', () => {
      done();
    });
    stream.pipe(timeoutStream);
    timeoutStream.emit('finish');
  });

  it('TimeoutStream clearTimeout call end on read stream', (done) => {
    const timeoutStream = new TimeoutStream({ timeout });
    timeoutStream.once('clearTimeout', () => {
      done();
    });
    stream.pipe(timeoutStream);
    stream.end();
  });
});
