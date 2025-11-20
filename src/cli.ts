#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './utils/file-manager';
import { SyncFromIntercom } from './sync/sync-from-intercom';
import { SyncToIntercom } from './sync/sync-to-intercom';
import { IntercomConfig } from './types';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('intercom-sync')
  .description('CLI tool to sync Intercom Help Center articles with local markdown files')
  .version('0.1.0');

program
  .command('pull')
  .description('Pull articles from Intercom to local files')
  .option('-c, --config <path>', 'Path to config file', 'help-docs/.intercom-config.json')
  .option('-a, --article-id <id>', 'Sync only specific article by ID')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const configPath = path.resolve(process.cwd(), options.config);
      const config: IntercomConfig = await loadConfig(configPath);

      // Convert relative path to absolute
      config.articlesDir = path.resolve(
        path.dirname(configPath),
        config.articlesDir
      );

      const sync = new SyncFromIntercom(config);

      if (options.articleId) {
        spinner.text = `Pulling article ${options.articleId}...`;
        const result = await sync.syncById(options.articleId);
        
        spinner.succeed(
          `Sync completed: ${result.created} created, ${result.updated} updated`
        );
        
        if (result.errors.length > 0) {
          console.error(chalk.red('\nErrors:'));
          result.errors.forEach(err => {
            console.error(chalk.red(`  - ${err.articleId || 'Unknown'}: ${err.error}`));
          });
        }
      } else {
        spinner.text = 'Pulling all articles from Intercom...';
        const result = await sync.syncAll();

        spinner.succeed(
          `Sync completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
        );

        if (result.errors.length > 0) {
          console.error(chalk.red(`\n${result.errors.length} errors occurred:`));
          result.errors.forEach(err => {
            console.error(chalk.red(`  - ${err.articleId || 'Unknown'}: ${err.error}`));
          });
        }
      }
    } catch (error) {
      spinner.fail('Sync failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('push')
  .description('Push local articles to Intercom')
  .option('-c, --config <path>', 'Path to config file', 'help-docs/.intercom-config.json')
  .option('-f, --file <path>', 'Sync only specific file')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const configPath = path.resolve(process.cwd(), options.config);
      const config: IntercomConfig = await loadConfig(configPath);

      // Convert relative path to absolute
      config.articlesDir = path.resolve(
        path.dirname(configPath),
        config.articlesDir
      );

      const sync = new SyncToIntercom(config);

      if (options.file) {
        const filePath = path.resolve(process.cwd(), options.file);
        spinner.text = `Pushing ${options.file}...`;
        const result = await sync.syncFile(filePath);

        spinner.succeed(
          `Sync completed: ${result.created} created, ${result.updated} updated`
        );

        if (result.errors.length > 0) {
          console.error(chalk.red('\nErrors:'));
          result.errors.forEach(err => {
            console.error(chalk.red(`  - ${err.file || err.articleId || 'Unknown'}: ${err.error}`));
          });
        }
      } else {
        spinner.text = 'Pushing all local articles to Intercom...';
        const result = await sync.syncAll();

        spinner.succeed(
          `Sync completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
        );

        if (result.errors.length > 0) {
          console.error(chalk.red(`\n${result.errors.length} errors occurred:`));
          result.errors.forEach(err => {
            console.error(chalk.red(`  - ${err.file || err.articleId || 'Unknown'}: ${err.error}`));
          });
        }
      }
    } catch (error) {
      spinner.fail('Sync failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize help-docs directory structure')
  .option('-d, --dir <path>', 'Target directory', 'help-docs')
  .action(async (options) => {
    const spinner = ora('Initializing help-docs...').start();

    try {
      const { ensureDir } = await import('./utils/file-manager');
      const fs = await import('fs/promises');
      
      const targetDir = path.resolve(process.cwd(), options.dir);
      
      // Create directory structure
      await ensureDir(path.join(targetDir, 'articles', 'ja'));
      await ensureDir(path.join(targetDir, 'articles', 'en'));

      // Create config file
      const configPath = path.join(targetDir, '.intercom-config.json');
      const configContent = {
        intercomAccessToken: 'env:INTERCOM_ACCESS_TOKEN',
        articlesDir: './articles',
        defaultLocale: 'ja',
        supportedLocales: ['ja', 'en'],
      };

      await fs.writeFile(
        configPath,
        JSON.stringify(configContent, null, 2),
        'utf-8'
      );

      // Create README
      const readmePath = path.join(targetDir, 'README.md');
      const readmeContent = `# Help Documentation

This directory contains synchronized documentation from Intercom Help Center.

## Setup

1. Set your Intercom access token:
   \`\`\`bash
   export INTERCOM_ACCESS_TOKEN=your_token_here
   \`\`\`

2. Pull articles from Intercom:
   \`\`\`bash
   npx intercom-sync pull
   \`\`\`

## Usage

### Pull articles from Intercom
\`\`\`bash
npx intercom-sync pull
\`\`\`

### Push local changes to Intercom
\`\`\`bash
npx intercom-sync push
\`\`\`

### Sync specific article
\`\`\`bash
npx intercom-sync pull --article-id 123456
\`\`\`

### Sync specific file
\`\`\`bash
npx intercom-sync push --file articles/ja/getting-started/quick-start.md
\`\`\`

## Directory Structure

\`\`\`
help-docs/
├── articles/
│   ├── ja/          # Japanese articles
│   └── en/          # English articles
├── .intercom-config.json
└── README.md
\`\`\`
`;

      await fs.writeFile(readmePath, readmeContent, 'utf-8');

      spinner.succeed(`Initialized help-docs at ${targetDir}`);
      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.cyan('  1. Set INTERCOM_ACCESS_TOKEN environment variable'));
      console.log(chalk.cyan('  2. Run: npx intercom-sync pull'));
    } catch (error) {
      spinner.fail('Initialization failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program.parse();
