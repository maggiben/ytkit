/*
 * @file         : YtKitFlags.ts
 * @summary      : flag utilities
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

import { flags as OclifFlags } from '@oclif/command';
import * as Parser from '@oclif/parser';
import { IBooleanFlag, IOptionFlag, Output, IFlag } from '@oclif/parser/lib/flags';
import { definiteEntriesOf, isString, hasString, isKeyOf, Optional } from '@salesforce/ts-types';
import { Dictionary } from '@salesforce/ts-types';

/**
 * The configuration of flags for an {@link SfdxCommand} class, except for the following:
 *
 * * `json` is configured automatically for all {@link SfdxCommand} classes.
 *
 * ```
 * public static flagsConfig: FlagsConfig = {
 *   name: flags.string({ char: 'n', required: true, description: 'name of the resource to create' }),
 *   source: flags.directory({ char: 'd', required: true, description: 'path of the source directory to sync' }),
 *   wait: flags.minutes({ description: 'number of minutes to wait for creation' }),
 *   notify: flags.url({ description: 'url to notify upon completion' })
 * };
 * ```
 */
export type FlagsConfig = {
  [key: string]: Optional<IBooleanFlag<unknown> | IOptionFlag<unknown> | flags.Builtin>;
};

export const flags = {
  // oclif
  ...OclifFlags,
};

export namespace flags {
  export type Any<T> = Partial<IFlag<T>>;
  export type Builtin = { type: 'builtin' };
  export type Kind = keyof typeof flags;
  export type Input<T extends Parser.flags.Output> = OclifFlags.Input<T>;
}

export const requiredBuiltinFlags = {
  json(): IBooleanFlag<boolean> {
    return flags.boolean({
      description: 'format output as json',
    });
  },
};

export const optionalBuiltinFlags = {
  quiet(opts?: flags.Builtin): IBooleanFlag<boolean> {
    return Object.assign(
      opts ?? {},
      flags.boolean({
        description: 'nothing emitted stdout',
      })
    );
  },
};

function isBuiltin(flag: Record<string, unknown>): flag is flags.Builtin {
  return hasString(flag, 'type') && flag.type === 'builtin';
}

/**
 * Validate the custom flag configuration. This includes:
 *
 * - The flag name is in all lowercase.
 * - A string description is provided.
 * - If a char attribute is provided, it is one alphabetical character in length.
 * - If a long description is provided, it is a string.
 *
 * @param {SfdxFlagDefinition} flag The flag configuration.
 * @param {string} key The flag name.
 * @throws SfdxError If the criteria is not meet.
 */
function validateCustomFlag<T>(key: string, flag: flags.Any<T>): flags.Any<T> {
  if (!/^(?!(?:[-]|[0-9]*$))[a-z0-9-]+$/.test(key)) {
    // throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagName', [key]);
    throw new Error(`The flag ${key}'s name must be a lowercase string that may contain numbers and hyphens.`)
  }
  if (flag.char && (flag.char.length !== 1 || !/[a-zA-Z]/.test(flag.char))) {
    throw new Error(`The flag ${key}'s char attribute must be one alphabetical character long.`);
    // throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagChar', [key]);
  }
  if (!flag.description || !isString(flag.description)) {
    // throw SfdxError.create('@salesforce/command', 'flags', 'MissingOrInvalidFlagDescription', [key]);
    throw new Error(`The flag ${key}s is missing the description attribute, or the description is not a string.`);
  }
  return flag;
}

/**
 * Builds flags for a command given a configuration object.  Supports the following use cases:
 * 1. Enabling common SFDX flags. E.g., { verbose: true }
 * 2. Defining typed flags. E.g., { myFlag: Flags.array({ char: '-a' }) }
 * 3. Defining custom typed flags. E.g., { myFlag: Flags.custom({ parse: (val) => parseInt(val, 10) }) }
 *
 * @param {FlagsConfig} flagsConfig The configuration object for a flag.  @see {@link FlagsConfig}
 * @param options Extra configuration options.
 * @returns {flags.Output} The flags for the command.
 * @ignore
 */
export function buildYtKitFlags(flagsConfig: FlagsConfig): Output {
  const output: Dictionary<flags.Any<unknown>> = {};
  // Required flag options for all SFDX commands
  output.json = requiredBuiltinFlags.json();
  // Process configuration for custom and builtin flags
  definiteEntriesOf(flagsConfig).forEach(([key, flag]) => {
    if (isBuiltin(flag)) {
      if (!isKeyOf(optionalBuiltinFlags, key)) {
        throw new Error(`No built-in flag named ${key}`);
      }
      output[key] = optionalBuiltinFlags[key](flag);
    } else {
      output[key] = validateCustomFlag<unknown>(key, flag);
    }
  });
  return output;
}
