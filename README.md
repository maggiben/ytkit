# YTKIT

Youtube video downloader

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/ytkit.svg)](https://npmjs.org/package/ytkit)
[![CircleCI](https://img.shields.io/circleci/build/github/maggiben/ytkit)](https://circleci.com/gh/maggiben/ytkit/tree/master)
[![Downloads/week](https://img.shields.io/npm/dw/ytkit.svg)](https://npmjs.org/package/ytkit)
[![License](https://img.shields.io/npm/l/ytkit.svg)](https://github.com/maggiben/ytkit/blob/master/package.json)
[![codecov.io](https://img.shields.io/codecov/c/github/maggiben/ytkit)](https://codecov.io/github/maggiben/ytkit?branch=master)
[![Join the chat at https://gitter.im/ytkit/community](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/ytkit/community?utm_source=badge&utm_medium=badge&utm_content=badge)
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
ytkit/1.4.17 darwin-x64 node-v16.4.0
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

## `ytkit download`

download video to a file or to stdout

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
  --filter-container=filter-container         Filter in format container
  --filter-resolution=filter-resolution       Filter in format resolution
  --json                                      format output as json
  --unfilter-container=unfilter-container     Filter out format container
  --unfilter-resolution=unfilter-resolution   Filter out format container
  --urlonly                                   Print direct download URL

EXAMPLE
  $ ytdl download -u
```

_See code: [src/commands/download.ts](https://github.com/maggiben/ytkit/blob/v1.4.17/src/commands/download.ts)_

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

_See code: [src/commands/info.ts](https://github.com/maggiben/ytkit/blob/v1.4.17/src/commands/info.ts)_

<!-- commandsstop -->

## Contributing

If you are interested in contributing, please take a look at the [CONTRIBUTING](https://github.com/maggiben/ytkit/blob/main/CONTRIBUTING.md) guide.

## Development

If you are interested in building this package locally, please take a look at the [DEVELOPING](https://github.com/maggiben/ytkit/blob/main/DEVELOPING.md) doc.
