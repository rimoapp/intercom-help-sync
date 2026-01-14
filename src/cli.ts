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
  .version('0.3.0');

program
  .command('pull')
  .description('Pull articles from Intercom to local files')
  .option('-c, --config <path>', 'Path to config file (optional)')
  .option('-a, --article-id <id>', 'Sync only specific article by ID')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      // Try to find config file
      const configPath = options.config
        ? path.resolve(process.cwd(), options.config)
        : path.resolve(process.cwd(), 'help-docs/.intercom-config.json');
      const basePath = path.resolve(process.cwd(), 'help-docs');

      const config: IntercomConfig = await loadConfig(configPath, basePath);

      // Convert relative path to absolute if config file exists
      if (options.config || await import('fs/promises').then(fs => fs.access(configPath).then(() => true).catch(() => false))) {
        config.articlesDir = path.resolve(
          path.dirname(configPath),
          config.articlesDir
        );
      }

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
  .option('-c, --config <path>', 'Path to config file (optional)')
  .option('-n, --dry-run', 'Show diff without pushing')
  .action(async (files: string[], options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      // Try to find config file
      const configPath = options.config
        ? path.resolve(process.cwd(), options.config)
        : path.resolve(process.cwd(), 'help-docs/.intercom-config.json');
      const basePath = path.resolve(process.cwd(), 'help-docs');

      const config: IntercomConfig = await loadConfig(configPath, basePath);

      // Convert relative path to absolute if config file exists
      if (options.config || await import('fs/promises').then(fs => fs.access(configPath).then(() => true).catch(() => false))) {
        config.articlesDir = path.resolve(
          path.dirname(configPath),
          config.articlesDir
        );
      }

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

program.parse();
