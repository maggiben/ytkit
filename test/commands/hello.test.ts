import { expect, test } from '@oclif/test';

describe('download a video using custom filters', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=MglX7zcg0gw';
  test
    .stdout()
    .command(['hello', '--url', videoUrl])
    .it('download a video filtered by container', (ctx) => {
      expect(ctx.stdout).to.exist;
    });
});
