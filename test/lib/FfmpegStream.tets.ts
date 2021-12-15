import { expect, assert } from 'chai';
import * as sinon from 'sinon';
import { FfmpegStream } from '../../src/lib/FfmpegStream';

describe('FfmpegStream', () => {
  it('streams to ffmpeg', () => {
    const ffmpegStream = new FfmpegStream(this.readStream, this.outputStream, this.encoderOptions);
  });
});
