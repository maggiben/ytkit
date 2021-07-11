import * as readline from 'readline';
import { Writable } from 'stream';
import * as sinon from 'sinon';
import cli from 'cli-ux';
import { expect } from 'chai';
import { Optional, Dictionary } from '@salesforce/ts-types';
import { UX } from '../src/Ux';

describe('UX', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('log() should only log to the logger when output IS NOT enabled', () => {
    const ux = new UX(false);
    const logMsg = 'test log() 1 for log wrapper';
    const logStub = sandbox.stub(cli, 'log');
    ux.log(logMsg);
    expect(logStub.called).to.equal(false);
  });

  describe('JSON', () => {
    it('log() should not log to stdout when json is set via the process args', () => {
      process.argv = ['--json'];
      const logStub = sandbox.stub(cli, 'log');
      const ux = new UX();
      const logMsg = 'test log() 1 for log wrapper';
      ux.log(logMsg);
      expect(logStub.called).to.equal(false);
    });
  });

  it('log() should log to the stdout when output IS enabled', () => {
    const ux = new UX(true);
    const logMsg = 'test log() 2 for log wrapper';
    const logStub = sandbox.stub(cli, 'log');
    ux.log(logMsg);

    expect(logStub.called).to.equal(true);
    expect(logStub.firstCall.args[0]).to.equal(logMsg);
  });

  it('logJson() should log to stdout (formatted)', () => {
    let retVal: Optional<Record<string, unknown>>;
    const styledObjectGetter = () => (x: Record<string, unknown>) => (retVal = x);
    sandbox.stub(cli, 'styledJSON').get(styledObjectGetter);
    const ux = new UX(true);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    ux.logJson(logMsg);

    expect(retVal).to.deep.equal(logMsg);
  });

  it('errorJson() should log to the stderr', () => {
    const ux = new UX(true);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    const consoleErrorStub = sandbox.stub(console, 'error');
    ux.errorJson(logMsg);

    expect(consoleErrorStub.called).to.equal(true);
    expect(consoleErrorStub.firstCall.args[0]).to.equal(JSON.stringify(logMsg, null, 4));
  });

  it('error() should only log when output IS NOT enabled', () => {
    const ux = new UX(false);
    const logMsg = 'test error() 1 for log wrapper';

    const consoleErrorStub = sandbox.stub(console, 'error');
    ux.error(logMsg);

    expect(consoleErrorStub.called).to.equal(false);
  });

  it('error() should log to the stderr when output IS enabled', () => {
    const ux = new UX(true);
    const logMsg = 'test error() 2 for log wrapper\n';

    const consoleErrorStub = sandbox.stub(console, 'error');
    ux.error(logMsg);

    expect(consoleErrorStub.called).to.equal(true);
    expect(consoleErrorStub.firstCall.args[0]).to.equal(logMsg);
  });

  it('styledObject() should only log IS NOT enabled', () => {
    const ux = new UX(false);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };

    const styledObjectStub = sandbox.stub(cli, 'styledObject');
    ux.styledObject(logMsg);

    expect(styledObjectStub.called).to.equal(false);
  });

  it('styledObject() should log to the logger and stdout when output IS enabled', () => {
    const ux = new UX(true);
    const logMsg = { key1: 'foo', key2: 9, key3: true, key4: [1, 2, 3] };
    const keysToLog = ['key1', 'key2', 'key3'];

    const styledObjectStub = sandbox.stub(cli, 'styledObject');
    ux.styledObject(logMsg, keysToLog);

    expect(styledObjectStub.called).to.equal(true);
    expect(styledObjectStub.firstCall.args[0]).to.equal(logMsg);
    expect(styledObjectStub.firstCall.args[1]).to.equal(keysToLog);
  });

  it('table() should only log when output IS NOT enabled', () => {
    let retVal: Optional<Dictionary>;
    const tableGetter = () => (x: Dictionary) => (retVal = x);
    sandbox.stub(cli, 'table').get(tableGetter);
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
    sandbox.stub(cli, 'table').get(tableGetter);
    const ux = new UX(true);
    const options = ['foo', 'bar', 'baz', wildKey];

    ux.table(tableData, options);

    expect(retVal.x).to.deep.equal(tableData);
    expect(retVal.y).to.deep.equal(expectedOptions);
  });

  it('table() should log in table format when output IS enabled with complex column config', () => {
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
    sandbox.stub(cli, 'table').get(tableGetter);
    const ux = new UX(true);

    ux.table(tableData, options);

    expect(retVal.x).to.deep.equal(tableData);
    expect(retVal.y).to.deep.equal(options);
  });

  it('table() should log in table format and accept options as an array of strings', () => {
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
    sandbox.stub(cli, 'table').get(tableGetter);
    const ux = new UX(true);

    ux.table(tableData, options);

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
  });

  it('cursorTo() should move the cursor to the specified position in a given TTY stream', () => {
    const writableStreamStub = sinon.createStubInstance(Writable);
    const cursorToGetter = () => (stdout: NodeJS.WritableStream, x: number, y?: number) => {
      expect(stdout).to.be.instanceof(Writable);
      expect(x).to.be.equal(0);
      expect(y).not.to.exist;
    };
    sandbox.stub(readline, 'cursorTo').get(cursorToGetter);

    const ux = new UX(true);

    ux.cursorTo(writableStreamStub as unknown as NodeJS.WritableStream, 0);
  });

  it('clearLine() should move the cursor to the specified position in a given TTY stream', () => {
    const writableStreamStub = sinon.createStubInstance(Writable);
    const clearLineGetter = () => (stdout: NodeJS.WritableStream, dir: number) => {
      expect(stdout).to.be.instanceof(Writable);
      expect(dir).to.be.equal(0);
    };
    sandbox.stub(readline, 'clearLine').get(clearLineGetter);

    const ux = new UX(true);

    ux.clearLine(writableStreamStub as unknown as NodeJS.WritableStream, 0);
  });
});
