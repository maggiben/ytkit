/*
 * @file         : CreatableEventEmitter.ts
 * @summary      : A base class for classes that must be constructed and initialized asynchronously
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : A base class for classes that must be constructed and initialized asynchronously extends EventEmitter
 * @author       : Benjamin Maggi
 * @email        : benjaminmaggi@gmail.com
 * @date         : 03 Dec 2021
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

/**
 * A base class for classes that must be constructed and initialized asynchronously.
 */
export abstract class AsyncCreatable<O = object> {
  /**
   * Constructs a new `AsyncCreatable` instance. For internal and subclass use only.
   * New subclass instances must be created with the static {@link create} method.
   *
   * @param options An options object providing initialization params.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public constructor(options: O) {
    /* leave up to implementer */
  }

  /**
   * Asynchronously constructs and initializes a new instance of a concrete subclass with the provided `options`.
   *
   * @param options An options object providing initialization params to the async constructor.
   */
  public static async create<P, T extends AsyncCreatable<P>>(this: new (opts: P) => T, options: P): Promise<T> {
    const instance = new this(options);
    await instance.init();
    return instance;
  }

  /**
   * Asynchronously initializes newly constructed instances of a concrete subclass.
   */
  protected abstract init(): Promise<void>;
}
