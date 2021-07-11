import { expect } from 'chai';
import * as sinon from 'sinon';
import * as utils from '../../src/utils/utils';

describe('test utils', () => {
  it('test conversion of seconds into human readable time hh:mm:ss', () => {
    const humanTime = utils.toHumanTime(3600);
    expect(humanTime).to.equal('1:00:00');
  });
  it('test conversion of seconds into human readable time hh:mm:ss (with minutes padded with zeroes)', () => {
    const humanTime = utils.toHumanTime(3660);
    expect(humanTime).to.equal('1:01:00');
  });
  it('test conversion of seconds into human readable time hh:mm:ss', () => {
    const humanTime = utils.toHumanTime(60);
    expect(humanTime).to.equal('1:00');
  });
  it('test conversion of seconds into human readable time hh:mm:ss (padd seconds padded with zeroes)', () => {
    const humanTime = utils.toHumanTime(1);
    expect(humanTime).to.equal('0:01');
  });
  it('test conversion of seconds into human readable time hh:mm:ss (padd seconds padded with zeroes)', () => {
    const humanTime = utils.toHumanTime(20);
    expect(humanTime).to.equal('0:20');
  });
  it('test conversion of seconds into human readable time hh:mm:ss', () => {
    const humanTime = utils.toHumanTime(4800);
    expect(humanTime).to.equal('1:20:00');
  });
  it('test conversion of seconds into human readable time mm:ss', () => {
    const humanTime = utils.toHumanTime(1800);
    expect(humanTime).to.equal('30:00');
  });
  it('converts bytes to human readable unit', () => {
    const toHumanSize = utils.toHumanSize(1024);
    expect(toHumanSize).to.equal('1KB');
  });
  it('converts bytes to human readable unit including zero', () => {
    const toHumanSize = utils.toHumanSize(0);
    expect(toHumanSize).to.equal('0');
  });
  it('template a string with variables denoted by {prop}.', () => {
    const string = '{title}.{author}';
    const tmpl = utils.tmpl(string, [{ title: 'Hey Jude', author: 'The Beatles' }]);
    expect(tmpl).to.equal('Hey Jude.The Beatles');
  });
  it('template a string with nested variables denoted by {prop.nested}..', () => {
    const string = '{title}.{author.name}';
    const tmpl = utils.tmpl(string, [{ title: 'Hey Jude', author: { name: 'The Beatles' } }]);
    expect(tmpl).to.equal('Hey Jude.The Beatles');
  });
  it('template a string with undefined nested variables denoted by {prop.nested}..', () => {
    const string = '{title}.{author.age}';
    const tmpl = utils.tmpl(string, [{ title: 'Hey Jude', author: { name: 'The Beatles' } }]);
    expect(tmpl).to.equal('Hey Jude.{author.age}');
  });
});

describe('time bending (sinon)', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('calls callback after 100ms', () => {
    const callback = sinon.spy();
    const throttled = utils.throttle(callback, 100);

    throttled();

    clock.tick(99);
    expect(callback.notCalled).to.be.false;

    clock.tick(1);
    expect(callback.calledOnce).to.be.true;
    expect(new Date().getTime()).be.equal(100);
  });

  it('calls will be throttled if called before time expires', () => {
    const callback = sinon.spy();
    const throttled = utils.throttle(callback, 100);

    throttled();

    clock.tick(99);
    expect(callback.notCalled).to.be.false;

    clock.tick(1);
    expect(callback.calledOnce).to.be.true;
    expect(new Date().getTime()).be.equal(100);
    clock.tick(10);
    throttled();
    expect(callback.callCount).to.be.equal(2);
    clock.tick(10);
    throttled();
    expect(callback.callCount).to.be.equal(2);
  });
});

describe('cloneJson', () => {
  it('make a deep clone', () => {
    const data = {
      id: '123',
      name: 'Anna',
      age: '35',
    };
    const result = utils.cloneJson(data);
    expect(result).to.be.instanceOf(Object);
    expect(result).to.deep.equal(data);
    expect(Object.is(result, data)).to.be.false;
  });
});
