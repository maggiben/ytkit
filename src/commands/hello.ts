import { JsonArray } from '@salesforce/ts-types';
import YtKitCommand, { YtKitResult } from '../YtKitCommand';
import { flags, FlagsConfig } from '../YtKitFlags';

const users = [
  {
    name: 'Anna',
  },
  {
    name: 'Pedro',
  },
  {
    name: 'Steve',
  },
  {
    name: 'Laura',
  },
];

const sleep = (delay = 1000): Promise<JsonArray> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve(users);
    }, delay);
  });
};

export default class Hello extends YtKitCommand {
  public static readonly description = 'display hello world';
  public static readonly examples = ['$ ytdl hello'];
  public static readonly result: YtKitResult = {
    tableColumnData: ['name'],
  };

  public static readonly flagsConfig: FlagsConfig = {
    quiet: flags.builtin({
      description: 'quiet',
    }),
  };

  public async run(): Promise<JsonArray> {
    return await sleep(2000);
  }
}
