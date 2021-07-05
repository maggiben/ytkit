/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Command from '@oclif/command';
import { OutputFlags } from '@oclif/parser';
import { buildYtKitFlags, flags as Flags, FlagsConfig } from './YtKitFlags';

export default abstract class TemplateCommand extends Command {
  // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
  protected get statics(): typeof TemplateCommand {
    return this.constructor as typeof TemplateCommand;
  }

  // Property to inherit, override, and configure flags
  protected static flagsConfig: FlagsConfig;

  // The parsed flags for easy reference by this command; assigned in init
  protected flags!: OutputFlags<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  protected async init(): Promise<void> {
    // If we made it to the init method, the exit code should not be set yet. It will be
    // successful unless the base init or command throws an error.
    process.exitCode = 0;

    // Finally invoke the super init now that this.ux is properly configured.
    await super.init();

    // Parse the command to get flags and args
    const { flags } = this.parse({
      flags: this.statics.flags,
    });
    this.flags = flags;
  }

  // Overrides @oclif/command static flags property.  Adds username flags
  // if the command supports them.  Builds flags defined by the command's
  // flagsConfig static property.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static get flags(): Flags.Input<any> {
    return buildYtKitFlags(this.flagsConfig);
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
