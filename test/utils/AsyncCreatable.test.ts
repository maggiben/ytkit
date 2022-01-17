/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { AsyncCreatable } from '../../src/utils/AsyncCreatable';

class Config<O extends Config.Options> extends AsyncCreatable<O> {
  protected options: O;

  public constructor(options: O) {
    super(options);
    if (!options) throw new Error('I can haz options!');
    this.options = options;
  }

  public getFooEnabled(): boolean {
    return this.options.fooEnabled;
  }

  protected async init(): Promise<void> {
    await this.options.doAsyncThing();
  }
}

namespace Config {
  export interface Options {
    fooEnabled: boolean;
    doAsyncThing: () => Promise<void>;
  }
}

class SubConfig extends Config<SubConfig.Options> {
  public constructor(options: SubConfig.Options) {
    super(options);
  }

  public getBarEnabled(): boolean {
    return this.options.barEnabled;
  }

  protected async init(): Promise<void> {
    await super.init();
  }
}

namespace SubConfig {
  export interface Options extends Config.Options {
    barEnabled: boolean;
  }
}

describe('AsyncCreatable', () => {
  it('should construct a concrete subclass async with options', async () => {
    let doAsyncThingRan = false;

    const config: Config<Config.Options> = await Config.create({
      fooEnabled: true,
      doAsyncThing: () => {
        doAsyncThingRan = true;
        return Promise.resolve();
      },
    });

    expect(doAsyncThingRan).to.be.true;
    expect(config.getFooEnabled()).to.be.true;
  });

  it('should construct a concrete sub-subclass async with options', async () => {
    let doAsyncThingRan = false;
    const config = await SubConfig.create({
      fooEnabled: true,
      doAsyncThing: () => {
        doAsyncThingRan = true;
        return Promise.resolve();
      },
      barEnabled: true,
    });

    expect(doAsyncThingRan).to.be.true;
    expect(config.getFooEnabled()).to.be.true;
    expect(config.getBarEnabled()).to.be.true;
  });
});
