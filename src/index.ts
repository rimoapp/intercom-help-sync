/**
 * intercom-help-sync
 * CLI tool to sync Intercom Help Center articles with local markdown files
 */

// Sync classes
export { SyncFromIntercom } from './sync/sync-from-intercom';
export { SyncToIntercom, type DryRunResult } from './sync/sync-to-intercom';
export { IntercomClient } from './sync/intercom-client';

// Utilities
export { htmlToMarkdown } from './utils/html-to-markdown';
export { markdownToHtml } from './utils/markdown-to-html';
export {
  parseMarkdown,
  stringifyMarkdown,
  generateFilePath,
  timestampToISO,
  stripImageSignatures,
  restoreImageSignatures,
} from './utils/markdown';
export {
  readArticle,
  writeArticle,
  deleteArticle,
  findArticleByIntercomId,
  getAllMarkdownFiles,
  loadConfig,
} from './utils/file-manager';

// Types
export type {
  IntercomConfig,
  IntercomArticle,
  ArticleFrontMatter,
  LocalArticle,
  SyncResult,
} from './types';
