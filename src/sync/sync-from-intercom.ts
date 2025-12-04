import * as path from 'path';
import { IntercomClient } from './intercom-client';
import { IntercomConfig, IntercomArticle, SyncResult, ArticleFrontMatter } from '../types';
import { writeArticle, findArticleByIntercomId, deleteArticle } from '../utils/file-manager';
import { generateFilePath, timestampToISO } from '../utils/markdown';
import { htmlToMarkdown } from '../utils/html-to-markdown';

export class SyncFromIntercom {
  private client: IntercomClient;
  private config: IntercomConfig;

  constructor(config: IntercomConfig) {
    this.config = config;
    this.client = new IntercomClient(config.intercomAccessToken);
  }

  /**
   * Sync all articles from Intercom to local files
   */
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const articles = await this.client.getAllArticles();

      for (const article of articles) {
        try {
          await this.syncArticle(article, result);
        } catch (error) {
          result.errors.push({
            articleId: article.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return result;
  }

  /**
   * Sync a single article by ID
   */
  async syncById(articleId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const article = await this.client.getArticle(articleId);
      await this.syncArticle(article, result);
    } catch (error) {
      result.success = false;
      result.errors.push({
        articleId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return result;
  }

  /**
   * Sync a single article to local file
   */
  private async syncArticle(
    article: IntercomArticle,
    result: SyncResult
  ): Promise<void> {
    // Sync default locale
    await this.syncArticleLocale(
      article,
      article.default_locale,
      article.title,
      article.body,
      article,
      result
    );

    // Sync translated content
    if (article.translated_content) {
      for (const [locale, translation] of Object.entries(article.translated_content)) {
        if (this.config.supportedLocales.includes(locale)) {
          await this.syncArticleLocale(
            article,
            locale,
            translation.title,
            translation.body,
            article,
            result
          );
        }
      }
    }
  }

  /**
   * Sync article for a specific locale
   */
  private async syncArticleLocale(
    article: IntercomArticle,
    locale: string,
    title: string,
    body: string,
    baseArticle: IntercomArticle,
    result: SyncResult
  ): Promise<void> {
    // Check if file already exists
    const existingFile = await findArticleByIntercomId(
      this.config.articlesDir,
      article.id
    );

    // Generate file path
    const collectionId = article.parent_id || 'uncategorized';
    const slug = title.replace(/\s+/g, '-');
    const relativePath = generateFilePath(locale, collectionId, slug);
    const filePath = path.join(this.config.articlesDir, relativePath);

    // Delete old file if title changed (different path)
    if (existingFile && existingFile !== filePath) {
      await deleteArticle(existingFile);
    }

    // Prepare front matter
    const frontMatter: ArticleFrontMatter = {
      intercom_id: article.id,
      intercom_collection_id: collectionId,
      locale,
      updated_at: timestampToISO(baseArticle.updated_at),
      status: baseArticle.state,
      title,
      author_id: baseArticle.author_id,
    };

    // Add translations map for default locale
    if (locale === baseArticle.default_locale && baseArticle.translated_content) {
      frontMatter.translations = {};
      for (const translationLocale of Object.keys(baseArticle.translated_content)) {
        if (this.config.supportedLocales.includes(translationLocale)) {
          const translationSlug = baseArticle.translated_content[translationLocale].title
            .toLowerCase()
            .replace(/\s+/g, '-');
          frontMatter.translations[translationLocale] = generateFilePath(
            translationLocale,
            collectionId,
            translationSlug
          );
        }
      }
    }

    // Convert HTML to Markdown
    const markdownBody = htmlToMarkdown(body);

    // Write to file
    await writeArticle(filePath, frontMatter, markdownBody);

    if (existingFile) {
      result.updated++;
    } else {
      result.created++;
    }
  }
}
