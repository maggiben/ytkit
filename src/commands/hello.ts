import YtKitCommand from '../YtKitCommand';

const sleep = (delay = 1000): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve();
    }, delay);
  });
};

export default class Hello extends YtKitCommand {
  public static readonly description = 'display hello world';
  public static readonly examples = ['$ ytdl hello'];

  public async run(): Promise<void> {
    await sleep(2000);
    // eslint-disable-next-line no-console
    console.log('hello world', JSON.stringify(this.flags));
  }
}
