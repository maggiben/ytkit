# YTKIT

A youtube command line utility kit

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/ytkit.svg)](https://npmjs.org/package/ytkit)
[![CircleCI](https://img.shields.io/circleci/build/github/maggiben/ytkit)](https://circleci.com/gh/maggiben/ytkit/tree/master)
[![Downloads/week](https://img.shields.io/npm/dw/ytkit.svg)](https://npmjs.org/package/ytkit)
[![License](https://img.shields.io/npm/l/ytkit.svg)](https://github.com/maggiben/ytkit/blob/master/package.json)
[![codecov.io](https://img.shields.io/codecov/c/github/maggiben/ytkit)](https://codecov.io/github/maggiben/ytkit?branch=master)
[![Discord](https://img.shields.io/discord/919650621420896306.svg)](https://discord.gg/Z7awkJTq)
[![Known Vulnerabilities](https://snyk.io/test/github/maggiben/ytkit/badge.svg)](https://snyk.io/test/github/maggiben/ytkit)

<!-- toc -->

- [YTKIT](#ytkit)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g ytkit
$ ytkit COMMAND
running command...
$ ytkit (-v|--version|version)
ytkit/1.4.40 darwin-x64 node-v16.4.0
$ ytkit --help [COMMAND]
USAGE
  $ ytkit COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`ytkit download`](#ytkit-download)
- [`ytkit help [COMMAND]`](#ytkit-help-command)
- [`ytkit info`](#ytkit-info)
- [`ytkit search`](#ytkit-search)

## `ytkit download`

download video to a file or to stdout

```
USAGE
  $ ytkit download

OPTIONS
  -o, --output=output                         Save to file, template by {prop}, default: stdout or {title}
  -u, --url=url                               (required) Youtube video or playlist url
  --begin=begin                               Time to begin video, format by 1:30.123 and 1m30s
  --filter=(video|videoonly|audio|audioonly)  Can be video, videoonly, audio, audioonly
  --filter-container=filter-container         Filter in format container
  --filter-resolution=filter-resolution       Filter in format resolution
  --json                                      format output as json
  --quality=quality                           Video quality to download, default: highest
  --range=range                               Byte range to download, ie 10355705-12452856
  --unfilter-container=unfilter-container     Filter out format container
  --unfilter-resolution=unfilter-resolution   Filter out format container
  --urlonly                                   Print direct download URL

EXAMPLE
  $ ytdl download -u https://www.youtube.com/watch?v=aqz-KE-bpKQ
```

_See code: [src/commands/download.ts](https://github.com/maggiben/ytkit/blob/v1.4.40/src/commands/download.ts)_

## `ytkit help [COMMAND]`

display help for ytkit

```
USAGE
  $ ytkit help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_

## `ytkit info`

display information about a video

```
USAGE
  $ ytkit info

OPTIONS
  -f, --formats  Display available video formats
  -u, --url=url  (required) Youtube video or playlist url
  --json         format output as json

EXAMPLE
  $ ytdl info -u https://www.youtube.com/watch?v=aqz-KE-bpKQ
```

_See code: [src/commands/info.ts](https://github.com/maggiben/ytkit/blob/v1.4.40/src/commands/info.ts)_

## `ytkit search`

Search for Youtube for Videos

```
USAGE
  $ ytkit search

OPTIONS
  -l, --limit=limit  [default: 100] Limits the pulled items, defaults to 100, set to Infinity to get the whole list of
                     search results

  -o, --options      Search options

  -q, --query=query  (required) Query term

  --json             format output as json

  --safe-search      Pull items in youtube restriction mode

EXAMPLE
  $ ytdl search -q banana
```

_See code: [src/commands/search.ts](https://github.com/maggiben/ytkit/blob/v1.4.40/src/commands/search.ts)_

<!-- commandsstop -->

## Contributing

If you are interested in contributing, please take a look at the [CONTRIBUTING](https://github.com/maggiben/ytkit/blob/main/CONTRIBUTING.md) guide.

## Development

If you are interested in building this package locally, please take a look at the [DEVELOPING](https://github.com/maggiben/ytkit/blob/main/DEVELOPING.md) doc.

## Releases

Run `ytkit version` to display the version of YTKIT CLI installed on your computer.

Run `ytkit update` to update the CLI to the latest available version.

## Installation

You can install this by either using an OS-specific installer [available here](https://github.com/maggiben/ytkit/releases), by directly installing it with `npm` or `yarn` (see the instructions below).

### Installing with `npm` or `yarn`

To get started, you'll need to install `node` v12 or greater, though we recommend using the latest v14 (LTS) for the best experience. While this can be done using an installer from [nodejs.com](nodejs.com) or via an OS-specific package manager, we recommend using [nvm](https://github.com/creationix/nvm) to easily manage multiple `node` versions.

If using `nvm`, be sure that you've selected the appropriate version with something like `nvm use v14.x.y`, where `x` and `y` are specific to the version that you installed. If you want to use this version by default run `nvm alias default node` -- otherwise, when you restart your shell `nvm` will revert to whatever version configured prior to installing the latest.

### `npm`

`npm` is installed automatically with Node.js. Install the CLI using `npm` as follows:

```bash
> npm install --global ytkit
```

### `yarn`

`yarn` is another popular Node.js package manager that can be used to install the CLI, but it needs to be [installed separately](https://yarnpkg.com/en/docs/install) from Node.js if you choose to use it.

Note that by default `yarn` will attempt to install the binary in a location that may conflict with the location used by the installers, so you may additionally want to run the following command to avoid collision should you want to maintain two separate installations: `yarn config set prefix ~/.yarn` (macOS and Linux). Then, use the following:

```bash
> yarn global add ytkit
```

## Debugging with VSCode

We provide tree convinient methods for you to debug this application as follows:

- **Launch Program**: launches the program with the given argument (edit the aruments in `launch.json`).
- **Debug All Tests**: launches the debugger on all tests.
- **Debug Active Test**: launches the debugger on the current working test.

## Docker Images

We provide versioned images on dockerhub.

Example

```bash
> docker pull rbmaggi/ytkit # choose a tag to pull and run
> ytkit version # then run any ytkit command you like
> exit # when done, type exit to leave the container
```

## Support

You can contact us for support on our [chat server](https://discord.gg/Z7awkJTq)

## Versioning

All versions are `<major>.<minor>.<patch>` which will be incremented for
breaking backward compat and major reworks, new features without breaking
change, and bug fixes, respectively. tl;dr: [Semantic
versioning](http://semver.org/).

### ATTENTION

While this tool makes it easy to download content from Youtube, I do not endorse the theft of content created by hardworking citizens of the Internet. If you use Youtube as a primary source of entertainment, then **please remember to _turn off ad-block_, _buy their merchandise_, or _donate_ to the content creators you love to watch.** And if you can't do that then simply like, comment, and subscribe to help them get more people enjoying their content.
