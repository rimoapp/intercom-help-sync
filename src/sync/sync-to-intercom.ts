import * as path from 'path';
import { IntercomClient } from './intercom-client';
import { IntercomConfig, SyncResult, LocalArticle, IntercomArticle } from '../types';
import { readArticle, getAllMarkdownFiles } from '../utils/file-manager';
import { markdownToHtml } from '../utils/markdown-to-html';

export interface DryRunResult {
  title: string;
  intercomId?: string;
  isNew: boolean;
  currentHtml?: string;
  newHtml: string;
  translations: {
    locale: string;
    currentHtml?: string;
    newHtml: string;
  }[];
}

export class SyncToIntercom {
  private client: IntercomClient;
  private config: IntercomConfig;

  constructor(config: IntercomConfig) {
    this.config = config;
    this.client = new IntercomClient(config.intercomAccessToken);
  }

  /**
   * Find the default locale article from a list of articles
   * Priority: 1) article with translations field, 2) config.defaultLocale, 3) first article
   */
  private findDefaultArticle(articles: LocalArticle[]): LocalArticle {
    // Article with translations field is the default locale
    const withTranslations = articles.find(a => a.frontMatter.translations && Object.keys(a.frontMatter.translations).length > 0);
    if (withTranslations) {
      return withTranslations;
    }

    // Fall back to config.defaultLocale if specified
    if (this.config.defaultLocale) {
      const byConfigLocale = articles.find(a => a.frontMatter.locale === this.config.defaultLocale);
      if (byConfigLocale) {
        return byConfigLocale;
      }
    }

    // Fall back to first article
    return articles[0];
  }

  /**
   * Sync all local articles to Intercom
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
      const files = await getAllMarkdownFiles(this.config.articlesDir);

      // Group files by intercom_id (to handle translations together)
      const articleGroups = new Map<string | undefined, LocalArticle[]>();
      
      for (const file of files) {
        try {
          const article = await readArticle(file);
          const id = article.frontMatter.intercom_id;
          
          if (!articleGroups.has(id)) {
            articleGroups.set(id, []);
          }
          articleGroups.get(id)!.push(article);
        } catch (error) {
          result.errors.push({
            file,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Sync each article group
      for (const [intercomId, articles] of articleGroups) {
        try {
          await this.syncArticleGroup(intercomId, articles, result);
        } catch (error) {
          result.errors.push({
            articleId: intercomId,
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
   * Sync a single local file to Intercom
   */
  async syncFile(filePath: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const { articles } = await this.prepareArticles(filePath);

      await this.syncArticleGroup(
        articles[0].frontMatter.intercom_id,
        articles,
        result
      );
    } catch (error) {
      result.success = false;
      result.errors.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return result;
  }

  /**
   * Dry run: show diff between local and remote without pushing
   */
  async dryRun(filePath: string): Promise<DryRunResult> {
    const { articles, defaultArticle } = await this.prepareArticles(filePath);
    const intercomId = defaultArticle.frontMatter.intercom_id;

    // Fetch current article from Intercom
    let currentHtml: string | undefined;
    let currentTranslations: Record<string, string> = {};

    if (intercomId) {
      try {
        const currentArticle = await this.client.getArticle(intercomId);
        currentHtml = currentArticle.body;

        if (currentArticle.translated_content) {
          for (const [locale, translation] of Object.entries(currentArticle.translated_content)) {
            currentTranslations[locale] = translation.body;
          }
        }
      } catch {
        // Article might not exist
      }
    }

    // Convert markdown to HTML
    const newHtml = markdownToHtml(defaultArticle.content, currentHtml);

    // Process translations (articles other than default)
    const translations: DryRunResult['translations'] = [];
    const defaultLocale = defaultArticle.frontMatter.locale;
    for (const article of articles) {
      if (article.frontMatter.locale !== defaultLocale) {
        const locale = article.frontMatter.locale;
        translations.push({
          locale,
          currentHtml: currentTranslations[locale],
          newHtml: markdownToHtml(article.content, currentTranslations[locale]),
        });
      }
    }

    return {
      title: defaultArticle.frontMatter.title || this.extractTitle(defaultArticle.content),
      intercomId,
      isNew: !intercomId,
      currentHtml,
      newHtml,
      translations,
    };
  }

