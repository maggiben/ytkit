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

const shell = require('shelljs');
const chalk = require('chalk');

shell.set('-e');
shell.set('+v');

const origExec = shell.exec;

process.env.FORCE_COLOR = '1';

shell.exec = function (command, ...args) {
  const options = Object.assign(
    {
      /* Set any defaults here */
    },
    args[0]
  );
  if (options.passthrough) {
    command = `${command} ${process.argv.slice(2).join(' ')}`;
  }
  // eslint-disable-next-line no-console
  console.error(chalk.blue(command));
  try {
    origExec.call(shell, command, ...args);
  } catch (err) {
    // Setting -e will throw an error. We are already displaying the command
    // output above which has information on the problem, so don't show the
    // node specific error thrown by shelljs. This is much cleaner output.
    process.exit(1);
  }
};

module.exports = shell;
