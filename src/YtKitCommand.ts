/*
 * @file         : YtKitCommand.ts
 * @summary      : base command class
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : command class derived from @oclif/command
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 05 Jul 2021
 * @license:     : MIT
 *
 * Copyright 2021 Benjamin Maggi <benjaminmaggi@gmail.com>
 *
 *
 * License:
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { Command } from '@oclif/command';
import { OutputArgs, OutputFlags } from '@oclif/parser';
import * as chalk from 'chalk';
import { cli } from 'cli-ux';
import { get, JsonMap, AnyJson, Optional, Dictionary, isBoolean } from '@salesforce/ts-types';
import UX, { TableOptions } from './Ux';
import { buildYtKitFlags, flags as Flags, FlagsConfig } from './YtKitFlags';

export interface YtKitResult {
  data?: AnyJson;
  tableColumnData?: TableOptions;
  display?: (this: Result) => void;
}

/**
 * A class that handles command results and formatting.  Use this class
 * to override command display behavior or to get complex table formatting.
 * For simple table formatting, use {@link Command.tableColumnData} to
 * define a string array of keys to use as table columns.
 */
export class Result implements YtKitResult {
  public data!: AnyJson; // assigned in Command._run
  public tableColumnData?: TableOptions;
  public ux!: UX; // assigned in YtKitCommand.init

  public constructor(config: YtKitResult = {}) {
    this.tableColumnData = config.tableColumnData;
    if (config.display) {
      this.display = config.display.bind(this);
    }
  }

  public display(): void {
    if (this.tableColumnData) {
      if (Array.isArray(this.data) && this.data.length) {
        this.ux.table(this.data, this.tableColumnData);
      } else {
        this.ux.log('No results found.');
      }
    }
  }
}

/**
 * Defines a varargs configuration. If set to true, there will be no
 * validation and varargs will not be required.  The validator function
 * should throw an error if validation fails.
 */
export type VarargsConfig =
  | {
      required: boolean;
      validator?: (name: string, value: string) => void;
    }
  | boolean;

export default abstract class YtKitCommand extends Command {
  // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
  protected get statics(): typeof YtKitCommand {
    return this.constructor as typeof YtKitCommand;
  }
  // Property to inherit, override, and configure flags
  protected static flagsConfig: FlagsConfig;
  // Convenience property for simple command output table formating.
  protected static tableColumnData: TableOptions;
  // Use for full control over command output formating and display, or to override
  // certain pieces of default display behavior.
  protected static result: YtKitResult = {};
  // Use to enable or configure varargs style (key=value) parameters.
  protected static varargs: VarargsConfig = false;

  // The parsed flags for easy reference by this command; assigned in init
  protected flags!: OutputFlags<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // The parsed args for easy reference by this command; assigned in init
  protected args!: OutputArgs<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // The parsed varargs for easy reference by this command
  protected varargs?: JsonMap;

  // The command output and formatting; assigned in _run
  protected ux!: UX; // assigned in init
  protected result!: Result;
  private isJson = false;
  // Overrides @oclif/command static flags property.  Adds username flags
  // if the command supports them.  Builds flags defined by the command's
  // flagsConfig static property.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // public static get flags(): Flags.Input<any> {
  //   return buildYtKitFlags(this.flagsConfig);
  // }

  public async _run<T>(): Promise<Optional<T>> {
    // If a result is defined for the command, use that.  Otherwise check for a
    // tableColumnData definition directly on the command.
    if (!this.statics.result.tableColumnData && this.statics.tableColumnData) {
      this.statics.result.tableColumnData = this.statics.tableColumnData;
    }

    this.result = new Result(this.statics.result);

    let err: Optional<Error>;
    try {
      await this.init();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
      return (this.result.data = await this.run());
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      err = error;
      await this.catch(error);
    } finally {
      await this.finally(err);
    }
  }

  /**
   * Logs an object as JSON at `ERROR` level and to `stderr`.
   *
   * @param {object} obj The error object to log -- must be serializable as JSON.
   * @returns {UX}
   * @throws {TypeError} If the object is not JSON-serializable.
   */
  public errorJson(obj: AnyJson): void {
    const error = JSON.stringify(obj, null, 4);
    this.ux.error(error);
  }

