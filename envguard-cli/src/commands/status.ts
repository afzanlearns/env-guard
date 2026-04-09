import chalk from 'chalk';
import path from 'path';
import { parseEnvFile } from '../lib/parser.js';
import { readConfig } from '../lib/config.js';
import { readCache } from '../lib/cache.js';

export async function status() {
  const config = readConfig();
  if (!config) {
    console.log(chalk.red('✖ Project not initialized. Run `envguard init` first.'));
    process.exit(2);
  }

  const envName = config.defaultEnvironment;
  const envPath = path.resolve(process.cwd(), '.env');

  console.log(chalk.bold.magenta(`\n  ✦ Comparing local .env against team schema (${envName})`));
  
  let teamSchema = readCache();
  if (!teamSchema) {
    console.log(chalk.yellow(`    Using default empty schema • run \`envguard pull\` to refresh\n`));
    teamSchema = { variables: [] };
  } else {
    // Just a mocked way to show cached time relative
    console.log(chalk.dim(`    Using cached schema (synced at ${teamSchema.syncedAt}) • run \`envguard pull\` to refresh\n`));
  }

  let localParserKeys = [];
  try {
    localParserKeys = parseEnvFile(envPath);
  } catch (e) {
    if (e.message !== 'ERR_NO_ENV_FILE') throw e;
  }

  const localKeys = localParserKeys.map(k => k.key);
  const teamKeys = teamSchema.variables.map(v => v.key);

  const missingFromLocal = teamSchema.variables.filter(v => !localKeys.includes(v.key));
  const extraInLocal = localKeys.filter(k => !teamKeys.includes(k));
  const inSync = teamSchema.variables.filter(v => localKeys.includes(v.key));

  const totalIssues = missingFromLocal.length + extraInLocal.length;

  if (totalIssues > 0) {
    console.log(chalk.yellow(`  Status: ⚠ ${totalIssues} issue(s) found\n`));
  } else {
    console.log(chalk.green(`  Status: ✔ Fully in sync\n`));
  }

  if (missingFromLocal.length > 0) {
    console.log(chalk.red('  MISSING from your .env (in team schema):'));
    missingFromLocal.forEach(v => {
      console.log(`    ✖ ${v.key.padEnd(20)} — ${v.description || 'No description'} (${v.type}${v.required ? ', required' : ''})`);
    });
    console.log('');
  }

  if (extraInLocal.length > 0) {
    console.log(chalk.yellow('  EXTRA in your .env (not in team schema):'));
    extraInLocal.forEach(k => {
      console.log(`    ? ${k.padEnd(20)} — Not in team schema. Run \`envguard push\` to add it.`);
    });
    console.log('');
  }

  if (inSync.length > 0) {
    console.log(chalk.green(`  IN SYNC (${inSync.length} variables):`));
    inSync.slice(0, 5).forEach(v => {
      console.log(`    ✔ ${v.key}`);
    });
    if (inSync.length > 5) {
      console.log(chalk.dim(`    ... (${inSync.length - 5} more)`));
    }
    console.log('');
  }

  if (missingFromLocal.length > 0) {
    process.exit(1);
  }
}
