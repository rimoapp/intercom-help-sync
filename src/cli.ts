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
  .name('intercom-help-sync')
  .description('CLI tool to sync Intercom Help Center articles with local markdown files')
  .version('0.2.0');

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
  .argument('<files...>', 'Files to push')
  .option('-c, --config <path>', 'Path to config file', 'help-docs/.intercom-config.json')
  .option('-n, --dry-run', 'Show diff without pushing')
  .action(async (files: string[], options) => {
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

      let totalCreated = 0;
      let totalUpdated = 0;
      const errors: { file: string; error: string }[] = [];

      for (const file of files) {
        const filePath = path.resolve(process.cwd(), file);

        // Show diff
        spinner.text = `Comparing ${file}...`;
        try {
          const dryRunResult = await sync.dryRun(filePath);
          spinner.stop();

          console.log(chalk.cyan(`\n=== ${dryRunResult.title} ===`));
          console.log(chalk.gray(`File: ${file}`));
          if (dryRunResult.isNew) {
            console.log(chalk.yellow('This is a new article (will be created)\n'));
            console.log(chalk.green('New HTML:'));
            console.log(formatHtml(dryRunResult.newHtml));
          } else {
            console.log(chalk.gray(`Intercom ID: ${dryRunResult.intercomId}\n`));
            showDiff(dryRunResult.currentHtml || '', dryRunResult.newHtml);
          }

          // Show translation diffs
          for (const translation of dryRunResult.translations) {
            console.log(chalk.cyan(`\n=== Translation: ${translation.locale} ===`));
            if (translation.currentHtml) {
              showDiff(translation.currentHtml, translation.newHtml);
            } else {
              console.log(chalk.yellow('New translation\n'));
              console.log(chalk.green('New HTML:'));
              console.log(formatHtml(translation.newHtml));
            }
          }

          if (!options.dryRun) {
            // Actually push
            const pushSpinner = ora(`Pushing ${file}...`).start();
            const result = await sync.syncFile(filePath);
            pushSpinner.succeed(`Pushed ${file}`);

            totalCreated += result.created;
            totalUpdated += result.updated;

            if (result.errors.length > 0) {
              errors.push(...result.errors.map(err => ({
                file: err.file || file,
                error: err.error,
              })));
            }
          }
        } catch (error) {
          spinner.stop();
          errors.push({
            file,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(chalk.red(`Error processing ${file}: ${error instanceof Error ? error.message : String(error)}`));
        }

        spinner.start();
      }

      spinner.stop();

      if (options.dryRun) {
        console.log(chalk.cyan(`\n--- Dry run complete (no changes made) ---`));
      } else {
        console.log(chalk.green(`\nSync completed: ${totalCreated} created, ${totalUpdated} updated`));
      }

      if (errors.length > 0) {
        console.error(chalk.red(`\n${errors.length} error(s):`));
        errors.forEach(err => {
          console.error(chalk.red(`  - ${err.file}: ${err.error}`));
        });
      }
    } catch (error) {
      spinner.fail('Failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Format HTML for display (add line breaks for readability)
 */
function formatHtml(html: string): string {
  return html
    .replace(/></g, '>\n<')
    .split('\n')
    .map(line => '  ' + line)
    .join('\n');
}

/**
 * Show diff between two HTML strings
 */
function showDiff(oldHtml: string, newHtml: string): void {
  if (oldHtml === newHtml) {
    console.log(chalk.gray('No changes\n'));
    return;
  }

  // Simple line-by-line diff
  const oldLines = oldHtml.replace(/></g, '>\n<').split('\n');
  const newLines = newHtml.replace(/></g, '>\n<').split('\n');

  // Find common prefix
  let commonStart = 0;
  while (commonStart < oldLines.length && commonStart < newLines.length &&
         oldLines[commonStart] === newLines[commonStart]) {
    commonStart++;
  }

  // Find common suffix
  let commonEnd = 0;
  while (commonEnd < oldLines.length - commonStart &&
         commonEnd < newLines.length - commonStart &&
         oldLines[oldLines.length - 1 - commonEnd] === newLines[newLines.length - 1 - commonEnd]) {
    commonEnd++;
  }

  const oldDiff = oldLines.slice(commonStart, oldLines.length - commonEnd);
  const newDiff = newLines.slice(commonStart, newLines.length - commonEnd);

  if (commonStart > 0) {
    console.log(chalk.gray(`  ... (${commonStart} unchanged lines)`));
  }

  for (const line of oldDiff) {
    console.log(chalk.red('- ' + line));
  }
  for (const line of newDiff) {
    console.log(chalk.green('+ ' + line));
  }

  if (commonEnd > 0) {
    console.log(chalk.gray(`  ... (${commonEnd} unchanged lines)`));
  }

  console.log();
}

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

      // Helper to check if file exists
      const fileExists = async (filePath: string): Promise<boolean> => {
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      };

      // Create directory structure (always ensures directories exist)
      await ensureDir(path.join(targetDir, 'articles', 'ja'));
      await ensureDir(path.join(targetDir, 'articles', 'en'));

      // Create files only if they don't exist
      const configPath = path.join(targetDir, '.intercom-config.json');
      if (!await fileExists(configPath)) {
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
      }

      const gitignorePath = path.join(targetDir, '.gitignore');
      if (!await fileExists(gitignorePath)) {
        const gitignoreContent = `# Ignore original HTML files (used for preserving image signatures)\n*.original\n`;
        await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');
      }

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
   npx intercom-help-sync pull
   \`\`\`

## Usage

### Pull articles from Intercom
\`\`\`bash
npx intercom-help-sync pull
\`\`\`

### Push files to Intercom
\`\`\`bash
npx intercom-help-sync push articles/ja/getting-started/quick-start.md
\`\`\`

### Push with dry run (preview changes)
\`\`\`bash
npx intercom-help-sync push articles/ja/quick-start.md --dry-run
\`\`\`

### Pull specific article
\`\`\`bash
npx intercom-help-sync pull --article-id 123456
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

      if (!await fileExists(readmePath)) {
        await fs.writeFile(readmePath, readmeContent, 'utf-8');
      }

      spinner.succeed(`Initialized help-docs at ${targetDir}`);
      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.cyan('  1. Set INTERCOM_ACCESS_TOKEN environment variable'));
      console.log(chalk.cyan('  2. Run: npx intercom-help-sync pull'));
    } catch (error) {
      spinner.fail('Initialization failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program.parse();
