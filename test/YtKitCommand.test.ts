/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fail } from 'assert';
import * as chalk from 'chalk';
import { stubInterface } from '@salesforce/ts-sinon';
import {
  AnyJson,
  Dictionary,
  ensureAnyJson,
  ensureJsonMap,
  JsonArray,
  JsonMap,
  keysOf,
  Optional,
} from '@salesforce/ts-types';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { YtKitCommand, Result, YtKitResult } from '../src/YtKitCommand';
import { flags, FlagsConfig } from '../src/YtKitFlags';
import { UX } from '../src/Ux';
import { cloneJson } from '../src/utils/utils';

interface TestCommandMeta {
  cmd: typeof YtKitCommand; // the command constructor props
  cmdInstance: YtKitCommand; // the command instance props
  data?: AnyJson;
}
// An object to keep track of what is set on the test command constructor and instance by YtKitCommand
let testCommandMeta: TestCommandMeta;

// The test command
class BaseTestCommand extends YtKitCommand {
  public static id = '1';
  public static output: string | JsonArray = 'default test output';
  public static flagsConfig: FlagsConfig = {
    flag1: flags.string({ char: 'f', description: 'my desc' }),
  };
  public static result: Dictionary;
  protected get statics(): typeof BaseTestCommand {
    return this.constructor as typeof BaseTestCommand;
  }

  public async run() {
    testCommandMeta = {
      cmdInstance: this,
      cmd: this.statics,
    };
    return this.statics.output;
  }
}

// Props that should always be added to the test command constructor
const DEFAULT_CMD_PROPS = {
  flags: {
    json: { type: 'boolean' },
  },
};

// Props that should always be added to the test command instance
const DEFAULT_INSTANCE_PROPS = {
  flags: {},
  args: {},
  isJson: false,
};

// Initial state of UX output by the command.
const UX_OUTPUT_BASE = {
  log: new Array<string>(),
  error: new Array<string>(),
  errorJson: new Array<Record<string, unknown>>(),
  table: new Array<Record<string, unknown>>(),
  logJson: new Array<Record<string, unknown>>(),
};

// Actual UX output by the command
let UX_OUTPUT: typeof UX_OUTPUT_BASE;

async function mockStdout(test: (outLines: string[]) => Promise<void>) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const oldStdoutWriter = process.stdout.write.bind(process.stdout);
  const lines: string[] = [];
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  process.stdout.write = (message: string) => {
    if (message) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      lines.push(message.toString());
    }
  };

  try {
    await test(lines);
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    process.stdout.write = oldStdoutWriter;
  }
}

interface IErrorOutput {
  error: string[];
}

const buildErrorOutput = (message: string): IErrorOutput => {
  return {
    error: [[chalk.bold(`ERROR ${BaseTestCommand.id}`), chalk.red(message)].join('\n')],
  };
};

