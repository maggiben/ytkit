import { expect } from 'chai';
import * as sinon from 'sinon';
import * as util from '../../src/utils/utils';

describe('test utils', () => {
  it('test conversion of seconds into human readable time hh:mm:ss', () => {
    const humanTime = util.toHumanTime(3600);
    expect(humanTime).to.equal('1:00:00');
  });
  it('test conversion of seconds into human readable time mm:ss', () => {
    const humanTime = util.toHumanTime(1800);
    expect(humanTime).to.equal('30:00');
  });
  it('converts bytes to human readable unit', () => {
    const toHumanSize = util.toHumanSize(1024);
    expect(toHumanSize).to.equal('1KB');
  });
  it('converts bytes to human readable unit including zero', () => {
    const toHumanSize = util.toHumanSize(0);
    expect(toHumanSize).to.equal('0');
  });
  it('template a string with variables denoted by {prop}.', () => {
    const string = '{title}.{author}';
    const tmpl = util.tmpl(string, [{ title: 'Hey Jude', author: 'The Beatles' }]);
    expect(tmpl).to.equal('Hey Jude.The Beatles');
  });
  it('template a string with nested variables denoted by {prop.nested}..', () => {
    const string = '{title}.{author.name}';
    const tmpl = util.tmpl(string, [{ title: 'Hey Jude', author: { name: 'The Beatles' } }]);
    expect(tmpl).to.equal('Hey Jude.The Beatles');
  });
  it('template a string with undefined nested variables denoted by {prop.nested}..', () => {
    const string = '{title}.{author.age}';
    const tmpl = util.tmpl(string, [{ title: 'Hey Jude', author: { name: 'The Beatles' } }]);
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
    const throttled = util.throttle(callback, 100);

    throttled();

    clock.tick(99);
    expect(callback.notCalled).to.be.false;

    clock.tick(1);
    expect(callback.calledOnce).to.be.true;
    expect(new Date().getTime()).be.equal(100);
  });
});

describe('cloneJson', () => {
  it('make a deep clone', () => {
    const data = {
      id: '123',
      name: 'Anna',
      age: '35',
    };
    const result = util.cloneJson(data);
    expect(result).to.be.instanceOf(Object);
    expect(result).to.deep.equal(data);
    expect(Object.is(result, data)).to.be.false;
  });
});
