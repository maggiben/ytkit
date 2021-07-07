import * as sinon from 'sinon';
import cli from 'cli-ux';
import { expect } from 'chai';
import { Optional, Dictionary } from '@salesforce/ts-types';
import UX from '../src/Ux';

describe('UX', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let logStub: sinon.SinonStub;
  let errorStub: sinon.SinonStub;
  let tableStub: sinon.SinonStub;
  let styledObjectStub: sinon.SinonStub;
  let styledJSONStub: sinon.SinonStub;
  let consoleErrorStub: sinon.SinonStub;
  beforeEach(() => {
    logStub = sandbox.stub(cli, 'log');
    errorStub = sandbox.stub(cli, 'error');
    tableStub = sandbox.stub(cli, 'table');
    styledObjectStub = sandbox.stub(cli, 'styledObject');
    styledJSONStub = sandbox.stub(cli, 'styledJSON');
    consoleErrorStub = sandbox.stub(console, 'error');
  });

  afterEach(() => {
    logStub.restore();
    errorStub.restore();
    tableStub.restore();
    styledObjectStub.restore();
    styledJSONStub.restore();
    consoleErrorStub.restore();
  });

  it('log() should only log to the logger when output IS NOT enabled', () => {
    const ux = new UX(false);
    const logMsg = 'test log() 1 for log wrapper';

    const ux1 = ux.log(logMsg);
    expect(logStub.called).to.equal(false);
    expect(ux1).to.equal(ux);
  });

  describe('JSON', () => {
    it('log() should not log to stdout when json is set via the process args', () => {
      process.argv = ['--json'];
      const ux = new UX();
      const logMsg = 'test log() 1 for log wrapper';
      const ux1 = ux.log(logMsg);
      expect(logStub.called).to.equal(false);
      expect(ux1).to.equal(ux);
    });
  });

  it('log() should log to the stdout when output IS enabled', () => {
    const ux = new UX(true);
    const logMsg = 'test log() 2 for log wrapper';
    const ux1 = ux.log(logMsg);

    expect(logStub.called).to.equal(true);
    expect(logStub.firstCall.args[0]).to.equal(logMsg);
    expect(ux1).to.equal(ux);
  });

  it('logJson() should log to stdout (formatted)', () => {
    styledJSONStub.restore();
    let retVal: Optional<Record<string, unknown>>;
    const styledObjectGetter = () => (x: Record<string, unknown>) => (retVal = x);
    styledJSONStub = sandbox.stub(cli, 'styledJSON').get(styledObjectGetter);
    const ux = new UX(true);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    const ux1 = ux.logJson(logMsg);

    expect(retVal).to.deep.equal(logMsg);
    expect(ux1).to.equal(ux);
  });

  it('errorJson() should log to the stderr', () => {
    const ux = new UX(true);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    ux.errorJson(logMsg);

    expect(consoleErrorStub.called).to.equal(true);
    expect(consoleErrorStub.firstCall.args[0]).to.equal(JSON.stringify(logMsg, null, 4));
  });

  it('error() should only log when output IS NOT enabled', () => {
    const ux = new UX(false);
    const logMsg = 'test error() 1 for log wrapper';

    ux.error(logMsg);

    expect(errorStub.called).to.equal(false);
  });

  it('error() should log to the stderr when output IS enabled', () => {
    const ux = new UX(true);
    const logMsg = 'test error() 2 for log wrapper\n';

    ux.error(logMsg);

    expect(consoleErrorStub.called).to.equal(true);
    expect(consoleErrorStub.firstCall.args[0]).to.equal(logMsg);
  });

  it('styledObject() should only log IS NOT enabled', () => {
    const ux = new UX(false);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    const ux1 = ux.styledObject(logMsg);

    expect(styledObjectStub.called).to.equal(false);
    expect(ux1).to.equal(ux);
  });

  it('styledObject() should log to the logger and stdout when output IS enabled', () => {
    const ux = new UX(true);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };
    const keysToLog = ['key1', 'key2', 'key3'];

    const ux1 = ux.styledObject(logMsg, keysToLog);

    expect(styledObjectStub.called).to.equal(true);
    expect(styledObjectStub.firstCall.args[0]).to.equal(logMsg);
    expect(styledObjectStub.firstCall.args[1]).to.equal(keysToLog);
    expect(ux1).to.equal(ux);
  });

  it('table() should only log when output IS NOT enabled', () => {
    tableStub.restore();
    let retVal: Optional<Dictionary>;
    const tableGetter = () => (x: Dictionary) => (retVal = x);
    tableStub = sandbox.stub(cli, 'table').get(tableGetter);
    const ux = new UX(false);
    const tableData = [
      { foo: 'amazing!', bar: 3, baz: true },
      { foo: 'incredible!', bar: 0, baz: false },
      { foo: 'truly amazing!', bar: 9, baz: true },
    ];
    const ux1 = ux.table(tableData);

    expect(retVal).to.equal(undefined);
    expect(ux1).to.equal(ux);
  });

  it('table() should log output in table format when output IS enabled with simple column config', () => {
    tableStub.restore();
    const retVal: Dictionary = {};
    const wildKey = 'some wildAnd-Crazy_key';
    const tableData = [
      { foo: 'amazing!', bar: 3, baz: true },
      { foo: 'incredible!', bar: 0, baz: false },
      { foo: 'truly amazing!', bar: 9, baz: true },
    ];
    const expectedOptions = {
      foo: {
        key: 'foo',
      },
      bar: {
        key: 'bar',
      },
      baz: {
        key: 'baz',
      },
      [wildKey]: {
        key: 'some wildAnd-Crazy_key',
      },
    };
    const tableGetter = () => (x: typeof tableData, y: typeof expectedOptions) => {
      retVal.x = x;
      retVal.y = y;
    };
    tableStub = sandbox.stub(cli, 'table').get(tableGetter);
    const ux = new UX(true);
    const options = ['foo', 'bar', 'baz', wildKey];

    const ux1 = ux.table(tableData, options);

    expect(retVal.x).to.deep.equal(tableData);
    expect(retVal.y).to.deep.equal(expectedOptions);
    expect(ux1).to.equal(ux);
  });

  it('table() should log in table format when output IS enabled with complex column config', () => {
    tableStub.restore();
    const retVal: Dictionary = {};
    const tableData = [
      { foo: 'amazing!', bar: 3, baz: true },
      { foo: 'incredible!', bar: 0, baz: false },
      { foo: 'truly amazing!', bar: 9, baz: true },
    ];
    const options = {
      foo: { key: 'foo' },
      bar: {
        key: 'bar',
        label: '*** BAR ***',
        // (matches oclif)
        format: (val: Dictionary) => (val != null ? val.toString() : ''),
      },
      baz: {
        key: 'ZaB',
      },
    };
    const tableGetter = () => (x: typeof tableData, y: typeof options) => {
      retVal.x = x;
      retVal.y = y;
    };
    tableStub = sandbox.stub(cli, 'table').get(tableGetter);
    const ux = new UX(true);

    const ux1 = ux.table(tableData, options);

    expect(retVal.x).to.deep.equal(tableData);
    expect(retVal.y).to.deep.equal(options);
    expect(ux1).to.equal(ux);
  });

  it('table() should log in table format and accept options as an array of strings', () => {
    tableStub.restore();
    const retVal: Dictionary = {};
    const tableData = [
      { foo: 'amazing!', bar: 3, baz: true },
      { foo: 'incredible!', bar: 0, baz: false },
      { foo: 'truly amazing!', bar: 9, baz: true },
    ];
    const options = ['foo', 'bar', 'baz'];

    const tableGetter = () => (x: typeof tableData, y: typeof options) => {
      retVal.x = x;
      retVal.y = y;
    };
    tableStub = sandbox.stub(cli, 'table').get(tableGetter);
    const ux = new UX(true);

    const ux1 = ux.table(tableData, options);

    const transformedOutput = {
      foo: {
        key: 'foo',
      },
      bar: {
        key: 'bar',
      },
      baz: {
        key: 'baz',
      },
    };
    expect(retVal.x).to.deep.equal(tableData);
    expect(retVal.y).to.deep.equal(transformedOutput);
    expect(ux1).to.equal(ux);
  });
});