describe('YtKitCommand', () => {
  const sandbox: sinon.SinonSandbox = sinon.createSandbox();
  let logJsonStub: sinon.SinonStub;
  let errorStub: sinon.SinonStub;

  beforeEach(() => {
    process.exitCode = 0;

    UX_OUTPUT = cloneJson(UX_OUTPUT_BASE);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sandbox.stub(UX.prototype, 'log').callsFake((args: string): UX => UX_OUTPUT.log.push(args) as unknown as UX);
    logJsonStub = sandbox
      .stub(UX.prototype, 'logJson')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .callsFake((args: Record<string, unknown>) => UX_OUTPUT.logJson.push(args) as unknown as UX);
    errorStub = sandbox
      .stub(UX.prototype, 'error')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .callsFake((args: string | Error) => UX_OUTPUT.error.push(args.toString()) as unknown as UX);
    sandbox
      .stub(UX.prototype, 'errorJson')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .callsFake((args: Record<string, unknown>) => UX_OUTPUT.errorJson.push(args) as unknown as UX);
    sandbox
      .stub(UX.prototype, 'table')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .callsFake((args: AnyJson) => UX_OUTPUT.table.push(args as Record<string, unknown>) as unknown as UX);

    // Ensure BaseTestCommand['result'] is not defined before all tests
    BaseTestCommand.result = {};

    // Ensure BaseTestCommand.flagsConfig is returned to base state
    BaseTestCommand.flagsConfig = {
      flag1: flags.string({ char: 'f', description: 'my desc' }),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function verifyCmdFlags(verifications: Dictionary<any>) {
    const merged = Object.assign({}, DEFAULT_CMD_PROPS.flags, verifications);
    const numOfFlagsMessage = 'Number of flag definitions for the command should match';
    expect(keysOf(testCommandMeta.cmd.flags).length, numOfFlagsMessage).to.equal(keysOf(merged).length);
    keysOf(merged).forEach((key) => {
      expect(testCommandMeta.cmd.flags, `test for flag: ${key}`).to.have.property(key).and.include(merged[key]);
    });
  }

  function verifyInstanceProps(props: Dictionary = {}) {
    const merged = Object.assign({}, DEFAULT_INSTANCE_PROPS, props);
    keysOf(testCommandMeta.cmdInstance)
      .filter((key) => !!merged[key])
      .forEach((key) => {
        expect(testCommandMeta.cmdInstance[key], `test for instance prop: ${key}`).to.deep.equal(merged[key]);
      });

    expect(testCommandMeta.cmdInstance['ux']).to.be.ok.and.be.instanceof(UX);
  }

  function verifyUXOutput(output = {}) {
    const out = Object.assign({}, UX_OUTPUT_BASE, output);
    keysOf(out).forEach((key) => {
      expect(UX_OUTPUT[key], `test UX output for ${key}()`).to.deep.equal(out[key]);
    });
  }

  it('should type this', () => {
    let result: JsonMap = {};
    const x: YtKitResult = {
      display(): void {
        result = ensureJsonMap(this.data);
      },
    };
    if (x.display) {
      const resultStub = stubInterface<Result>(sandbox, { data: { foo: 'bar' } });

      x.display.call(resultStub);
      expect(result).to.have.property('foo', 'bar');
    }
  });

  it('getFlag', async () => {
    const myValue = 'MyValue';
    // Run the command
    class TestCommand extends BaseTestCommand {
      public static output: string | JsonArray = 'default test output';
      public static readonly flagsConfig: FlagsConfig = {
        myflag: flags.string({
          char: 'm',
          description: 'foo',
        }),
      };
      protected get statics(): typeof TestCommand {
        return this.constructor as typeof TestCommand;
      }
      public async run() {
        testCommandMeta = {
          cmdInstance: this,
          cmd: this.statics,
          data: this.getFlag<string>('myflag'),
        };
        return this.statics.output;
      }
    }
    // Run the command
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const output = (await TestCommand.run(['--myflag', myValue])) as string;
    expect(output).to.equal(TestCommand.output);
    verifyCmdFlags({ myflag: { type: 'option' } });
    expect(testCommandMeta.data).to.equal(myValue);
  });

  it('should always add YtKitCommand required flags --json', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const output = (await TestCommand.run([])) as string;

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should add an YTKIT flag when enabled from flagsConfig', async () => {
    class TestCommand extends BaseTestCommand {}
    TestCommand.flagsConfig.quiet = flags.builtin();

    // Run the command
    const output = (await TestCommand.run([])) as string;

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({
      flag1: { type: 'option' },
      quiet: { type: 'boolean' },
    });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should error on unsupported builtin flag', async () => {
    class TestCommand extends BaseTestCommand {}
    TestCommand.flagsConfig.unsupported = flags.builtin();

    return mockStdout(async () => {
      // Run the command
      let output: Optional<string>;
      const errorMessage = 'Expected EEXIT error';
      try {
        output = (await TestCommand.run(['-h'])) as string;
        fail(errorMessage);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        if (error instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(error?.message).to.equal(errorMessage);
        }
      }

      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
    });
  });

  it('should error on unsupported type of flag', async () => {
    class TestCommand extends BaseTestCommand {}
    TestCommand.flagsConfig.BadFlag = flags.boolean();

    return mockStdout(async () => {
      // Run the command
      let output: Optional<string>;
      const errorMessage = 'Expected EEXIT error';
      try {
        output = (await TestCommand.run(['-h'])) as string;
        fail(errorMessage);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        if (error instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(error?.message).to.equal(errorMessage);
        }
      }

      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
    });
  });

  it('should add args and flags to the command instance', async () => {
    class TestCommand extends BaseTestCommand {}
    const cmdArgs = [{ name: 'file' }];
    TestCommand['args'] = cmdArgs;

    // Run the command
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const output = await TestCommand.run(['arg1_val', '--flag1', 'flag1_val']);

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args').to.equal(cmdArgs);
    verifyCmdFlags({
      flag1: { type: 'option' },
    });
    verifyInstanceProps({
      flags: Object.assign({ flag1: 'flag1_val' }, DEFAULT_INSTANCE_PROPS.flags),
      args: { file: 'arg1_val' },
    });
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput();
  });

  it('should honor the -h flag to generate help output when the subclass does not define its own flag for -h', async () => {
    class TestCommand extends BaseTestCommand {}

    return mockStdout(async (lines: string[]) => {
      let output: Optional<string>;
      const errorMessage = 'Expected EEXIT error';
      try {
        output = (await TestCommand.run(['-h'])) as string;
        fail(errorMessage);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        if (error instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(error?.message).to.equal(errorMessage);
        }
      }

      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      // Check that the first line of the logged output is `USAGE` once ANSI colors have been removed
      expect(lines.length).to.be.gte(1);
      // eslint-disable-next-line no-control-regex
      const help = lines[0].slice(0, lines[0].indexOf('\n')).replace(/\u001b\[[0-9]+m/g, '');
      expect(help).to.equal('USAGE');
    });
  });

  it('should honor the -h flag to generate help output, even when the subclass defines its own help flag', () => {
    class TestCommand extends BaseTestCommand {
      public static flagsConfig = {
        help: flags.help({ char: 'h' }),
      };
    }

    return mockStdout(async (lines: string[]) => {
      // Run the command
      let output: Optional<string>;
      const errorMessage = 'Expected EEXIT error';
      try {
        output = (await TestCommand.run(['-h'])) as string;
        fail(errorMessage);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        if (error instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(error?.message).to.equal(errorMessage);
        }
      }

      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      expect(lines.length).to.be.gte(1);
      // Check that the first line of the logged output is `USAGE` once ANSI colors have been removed
      // expect(lines.length).to.be.gte(1);
      // eslint-disable-next-line no-control-regex
      const help = lines[0].slice(0, lines[0].indexOf('\n')).replace(/\u001b\[[0-9]+m/g, '');
      expect(help).to.equal('USAGE');
    });
  });

  it('should not honor the -h flag to generate help output when used for another purpose by the subclass', () => {
    class TestCommand extends BaseTestCommand {
      public static flagsConfig = {
        foo: flags.boolean({ char: 'h', description: 'foo' }),
      };
    }

    return mockStdout(async () => {
      const output = (await TestCommand.run(['-h'])) as string;

      expect(output).to.equal(TestCommand.output);
      expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
      verifyInstanceProps({
        flags: Object.assign({ foo: true }, DEFAULT_INSTANCE_PROPS.flags),
      });
      const expectedResult = {
        data: TestCommand.output,
        tableColumnData: undefined,
      };
      expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
      verifyUXOutput();
    });
  });

  describe('JSON', () => {
    it('should set this.isJson and only output ux.logJson with the --json flag', async () => {
      // Run the command
      class TestCommand extends BaseTestCommand {}
      const output = (await TestCommand.run(['--json'])) as AnyJson;

      expect(output).to.equal(TestCommand.output);
      expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
      verifyCmdFlags({ flag1: { type: 'option' } });
      verifyInstanceProps({
        flags: Object.assign({ json: true }, DEFAULT_INSTANCE_PROPS.flags),
        isJson: true,
      });
      const expectedResult = {
        data: TestCommand.output,
        tableColumnData: undefined,
      };
      expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
      verifyUXOutput({ logJson: [{ status: 0, result: TestCommand.output }] });
    });
  });

  it('should allow adding information to the returned object for --json', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {
      protected getJsonResultObject(result: AnyJson, status: number) {
        return Object.assign(super.getJsonResultObject(result, status), {
          myData: 'test',
        });
      }
    }
    const output = (await TestCommand.run(['--json'])) as AnyJson;

    expect(output).to.equal(TestCommand.output);
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.include(expectedResult);
    verifyUXOutput({ logJson: [{ status: 0, result: TestCommand.output, myData: 'test' }] });
  });

  it('should use table formatting with tableColumnData prop', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const tableColumnData = ['foo', 'bar', 'baz'];
    TestCommand['tableColumnData'] = tableColumnData;
    TestCommand.output = [
      { foo: 1000, bar: 'moscow mule', baz: false },
      { foo: 2000, bar: 'The Melvin', baz: true },
      { foo: 3000, bar: 'NE IPA', baz: true },
      { foo: 4000, bar: 'Guinness', baz: 0 },
    ];
    const output = (await TestCommand.run([])) as JsonArray;

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ table: [TestCommand.output] });
  });

  it('should output "No results found." when no table results were returned', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const tableColumnData = ['foo', 'bar', 'baz'];
    TestCommand['tableColumnData'] = tableColumnData;
    TestCommand.output = [] as JsonArray;
    const output = (await TestCommand.run([])) as JsonArray;

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ log: ['No results found.'] });
  });

  it('should use table formatting with result.tableColumnData object', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    const tableColumnData = ['foo', 'bar', 'baz'];
    TestCommand['result']['tableColumnData'] = tableColumnData;
    TestCommand.output = [
      { foo: 1000, bar: 'moscow mule', baz: false },
      { foo: 2000, bar: 'The Melvin', baz: true },
      { foo: 3000, bar: 'NE IPA', baz: true },
      { foo: 4000, bar: 'Guinness', baz: 0 },
    ];
    const output = (await TestCommand.run([])) as JsonArray;

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ table: [TestCommand.output] });
  });

  it('should check the shape of YtKitResult', async () => {
    // Run the command
    const tableColumnData = {
      columns: [
        { key: 'foo', label: 'Foo' },
        { key: 'bar', label: 'Bar' },
        { key: 'baz', label: 'Baz' },
      ],
    };
    // Implement a new command here to ensure the compiler checks the shape of `result`
    class MyTestCommand extends BaseTestCommand {}
    MyTestCommand['result']['display'] = function (this: Result) {
      this.ux.log(`CUSTOM: ${this.data?.toString()}`);
    };
    MyTestCommand['result']['tableColumnData'] = tableColumnData;
    MyTestCommand.output = [
      { Foo: 1000, Bar: 'moscow mule', Baz: false },
      { Foo: 2000, Bar: 'The Melvin', Baz: true },
      { Foo: 3000, Bar: 'NE IPA', Baz: true },
      { Foo: 4000, Bar: 'Guinness', Baz: 0 },
    ];
    const output = (await MyTestCommand.run([])) as JsonArray;

    expect(output).to.equal(MyTestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: MyTestCommand.output,
      tableColumnData,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    verifyUXOutput({ log: [`CUSTOM: ${MyTestCommand.output}`] });
  });

  it('should override result display with result.display prop', async () => {
    // Run the command
    class TestCommand extends BaseTestCommand {}
    TestCommand['result']['display'] = function (this: Result) {
      this.ux.log(`CUSTOM: ${this.data?.toString()}`);
    };
    TestCommand.output = 'new string output';
    const output = (await TestCommand.run([])) as string;

    expect(output).to.equal(TestCommand.output);
    expect(testCommandMeta.cmd.args, 'TestCommand.args should be undefined').to.equal(undefined);
    verifyCmdFlags({ flag1: { type: 'option' } });
    verifyInstanceProps();
    const expectedResult = {
      data: TestCommand.output,
      tableColumnData: undefined,
    };
    expect(testCommandMeta.cmdInstance['result']).to.deep.include(expectedResult);
    verifyUXOutput({ log: [`CUSTOM: ${TestCommand.output}`] });
  });

  describe('Varargs', () => {
    const validator = (name: string, value: unknown) => {
      if (!value) {
        throw Error(`Vararg [${name}] must not be empty.`);
      }
    };

    it('should be added to the command instance when varargs = true', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = true;
      await TestCommand.run(['-f', 'blah', 'foo=bar']);
      expect(testCommandMeta.cmdInstance).to.have.deep.property('varargs', {
        foo: 'bar',
      });
    });

    it('should be added to the command instance when varargs are required', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: true };
      await TestCommand.run(['-f', 'blah', 'foo=bar and this', 'username=me@my.org']);
      expect(testCommandMeta.cmdInstance).to.have.deep.property('varargs', {
        foo: 'bar and this',
        username: 'me@my.org',
      });
    });

    it('should be added to the command instance when varargs pass validation', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      const cmdArgs = [{ name: 'file' }];
      TestCommand['args'] = cmdArgs;
      await TestCommand.run(['myFile.json', '-f', 'blah', 'foo=bar']);
      expect(testCommandMeta.cmdInstance).to.have.deep.property('varargs', {
        foo: 'bar',
      });
    });

    it('should throw when varargs are required and not provided', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: true, validator };
      await TestCommand.run([]);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput(
        buildErrorOutput(
          'Provide required name=value pairs for the command. Enclose any values that contain spaces in double quotes.'
        )
      );
    });

    it('should throw when varargs are not in the correct format', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = true;
      await TestCommand.run(['-f', 'blah', 'foobar', '=', 'yadda']);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput(
        buildErrorOutput(
          'Setting variables must be in the format <key>=<value> or <key>="<value with spaces>" but found foobar.'
        )
      );
    });

    it('should throw when duplicate varargs are provided', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      await TestCommand.run(['-f', 'blah', 'foo=bar', 'foo=that']);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput(buildErrorOutput("Cannot set variable name 'foo' twice for the same command."));
    });

    it('should throw when varargs do not pass validation', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand['varargs'] = { required: false, validator };
      await TestCommand.run(['-f', 'blah', 'foo=']);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput(buildErrorOutput('Vararg [foo] must not be empty.'));
    });
  });

  describe('YtKitFlags Custom Attributes', () => {
    const validateFlagAttributes = (output: unknown, errName: string) => {
      const ytKitError = new Error(errName);
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput(buildErrorOutput(ytKitError.message));
    };

    it('should validate description is defined', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.string({ char: 'm' }),
      };
      const output = (await TestCommand.run(['--myflag', 'input'])) as string;
      validateFlagAttributes(
        output,
        "The flag myflag's is missing the description attribute, or the description is not a string."
      );
    });

    it('should validate char length is one', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.string({
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          char: 'foo',
          description: 'bar',
        }),
      };
      const output = (await TestCommand.run(['--myflag', 'input'])) as string;
      validateFlagAttributes(output, "The flag myflag's char attribute must be one alphabetical character long.");
    });

    it('should validate char is alphabetical', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        myflag: flags.string({ char: '5', description: 'bar' }),
      };
      const output = (await TestCommand.run(['--myflag', 'input'])) as string;
      validateFlagAttributes(output, "The flag myflag's char attribute must be one alphabetical character long.");
    });

    it('should validate that undefined is not a valid flag type value', async () => {
      class TestCommand extends BaseTestCommand {}
      TestCommand.flagsConfig = {
        myflag: flags.string({
          char: 'm',
          description: 'my desc',
        }),
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Allow undefined array value against the compiler spec to test underlying engine
      const output = (await TestCommand.run(['--myflag', undefined])) as unknown;
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      verifyUXOutput(buildErrorOutput('Flag --myflag expects a value'));
    });
  });

  it('should send errors with --json to stdout by default', async () => {
    // Run the command
    class StderrCommand extends YtKitCommand {
      public async run() {
        throw new Error('Ahhh!');
      }
    }
    const output = (await StderrCommand.run(['--json'])) as unknown;
    expect(output).to.equal(undefined);
    expect(process.exitCode).to.equal(1);

    const logJson = UX_OUTPUT['logJson'];
    expect(logJson.length, 'logJson did not get called with error json').to.equal(1);
    const json = ensureAnyJson(logJson[0]) as Record<string, string>;
    expect(json.message, 'logJson did not get called with the right error').to.contains('Ahhh!');
    expect(UX_OUTPUT['errorJson'].length, 'errorJson got called when it should not have').to.equal(0);
  });

  it('should catch and display errors', async () => {
    // Run the command
    class StderrCommand extends YtKitCommand {
      public static flagsConfig: FlagsConfig = {
        url: flags.string({ char: 'u', description: 'enter a url' }),
      };
      public async run() {
        throw new Error('Ahhh!');
      }
    }
    errorStub.restore();
    errorStub = sandbox.stub(UX.prototype, 'error').callsFake((error): UX => {
      expect(error).to.include('Ahhh!');
      return UX.prototype;
    });

    return mockStdout(async () => {
      let output: Optional<string>;
      const errorMessage = 'Expected EEXIT error';
      try {
        output = (await StderrCommand.run(['--url', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'])) as string;
        fail(errorMessage);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        if (error instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(error?.message).to.equal(errorMessage);
        }
      }
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      expect(errorStub.callCount).to.be.gte(1);
    });
  });

  it('should catch and display errors even when throw undefined', async () => {
    // Run the command
    class StderrCommand extends YtKitCommand {
      public static flagsConfig: FlagsConfig = {
        url: flags.string({ char: 'u', description: 'enter a url' }),
      };
      public async run() {
        // eslint-disable-next-line no-throw-literal
        throw undefined;
      }
    }
    errorStub.restore();
    errorStub = sandbox.stub(UX.prototype, 'error').callsFake((error): UX => {
      expect(error).to.be.undefined;
      return UX.prototype;
    });

    return mockStdout(async () => {
      let output: Optional<string>;
      try {
        output = (await StderrCommand.run(['--url', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'])) as string;
        fail('Expected EEXIT error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        if (error instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(error?.message).to.include('undefined');
        }
      }
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      expect(errorStub.callCount).to.be.gte(1);
    });
  });

  it('should catch and display errors with --json', async () => {
    // Run the command
    class StderrCommand extends YtKitCommand {
      public static flagsConfig: FlagsConfig = {
        url: flags.string({ char: 'u', description: 'enter a url' }),
      };
      public async run() {
        throw new Error('Ahhh!');
      }
    }
    logJsonStub.restore();
    logJsonStub = sandbox.stub(UX.prototype, 'logJson').callsFake((obj): UX => {
      expect(obj).to.have.property('message').and.to.be.equal('Ahhh!');
      return UX.prototype;
    });

    return mockStdout(async () => {
      let output: Optional<string>;
      const errorMessage = 'Expected EEXIT error';
      try {
        output = (await StderrCommand.run([
          '--url',
          'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
          '--json',
        ])) as string;
        fail(errorMessage);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        if (error instanceof Error) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(error?.message).to.equal(errorMessage);
        }
      }
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      expect(logJsonStub.callCount).to.be.gte(1);
    });
  });

  it('should catch and display errors undefined with --json', async () => {
    // Run the command
    class StderrCommand extends YtKitCommand {
      public static flagsConfig: FlagsConfig = {
        url: flags.string({ char: 'u', description: 'enter a url' }),
      };
      public async run() {
        // eslint-disable-next-line no-throw-literal
        throw undefined;
      }
    }
    logJsonStub.restore();
    logJsonStub = sandbox.stub(UX.prototype, 'logJson').callsFake((obj): UX => {
      expect(obj).to.have.property('message').and.to.be.undefined;
      return UX.prototype;
    });

    return mockStdout(async () => {
      let output: Optional<string>;
      const errorMessage = 'Expected EEXIT error';
      try {
        output = (await StderrCommand.run([
          '--url',
          'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
          '--json',
        ])) as string;
        fail(errorMessage);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
      expect(output).to.equal(undefined);
      expect(process.exitCode).to.equal(1);
      expect(logJsonStub.callCount).to.be.gte(1);
    });
  });
});