  /**
   * Prepare articles for sync (shared between syncFile and dryRun)
   */
  private async prepareArticles(filePath: string): Promise<{
    articles: LocalArticle[];
    defaultArticle: LocalArticle;
  }> {
    const article = await readArticle(filePath);

    // Find related translations
    const articles = [article];
    if (article.frontMatter.translations) {
      for (const translationPath of Object.values(article.frontMatter.translations)) {
        const fullPath = path.join(this.config.articlesDir, translationPath);
        try {
          const translatedArticle = await readArticle(fullPath);
          articles.push(translatedArticle);
        } catch {
          // Translation file might not exist yet
        }
      }
    }

    // Find default locale article
    const defaultArticle = this.findDefaultArticle(articles);

    return { articles, defaultArticle };
  }

  /**
   * Sync a group of articles (default locale + translations)
   */
  private async syncArticleGroup(
    intercomId: string | undefined,
    articles: LocalArticle[],
    result: SyncResult
  ): Promise<void> {
    if (articles.length === 0) {
      throw new Error('No articles to sync');
    }

    // Find the default locale article
    const defaultArticle = this.findDefaultArticle(articles);

    // Fetch current article from Intercom to get image signatures
    let originalHtml: string | undefined;
    let originalTranslations: Record<string, string> = {};

    if (intercomId) {
      try {
        const currentArticle = await this.client.getArticle(intercomId);
        originalHtml = currentArticle.body;

        // Get original HTML for each translation
        if (currentArticle.translated_content) {
          for (const [locale, translation] of Object.entries(currentArticle.translated_content)) {
            originalTranslations[locale] = translation.body;
          }
        }
      } catch {
        // Article might not exist yet, proceed without original HTML
      }
    }

    // Convert markdown to HTML for default locale
    const defaultBody = markdownToHtml(defaultArticle.content, originalHtml);

    // Prepare translated content (articles other than default)
    const translatedContent: IntercomArticle['translated_content'] = {};
    const defaultLocale = defaultArticle.frontMatter.locale;

    for (const article of articles) {
      if (article.frontMatter.locale !== defaultLocale) {
        const locale = article.frontMatter.locale;
        const originalTranslationHtml = originalTranslations[locale];

        translatedContent[locale] = {
          type: 'article_content',
          title: article.frontMatter.title || this.extractTitle(article.content),
          body: markdownToHtml(article.content, originalTranslationHtml),
          author_id: article.frontMatter.author_id || 0,
          state: article.frontMatter.status || 'draft',
          created_at: 0,
          updated_at: 0,
        };
      }
    }

    const articleData = {
      title: defaultArticle.frontMatter.title || this.extractTitle(defaultArticle.content),
      body: defaultBody,
      author_id: defaultArticle.frontMatter.author_id || 0,
      state: defaultArticle.frontMatter.status || 'draft' as const,
      parent_id: defaultArticle.frontMatter.intercom_collection_id,
      parent_type: 'collection' as const,
      translated_content: Object.keys(translatedContent).length > 0 ? translatedContent : undefined,
    };

    if (intercomId) {
      // Update existing article
      await this.client.updateArticle(intercomId, articleData);
      result.updated++;
    } else {
      // Create new article
      const created = await this.client.createArticle(articleData);

      // Update all local files with the new intercom_id
      for (const article of articles) {
        article.frontMatter.intercom_id = created.id;
        const { writeArticle } = await import('../utils/file-manager');
        await writeArticle(
          article.filePath,
          article.frontMatter,
          article.content
        );
      }

      result.created++;
    }
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled';
  }
}
