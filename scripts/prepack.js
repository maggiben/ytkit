#!/usr/bin/env node
/*
 * @file         : prepack.ts
 * @summary      : video download command
 * @version      : 1.0.0
 * @project      : YtKit
 * @description  : downloads a video or videos given a video or playlist url
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

const shell = require('./utils/shelljs');
const { isPlugin } = require('./utils/project-type');
const packageRoot = require('./utils/package-path');

shell.exec('yarn build');

if (isPlugin(packageRoot)) {
  shell.exec('oclif-dev manifest');
}
