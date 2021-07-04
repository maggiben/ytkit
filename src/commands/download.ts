import { Command, flags } from '@oclif/command';

const sleep = async (delay: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(() => {
      return resolve();
    }, delay);
  });

export default class Download extends Command {
  public static description = 'download';

  public static examples = [
    `$ ytdl download 
hello world from ./src/hello.ts!
`,
  ];

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  public static flags = {
    help: flags.help({ char: 'h' }),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({ char: 'n', description: 'name to print' }),
    // flag with no value (-f, --force)
    force: flags.boolean({ char: 'f' }),
  };

  public static args = [{ name: 'file' }];

  public async run(): Promise<void> {
    const { args, flags: flagsConfig } = this.parse(Download);

    await sleep(2000);

    const name = flagsConfig.name ?? 'world';
    this.log(`hello ${name} from ./src/commands/hello.ts`);
    if (args.file && flagsConfig.force) {
      this.log(`you input --force and --file: ${args.file as string}`);
    }
  }
}
