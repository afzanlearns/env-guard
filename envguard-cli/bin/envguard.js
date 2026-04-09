#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { URL } from 'url';
import path from 'path';

const pkgUrl = new URL('../../package.json', import.meta.url);
let version = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf-8'));
  version = pkg.version;
} catch (e) {
  // fallback for CommonJS or different compiled structure if needed
  try {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    version = pkg.version;
  } catch (e) {
    // ignore
  }
}

const program = new Command();

program
  .name('envguard')
  .description('Sync .env schemas across your team without storing secrets')
  .version(version);

program
  .command('init')
  .description('Link the current directory to an EnvGuard project')
  .action(async () => {
    const { init } = await import('../src/commands/init.js');
    init();
  });

program
  .command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('login')
      .description('Authenticate with EnvGuard')
      .action(async () => {
        const { login } = await import('../src/commands/auth.js');
        login();
      })
  );

program
  .command('push')
  .description('Push local .env schema to the team')
  .option('--env <name>', 'specify environment')
  .option('--file <path>', 'specify custom .env path', '.env')
  .option('--no-interactive', 'skip prompts, push with existing/inferred metadata only')
  .option('--allow-empty', 'allow pushing an empty schema')
  .action(async (options) => {
    const { push } = await import('../src/commands/push.js');
    push(options);
  });

program
  .command('status')
  .description('Compare local .env keys against team schema')
  .action(async () => {
    const { status } = await import('../src/commands/status.js');
    status();
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
