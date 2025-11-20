import * as path from 'path';
import { IntercomClient } from './intercom-client';
import { IntercomConfig, SyncResult, LocalArticle, IntercomArticle } from '../types';
import { readArticle, getAllMarkdownFiles } from '../utils/file-manager';

export class SyncToIntercom {
  private client: IntercomClient;
  private config: IntercomConfig;

  constructor(config: IntercomConfig) {
    this.config = config;
    this.client = new IntercomClient(config.intercomAccessToken);
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
      const article = await readArticle(filePath);
      
      // Find related translations
      const relatedArticles = [article];
      if (article.frontMatter.translations) {
        for (const translationPath of Object.values(article.frontMatter.translations)) {
          const fullPath = path.join(this.config.articlesDir, translationPath);
          try {
            const translatedArticle = await readArticle(fullPath);
            relatedArticles.push(translatedArticle);
          } catch {
            // Translation file might not exist yet
          }
        }
      }

      await this.syncArticleGroup(
        article.frontMatter.intercom_id,
        relatedArticles,
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
   * Sync a group of articles (default locale + translations)
   */
  private async syncArticleGroup(
    intercomId: string | undefined,
    articles: LocalArticle[],
    result: SyncResult
  ): Promise<void> {
    // Find the default locale article
    const defaultArticle = articles.find(
      a => a.frontMatter.locale === this.config.defaultLocale
    ) || articles[0];

    if (!defaultArticle) {
      throw new Error('No articles to sync');
    }

    // Prepare translated content
    const translatedContent: IntercomArticle['translated_content'] = {};
    
    for (const article of articles) {
      if (article.frontMatter.locale !== this.config.defaultLocale) {
        translatedContent[article.frontMatter.locale] = {
          type: 'article_content',
          title: article.frontMatter.title || this.extractTitle(article.content),
          body: article.content,
          author_id: article.frontMatter.author_id || 0,
          state: article.frontMatter.status || 'draft',
          created_at: 0,
          updated_at: 0,
        };
      }
    }

    const articleData = {
      title: defaultArticle.frontMatter.title || this.extractTitle(defaultArticle.content),
      body: defaultArticle.content,
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
