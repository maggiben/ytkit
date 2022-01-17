import { expect } from 'chai';
import { OutputFlags } from '@oclif/parser';
import { getEncoderOptions } from '../../src/utils/';

describe('getEncoderOptions', () => {
  it('getEncoderOptions is undefined', () => {
    const encoderOptionst = getEncoderOptions({});
    expect(encoderOptionst).to.be.undefined;
  });

  it('getEncoderOptions format', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      format: 'mp3',
    };
    const encoderOptionst = getEncoderOptions(flags);
    expect(encoderOptionst).to.have.property('format').and.to.be.equal('mp3');
  });

  it('getEncoderOptions all options', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: OutputFlags<any> = {
      format: 'mp3',
      audioCodec: 'libmp3lame',
      videoCodec: 'libx264',
      videoBitrate: '1024',
      audioBitrate: '128',
    };
    const encoderOptionst = getEncoderOptions(flags);
    expect(encoderOptionst).to.have.property('format').and.to.be.equal('mp3');
  });
});
