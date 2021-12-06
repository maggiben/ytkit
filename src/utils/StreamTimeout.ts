import { Writable, WritableOptions } from 'stream';

export interface StreamTimeoutOptions extends WritableOptions {
  timeout?: number;
}
export default class StreamTimeout extends Writable {
  private timeout: number;
  private timer!: NodeJS.Timeout;
  public constructor(options?: StreamTimeoutOptions) {
    super(options);
    this.timeout = options?.timeout ?? 5000;
    this.handleEvents();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.clearTimeout();
    this.setTTimeout();
    return callback();
  }

  public end(): void {
    this.clearTimeout();
  }

  private handleEvents(): void {
    this.once('pipe', () => {
      this.setTTimeout();
    });
    this.once('close', () => {
      this.clearTimeout();
    });
    this.once('finish', () => {
      this.clearTimeout();
    });
  }

  private setTTimeout(): NodeJS.Timeout {
    this.timer = setTimeout(() => {
      this.emit('timeout');
    }, this.timeout);
    return this.timer;
  }

  private clearTimeout(): void {
    return clearTimeout(this.timer);
  }

  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // public setEncoding(encoding: string): void {}
  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // public pause(): StreamTimeout {}
  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // public resume(): void {}
  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // public pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean; }): T {}
  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // public unpipe<T extends NodeJS.WritableStream>(destination?: T): StreamTimeout {}
  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // public unshift(chunk: any): void {}
  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // public wrap(oldStream: NodeJS.ReadableStream): NodeJS.ReadableStream {}
  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // public push(chunk: any, encoding?: string): boolean {}
  // // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-explicit-any
  // private _read(size: number): void {}
}
