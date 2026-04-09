import chalk from 'chalk';
import path from 'path';
import inquirer from 'inquirer';
import { parseEnvFile } from '../lib/parser.js';
import { readConfig } from '../lib/config.js';
import { readCache, writeCache } from '../lib/cache.js';

export async function push(options) {
  const config = readConfig();
  if (!config) {
    console.log(chalk.red('✖ Project not initialized. Run `envguard init` first.'));
    process.exit(1);
  }

  const envFile = options.file || '.env';
  const envPath = path.resolve(process.cwd(), envFile);
  
  const envName = options.env || config.defaultEnvironment;

  console.log(chalk.bold.magenta(`\n  ✦ Reading ${envFile}`));
  
  let localKeys = [];
  try {
    localKeys = parseEnvFile(envPath);
  } catch (e) {
    if (e.message === 'ERR_NO_ENV_FILE') {
      console.log(chalk.red(`  ✖ Could not find ${envFile}`));
      if (!options.allowEmpty) {
        process.exit(1);
      }
    } else {
      throw e;
    }
  }

  console.log(chalk.dim(`  ✦ Found ${localKeys.length} variables`));
  console.log(chalk.dim(`  ✦ Comparing with team schema for env: ${envName}...\n`));

  let existingSchema = readCache();
  if (!existingSchema || existingSchema.environment !== envName) {
    // Scaffold empty team schema
    existingSchema = {
      environment: envName,
      syncedAt: new Date().toISOString(),
      variables: []
    };
  }

  const existingKeys = existingSchema.variables.map(v => v.key);
  const localKeyNames = localKeys.map(k => k.key);

  const newKeys = localKeyNames.filter(k => !existingKeys.includes(k));
  const removedKeys = existingKeys.filter(k => !localKeyNames.includes(k));
  const commonKeys = localKeyNames.filter(k => existingKeys.includes(k));

  if (newKeys.length === 0 && removedKeys.length === 0) {
    console.log(chalk.green('  ✔ Pushed schema (0 changes — already in sync)\n'));
    return;
  }

  console.log(chalk.bold('  Changes detected:'));
  newKeys.forEach(k => console.log(chalk.green(`    + ${k}      (not in team schema)`)));
  removedKeys.forEach(k => console.log(chalk.red(`    - ${k}      (in team schema, not in your .env)`)));
  console.log('');

  const finalVariables = [...existingSchema.variables.filter(v => !removedKeys.includes(v.key))];

  if (options.interactive !== false) {
    for (const key of newKeys) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: `Describe ${chalk.cyan(key)}:`
        },
        {
          type: 'list',
          name: 'type',
          message: `Type for ${chalk.cyan(key)}:`,
          choices: ['string', 'url', 'boolean', 'number', 'port', 'enum', 'secret']
        },
        {
          type: 'confirm',
          name: 'required',
          message: `Required in this environment?`,
          default: true
        }
      ]);
      
      finalVariables.push({
        key,
        type: answers.type,
        description: answers.description,
        required: answers.required
      });
    }

    if (removedKeys.length > 0) {
      for (const key of removedKeys) {
        const { remove } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'remove',
            message: `${chalk.red(key)} is in the team schema but not in your .env. Remove it from the team schema?`,
            default: false
          }
        ]);
        if (!remove) {
          // Keep it if they said no
          const oldVar = existingSchema.variables.find(v => v.key === key);
          if (oldVar) finalVariables.push(oldVar);
        }
      }
    }
  } else {
    // Non-interactive: just drop removed, guess strings for new
    newKeys.forEach(key => {
      finalVariables.push({
        key,
        type: 'string',
        description: '',
        required: true
      });
    });
  }

  const updatedSchema = {
    environment: envName,
    syncedAt: new Date().toISOString(),
    variables: finalVariables
  };

  // MOCK API PUSH by updating local cache
  writeCache(updatedSchema);

  console.log(chalk.green(`\n  ✔ Pushed schema (${newKeys.length} added, ${commonKeys.length} unchanged, ${removedKeys.length} removed handled)`));
  console.log(chalk.green('  ✔ Audit log updated (mock)'));
  console.log(chalk.green('  ✔ Team notified via WebSocket (mock)\n'));
}
