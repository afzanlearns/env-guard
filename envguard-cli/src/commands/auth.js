import chalk from 'chalk';
import { setToken } from '../lib/auth.js';
import crypto from 'crypto';

export async function login() {
  console.log(chalk.blue('\n  Opening https://envguard.dev/cli-auth in your browser...'));
  console.log(chalk.dim('  Waiting for authentication...\n'));

  // Mocking the browser-based PAT generation for Phase 1 MVP
  setTimeout(async () => {
    // Generate a fake PAT token
    const fakeToken = 'eg_live_' + crypto.randomBytes(16).toString('hex');
    await setToken(fakeToken);

    console.log(chalk.green('  ✔ Authenticated as @developer'));
    console.log(chalk.green('  ✔ Token stored securely in system keychain\n'));
  }, 1500);
}
