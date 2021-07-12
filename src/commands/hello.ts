import { JsonArray } from '@salesforce/ts-types';
import { OutputArgs } from '@oclif/parser';
import { JsonMap } from '@salesforce/ts-types';
import { YtKitCommand } from '../YtKitCommand';
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
  public static readonly description = 'download video to a file or to stdout';
  public static readonly examples = ['$ ytdl download -u '];
  public static readonly flagsConfig: FlagsConfig = {
    help: flags.help({ char: 'h' }),
    url: flags.string({
      char: 'u',
      description: 'Youtube video or playlist url',
      required: true,
    }),
  };

  // The parsed args for easy reference by this command; assigned in init
  protected args!: OutputArgs<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  // The parsed varargs for easy reference by this command
  protected varargs?: JsonMap;
  // The parsed flags for easy reference by this command; assigned in init

  public async run(): Promise<number> {
    this.ux.cli.log('hello');
    const usr = await sleep(2000);
    this.ux.cli.styledJSON(usr);
    return 1;
  }

  private anything(): void {
    /**
     *
     *
     *
     *
     *
     *
     *
     *
     *
     */
    return;
  }
}
