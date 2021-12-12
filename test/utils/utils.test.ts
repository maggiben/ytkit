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

describe('getValueFromMeta', () => {
  it('gets a value from a a nested object depending on a required', () => {
    const data = {
      user: {
        id: '123',
        name: 'Anna',
        age: '35',
      },
    };
    const defaultValue = 'my-defaul-value';
    let result: string | number;
    /* if param exists is fale function returns defaultValue or undefined */
    result = utils.getValueFromMeta<string>(data, 'user.name', false);
    expect(result).to.be.equal(undefined);
    /* if param exists is fale function will return the defaulValue */
    result = utils.getValueFromMeta<string>(data, 'user.name', false, defaultValue);
    expect(result).to.be.equal(defaultValue);
    /* test nested value */
    result = utils.getValueFromMeta<string>(data, 'user.name', true);
    expect(result).to.be.equal(data.user.name);
    /* test default value */
    result = utils.getValueFromMeta<string>(data, 'user.ssid', true, defaultValue);
    expect(result).to.be.equal(defaultValue);
    /* test no default value */
    result = utils.getValueFromMeta<string>(data, 'user.ssid', true);
    expect(result).to.be.equal(undefined);
    /* test the transform option */
    result = utils.getValueFromMeta<string>(data, 'user.name', true, defaultValue, (input: string) =>
      input.toUpperCase()
    );
    expect(result).to.equal(data.user.name.toUpperCase());
  });
});

describe('Url id', () => {
  const ytUrls = [
    'https://youtu.be/yVpbFMhOAwE',
    'https://www.youtube.com/embed/yVpbFMhOAwE',
    'youtu.be/yVpbFMhOAwE',
    'youtube.com/watch?v=yVpbFMhOAwE',
    'http://youtu.be/yVpbFMhOAwE',
    'http://www.youtube.com/embed/yVpbFMhOAwE',
    'http://www.youtube.com/watch?v=yVpbFMhOAwE',
    'http://www.youtube.com/watch?v=yVpbFMhOAwE&feature=g-vrec',
    'http://www.youtube.com/watch?v=yVpbFMhOAwE&feature=player_embedded',
    'http://www.youtube.com/v/yVpbFMhOAwE?fs=1&hl=en_US',
    'http://www.youtube.com/ytscreeningroom?v=yVpbFMhOAwE',
    'http://www.youtube.com/watch?NR=1&feature=endscreen&v=yVpbFMhOAwE',
    'http://www.youtube.com/user/Scobleizer#p/u/1/1p3vcRhsYGo',
    'http://www.youtube.com/watch?v=6zUVS4kJtrA&feature=c4-overview-vl&list=PLbzoR-pLrL6qucl8-lOnzvhFc2UM1tcZA',
    'https://www.youtube.com/watch?v=FZu097wb8wU&list=RDFZu097wb8wU',
  ];
  const ytPlaylistUrls = [
    'http://www.youtube.com/watch?v=6zUVS4kJtrA&feature=c4-overview-vl&list=PLbzoR-pLrL6qucl8-lOnzvhFc2UM1tcZA',
    'https://www.youtube.com/watch?v=FZu097wb8wU&list=RDFZu097wb8wU',
  ];
  const invalidYtPlaylistUrl = 'https://www.youtube.com/watch?v=FZu097wb8wU&list=';
  const invalidUrl = 'https://duckduckgo.com/';
  it('getYoutubeVideoId valid url', () => {
    ytUrls.forEach((ytUrl) => {
      const id = utils.getYoutubeVideoId(ytUrl);
      expect(id).to.be.a('string').and.length.greaterThanOrEqual(11);
    });
  });
  it('getYoutubeVideoId invalid url', () => {
    const id = utils.getYoutubeVideoId(invalidUrl);
    expect(id).to.be.undefined;
  });
  it('getYoutubeVideoId valid url', () => {
    ytPlaylistUrls.forEach((ytUrl) => {
      const id = utils.getYoutubePlaylistId(ytUrl);
      expect(id).to.be.a('string').and.length.greaterThanOrEqual(1);
    });
  });
  it('getYoutubeVideoId invalid playlist', () => {
    const id = utils.getYoutubePlaylistId(invalidYtPlaylistUrl);
    expect(id).to.be.undefined;
  });
  it('getYoutubeVideoId invalid url', () => {
    const id = utils.getYoutubePlaylistId(invalidUrl);
    expect(id).to.be.undefined;
  });
});