  protected async init(): Promise<void> {
    // If we made it to the init method, the exit code should not be set yet. It will be
    // successful unless the base init or command throws an error.
    process.exitCode = 0;

    this.isJson = this.argv.includes('--json');
    // Finally invoke the super init.
    await super.init();
    // Turn off strict parsing if varargs are set.  Otherwise use static strict setting.
    const strict = this.statics.varargs ? !this.statics.varargs : this.statics.strict;

    // Init ux
    this.ux = new UX(!this.isJson);

    const { args, flags, argv } = this.parse({
      flags: this.statics.flags,
      args: this.statics.args,
      strict,
    });
    this.flags = flags;
    this.args = args;

    // If this command supports varargs, parse them from argv.
    if (this.statics.varargs) {
      const argVals = Object.values(args) as string[];
      const varargs = argv.filter((val) => !argVals.includes(val));
      this.varargs = this.parseVarargs(varargs);
    }
  }

  protected getFlag<T>(flagName: string, defaultVal?: unknown): T {
    return get(this.flags, flagName, defaultVal) as T;
  }

  protected getJsonResultObject(
    result = this.result.data,
    status = process.exitCode || 0
  ): { status: number; result: AnyJson } {
    return { status, result };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
  protected async catch(error: Optional<Error>): Promise<void> {
    process.exitCode = process.exitCode || 1;

    const userDisplayError = Object.assign(this.getJsonResultObject(), {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });

    if (this.isJson) {
      // This should default to true, which will require a major version bump.
      // this.ux.cli.styledJSON(userDisplayError);
      console.log('UX: ', this.ux);
      cli.styledJSON(userDisplayError);
    } else {
      // eslint-disable-next-line no-console
      console.error(...this.formatError(error ?? new Error('Undefined error')));
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async finally(error: Optional<Error>): Promise<void> {
    // Only handle success since we're handling errors in the catch
    if (!error) {
      if (this.isJson) {
        const output = this.getJsonResultObject();
        this.ux.cli.styledJSON(output);
      } else {
        this.result.display();
      }
    }
  }

  protected parseVarargs(args: string[] = []): JsonMap {
    const varargs: Dictionary<string> = {};
    const descriptor = this.statics.varargs;

    // If this command requires varargs, throw if none are provided.
    if (!args.length && !isBoolean(descriptor) && descriptor.required) {
      throw new Error();
      // throw SfdxError.create('@salesforce/command', 'command', 'VarargsRequired');
    }

    // Validate the format of the varargs
    args.forEach((arg) => {
      const split = arg.split('=');

      if (split.length !== 2) {
        throw new Error();
        // throw SfdxError.create('@salesforce/command', 'command', 'InvalidVarargsFormat', [arg]);
      }

      const [name, value] = split;

      if (varargs[name]) {
        throw new Error();
        // throw SfdxError.create('@salesforce/command', 'command', 'DuplicateVararg', [name]);
      }

      if (!isBoolean(descriptor) && descriptor.validator) {
        descriptor.validator(name, value);
      }

      varargs[name] = value || undefined;
    });

    return varargs;
  }

  /**
   * Format errors and actions for human consumption. Adds 'ERROR running <command name>',
   * and outputs all errors in red.  When there are actions, we add 'Try this:' in blue
   * followed by each action in red on its own line.
   *
   * @returns {string[]} Returns decorated messages.
   */
  protected formatError(error: Error): string[] {
    const colorizedArgs: string[] = [];
    // We should remove error.commandName since we should always use the actual command id.
    colorizedArgs.push(chalk.bold(`ERROR ${this.id}: `));
    colorizedArgs.push(chalk.red(error.message));

    return colorizedArgs;
  }

  /**
   * Sets an exit code on the process that marks success or failure
   * after successful command execution.
   *
   * @param {number} code The exit code to set on the process.
   */
  protected setExitCode(code: number): void {
    process.exitCode = code;
  }

  /**
   * Actual command run code goes here.
   *
   * @returns {Promise<any>} Returns a promise
   * @throws {Error | SfdxError} Throws an error. If the error is not an SfdxError, it will
   * be wrapped in an SfdxError. If the error contains exitCode field, process.exitCode
   * will set to it.
   */
  public abstract async run(): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
