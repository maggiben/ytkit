import { expect, test } from '@oclif/test';
import * as sinon from 'sinon';
import { JsonArray } from '@salesforce/ts-types';
import * as ytsr from 'ytsr';
import * as nock from 'nock';
import Search from '../../src/commands/search';

const searchFilterUrl = 'https://www.youtube.com/results?search_query=testing&sp=EgIQAQ%253D%253D';
const filters = ((): Map<string, Map<string, ytsr.Filter>> => {
  const values = new Map();
  values.set('Video', {
    name: 'Vide',
    active: false,
    url: searchFilterUrl,
    description: 'Search for Video',
  });
  const result = new Map();
  result.set('Type', values);
  return result as Map<string, Map<string, ytsr.Filter>>;
})();

const YT_HOST = 'https://www.youtube.com';
const SEARCH_PATH = '/results';
const API_PATH = '/youtubei/v1/search';

describe('search video with and without limits', () => {
  const searchQuery = 'testing';
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getFiltersStub: sinon.SinonStub;
  before(() => {
    nock.disableNetConnect();
  });

  after(() => {
    nock.enableNetConnect();
  });
  beforeEach(() => {
    getFiltersStub = sandbox.stub(ytsr, 'getFilters').callsFake((searchString: string) => {
      expect(searchString).an.to.include(searchQuery);
      return Promise.resolve(filters);
    });

    nock(YT_HOST)
      .get(SEARCH_PATH)
      // eslint-disable-next-line camelcase
      .query({ gl: 'US', hl: 'en', search_query: 'testing', sp: 'EgIQAQ%3D%3D' })
      .replyWithFile(200, 'test/pages/result.raw');

    nock(YT_HOST)
      .post(API_PATH, () => true)
      .query({ key: '<apikey>' })
      .replyWithFile(200, 'test/pages/secondpage.json');
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['search', '--query', searchQuery, '--limit', '25', '--json'])
    .it('searches using limit', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonArray;
      expect(getFiltersStub.callCount).to.equal(1);
      expect(jsonResponse).to.have.property('result').and.to.have.length(25);
    });

  test
    .stdout()
    .command(['search', '--query', searchQuery, '--json'])
    .it('searches with no limits (uses default = 100)', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonArray;
      expect(getFiltersStub.callCount).to.equal(1);
      expect(jsonResponse).to.have.property('result').and.to.have.length(100);
    });
});

describe('search video infinite (all) results', () => {
  const searchQuery = 'testing';
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getFiltersStub: sinon.SinonStub;
  const body1 = {
    context: {
      client: {
        utcOffsetMinutes: 0,
        gl: 'US',
        hl: 'en',
        clientName: 'WEB',
        clientVersion: '<client_version>',
      },
      user: {},
      request: {},
    },
    continuation: '<firstContinuationToken>',
  };
  const body2 = {
    context: {
      client: {
        utcOffsetMinutes: 0,
        gl: 'US',
        hl: 'en',
        clientName: 'WEB',
        clientVersion: '<client_version>',
      },
      user: {},
      request: {},
    },
    continuation: '<secondContinuationToken>',
  };
  before(() => {
    nock.disableNetConnect();
  });

  after(() => {
    nock.enableNetConnect();
  });
  beforeEach(() => {
    getFiltersStub = sandbox.stub(ytsr, 'getFilters').callsFake((searchString: string) => {
      expect(searchString).an.to.include(searchQuery);
      return Promise.resolve(filters);
    });

    nock(YT_HOST)
      .get(SEARCH_PATH)
      // eslint-disable-next-line camelcase
      .query({ gl: 'US', hl: 'en', search_query: 'testing', sp: 'EgIQAQ%3D%3D' })
      .replyWithFile(200, 'test/pages/result.raw');

    nock(YT_HOST, { reqheaders: {} })
      .post(API_PATH, JSON.stringify(body1))
      .query({ key: '<apikey>' })
      .replyWithFile(200, 'test/pages/secondpage.json');

    nock(YT_HOST, { reqheaders: {} })
      .post(API_PATH, JSON.stringify(body2))
      .query({ key: '<apikey>' })
      .replyWithFile(200, 'test/pages/singlepage.json');
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['search', '--query', searchQuery, '--limit', 'Infinity', '--json'])
    .it('searches with limit set to Infiniry', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonArray;
      expect(getFiltersStub.callCount).to.equal(1);
      expect(jsonResponse).to.have.property('result').and.to.have.length(325);
    });
});

describe('search video type not found', () => {
  const optFilters = ((): Map<string, Map<string, ytsr.Filter>> => {
    const result = new Map();
    return result as Map<string, Map<string, ytsr.Filter>>;
  })();
  const searchQuery = 'testing';
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let getFiltersStub: sinon.SinonStub;
  before(() => {
    nock.disableNetConnect();
  });

  after(() => {
    nock.enableNetConnect();
  });
  beforeEach(() => {
    getFiltersStub = sandbox.stub(ytsr, 'getFilters').callsFake((searchString: string) => {
      expect(searchString).an.to.include(searchQuery);
      return Promise.resolve(optFilters);
    });

    nock(YT_HOST)
      .get(SEARCH_PATH)
      // eslint-disable-next-line camelcase
      .query({ gl: 'US', hl: 'en', search_query: 'testing', sp: 'EgIQAQ%3D%3D' })
      .replyWithFile(200, 'test/pages/result.raw');

    nock(YT_HOST)
      .post(API_PATH, () => true)
      .query({ key: '<apikey>' })
      .replyWithFile(200, 'test/pages/secondpage.json');
  });
  afterEach(() => {
    sandbox.restore();
  });

  test
    .stdout()
    .command(['search', '--query', searchQuery, '--json'])
    .it('search video type not found --json', (ctx) => {
      const jsonResponse = JSON.parse(ctx.stdout) as JsonArray;
      expect(getFiltersStub.callCount).to.equal(1);
      expect(jsonResponse).to.have.property('status').and.to.be.equal(1);
    });

  test
    .stdout()
    .command(['search', '--query', searchQuery])
    .catch((error) => {
      expect(error).to.be.instanceof(Error);
    })
    .it('search video type not found (stdout)', (ctx) => {
      expect(ctx.stdout).to.be.equal('');
    });
});

describe('test the class', () => {
  it('test class static properties', () => {
    expect(Search.id).to.be.equal('search');
    expect(Search.description).to.be.equal('Search for Youtube for Videos');
    expect(Search.examples).to.deep.equal(['$ ytdl search -q banana']);
  });
});
