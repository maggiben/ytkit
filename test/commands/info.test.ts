import { expect, test } from '@oclif/test';

describe('video info', () => {
  test
    .stdout()
    .command(['info', '--url', 'https://www.youtube.com/watch?v=MglX7zcg0gw', '--json'])
    .it('runs info', (ctx) => {
      expect(ctx.stdout).to.contain('info world');
    });

  test
    .stdout()
    .command(['info', '--name', 'jeff'])
    .it('runs info --name jeff', (ctx) => {
      expect(ctx.stdout).to.contain('info jeff');
    });
});
