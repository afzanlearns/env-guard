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

import { init } from '../commands/init.js';
import { login } from '../commands/auth.js';
import { push } from '../commands/push.js';
import { status } from '../commands/status.js';

const program = new Command();

program
  .name('envguard')
  .description('Sync .env schemas across your team without storing secrets')
  .version(version);

program
  .command('init')
  .description('Link the current directory to an EnvGuard project')
  .action(async () => {
    await init();
  });

program
  .command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('login')
      .description('Authenticate with EnvGuard')
      .action(async () => {
        await login();
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
    await push(options);
  });

program
  .command('status')
  .description('Compare local .env keys against team schema')
  .action(async () => {
    await status();
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
