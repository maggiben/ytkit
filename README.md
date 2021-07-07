# ytkit

Youtube downloader

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/ytkit.svg)](https://npmjs.org/package/ytkit)
[![CircleCI](https://img.shields.io/circleci/build/github/maggiben/ytkit)](https://circleci.com/gh/maggiben/ytkit/tree/master)
[![Downloads/week](https://img.shields.io/npm/dw/ytkit.svg)](https://npmjs.org/package/ytkit)
[![License](https://img.shields.io/npm/l/ytkit.svg)](https://github.com/maggiben/ytkit/blob/master/package.json)
[![Build, Test and maybe Publish](https://github.com/maggiben/ytkit/actions/workflows/push.yml/badge.svg)](https://github.com/maggiben/ytkit/actions/workflows/push.yml)
[![codecov.io](https://img.shields.io/codecov/c/github/maggiben/ytkit)]
(https://codecov.io/github/maggiben/ytkit?branch=master)

<!-- toc -->
* [ytkit](#ytkit)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g ytkit
$ ytkit COMMAND
running command...
$ ytkit (-v|--version|version)
ytkit/1.2.2 darwin-x64 node-v16.4.0
$ ytkit --help [COMMAND]
USAGE
  $ ytkit COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`ytkit download`](#ytkit-download)
* [`ytkit hello`](#ytkit-hello)
* [`ytkit help [COMMAND]`](#ytkit-help-command)
* [`ytkit info`](#ytkit-info)

## `ytkit download`

download video

```
USAGE
  $ ytkit download

OPTIONS
  -b, --begin=begin                           Time to begin video, format by 1:30.123 and 1m30s
  -h, --help                                  show CLI help
  -o, --output=output                         Save to file, template by {prop}, default: stdout or {title}
  -q, --quality=quality                       Video quality to download, default: highest
  -r, --range=range                           Byte range to download, ie 10355705-12452856
  -u, --url=url                               (required) Youtube video or playlist url
  --filter=(video|videoonly|audio|audioonly)  Can be video, videoonly, audio, audioonly
  --filter-codecs=filter-codecs               Filter in format codecs
  --filter-container=filter-container         Filter in format container
  --filter-resolution=filter-resolution       Filter in format resolution
  --json                                      format output as json
  --unfilter-codecs=unfilter-codecs           Filter out format resolution
  --unfilter-container=unfilter-container     Filter out format container
  --unfilter-resolution=unfilter-resolution   Filter out format container
  --urlonly                                   Print direct download URL

EXAMPLE
  $ ytdl download -u
```

_See code: [src/commands/download.ts](https://github.com/maggiben/ytkit/blob/v1.2.2/src/commands/download.ts)_

## `ytkit hello`

display hello world

```
USAGE
  $ ytkit hello

OPTIONS
  --json   format output as json
  --quiet  nothing emitted stdout

EXAMPLE
  $ ytdl hello
```

_See code: [src/commands/hello.ts](https://github.com/maggiben/ytkit/blob/v1.2.2/src/commands/hello.ts)_

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
  $ ytdl info -u https://www.youtube.com/watch?v=ABC1234
```

_See code: [src/commands/info.ts](https://github.com/maggiben/ytkit/blob/v1.2.2/src/commands/info.ts)_
<!-- commandsstop -->
