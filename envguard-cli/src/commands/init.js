import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { readConfig, writeConfig } from '../lib/config.js';
import { getToken } from '../lib/auth.js';

export async function init() {
  console.log(chalk.bold.magenta('\n  ✦ EnvGuard — Environment Schema Manager\n'));

  // Let's pretend auth check is optional for the MVP or we just warn if missing
  const token = await getToken();
  if (!token) {
    console.log(chalk.yellow('  ⚠ Not authenticated. Run `envguard auth login` later to sync with the cloud.'));
  }

  const existingConfig = readConfig();
  if (existingConfig) {
    console.log(chalk.blue(`  ℹ Project already initialized (slug: ${existingConfig.projectSlug})`));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to connect this project?',
      choices: [
        'Create a new EnvGuard project',
        'Link to an existing project'
      ]
    },
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: path.basename(process.cwd())
    },
    {
      type: 'input',
      name: 'defaultEnvironment',
      message: 'Default environment:',
      default: 'development'
    }
  ]);

  const slug = answers.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const config = {
    projectSlug: slug,
    defaultEnvironment: answers.defaultEnvironment,
    apiUrl: 'https://api.envguard.dev',
    version: 1
  };

  writeConfig(config);

  // Add to gitignore if not present
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let gitignoreContent = '';
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  if (!gitignoreContent.includes('.envguard')) {
    fs.appendFileSync(gitignorePath, '\n# EnvGuard\n.envguard/\n');
  }
  if (!gitignoreContent.includes('.env') && !gitignoreContent.includes('*.env')) {
    fs.appendFileSync(gitignorePath, '.env\n');
  }

  console.log(chalk.green(`\n  ✔ Created project "${answers.projectName}" (slug: ${slug})`));
  console.log(chalk.green('  ✔ Created .envguard/config.json'));
  console.log(chalk.green('  ✔ Added .envguard/ to .gitignore\n'));

  console.log(chalk.dim('  Next steps:'));
  console.log(chalk.dim('    Run `envguard push` to upload your current .env schema'));
  console.log(chalk.dim('    Run `envguard pull` to generate a .env.example\n'));
}
