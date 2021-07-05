import { expect, test } from '@oclif/test';

describe('download', () => {
  test
    .stdout()
    .command(['download'])
    .it('runs download', (ctx) => {
      expect(ctx.stdout).to.contain('download world');
    });

  test
    .stdout()
    .command(['download', '--name', 'jeff'])
    .it('runs download --name jeff', (ctx) => {
      expect(ctx.stdout).to.contain('download jeff');
    });
});
