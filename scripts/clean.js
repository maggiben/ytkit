#!/usr/bin/env node
///////////////////////////////////////////////////////////////////////////////
// @file         : husky-pre-commit.js                                       //
// @summary      : Dynamic Google API Client builder                         //
// @version      : 1.0.0                                                     //
// @project      : N/A                                                       //
// @description  : Reference: developers.google.com/discovery/v1/reference   //
// @author       : Benjamin Maggi                                            //
// @email        : benjaminmaggi@gmail.com                                   //
// @date         : 04 Jul 2021                                               //
// @license:     : MIT                                                       //
// ------------------------------------------------------------------------- //
//                                                                           //
// Copyright 2021 Benjamin Maggi <benjaminmaggi@gmail.com>                   //
//                                                                           //
//                                                                           //
// License:                                                                  //
// Permission is hereby granted, free of charge, to any person obtaining a   //
// copy of this software and associated documentation files                  //
// (the "Software"), to deal in the Software without restriction, including  //
// without limitation the rights to use, copy, modify, merge, publish,       //
// distribute, sublicense, and/or sell copies of the Software, and to permit //
// persons to whom the Software is furnished to do so, subject to the        //
// following conditions:                                                     //
//                                                                           //
// The above copyright notice and this permission notice shall be included   //
// in all copies or substantial portions of the Software.                    //
//                                                                           //
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS   //
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF                //
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.    //
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY      //
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,      //
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE         //
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                    //
//                                                                           //
///////////////////////////////////////////////////////////////////////////////

const { readFileSync } = require('fs');
const { join } = require('path');
const shell = require('./utils/shelljs');
const log = require('./utils/log');
const loadRootPath = require('./utils/load-root-path');

const cleanAll = process.argv[2] === 'all';

let toClean = ['lib'];
let toCleanAll = ['node_modules'];

// Look for the gitignore in case we are in a lerna project
const gitignorePath = loadRootPath('.gitignore');

if (gitignorePath) {
  const VALID_SEGMENTS = ['CLEAN', 'CLEAN ALL'];
  const gitignore = readFileSync(join(gitignorePath, '.gitignore'), 'utf8');
  const segments = gitignore
    // Segments are defined by "# --" in the gitignore
    .split('# --')
    // Turn each segment into list of valid gitignore lines
    .map((segment) => segment.split('\n').filter((line) => line && !line.startsWith('#')))
    // Maps segment name to list of valid gitignore lines
    .reduce((map, segment) => {
      const segmentName = (segment.shift() || '').trim();
      if (VALID_SEGMENTS.includes(segmentName)) {
        map[segmentName] = segment;
      }
      return map;
    }, {});

  // The first line of the segment is what we are looking for. Either # -- CLEAN or # -- CLEAN ALL
  if (segments['CLEAN']) {
    toClean = segments['CLEAN'];
  } else {
    const example = join(__dirname, '..', 'files', '.gitignore');
    log(
      'No clean entries found.' +
        'Use "# -- CLEAN" and # -- CLEAN-ALL to specify clean  directories.' +
        `See ${example} for an example.`
    );
  }
  if (segments['CLEAN ALL']) {
    toCleanAll = segments['CLEAN ALL'];
  }
}

// Add defaults for clean all
if (cleanAll) {
  toClean = [...toClean, ...toCleanAll];
}

log(`rm -rf ${toClean}`);
shell.rm('-rf', toClean);
