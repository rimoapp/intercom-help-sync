import axios, { AxiosInstance } from 'axios';
import { IntercomArticle, IntercomArticlesResponse, IntercomCollection, IntercomCollectionsResponse } from '../types';

export class IntercomClient {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.intercom.io',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Intercom-Version': '2.10',
      },
    });
  }

  /**
   * Fetch all articles from Intercom Help Center
   */
  async getAllArticles(): Promise<IntercomArticle[]> {
    const articles: IntercomArticle[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.get<IntercomArticlesResponse>(
        '/articles',
        {
          params: {
            page,
            per_page: 50,
          },
        }
      );

      articles.push(...response.data.data);

      hasMore = page < response.data.pages.total_pages;
      page++;
    }

    return articles;
  }

  /**
   * Fetch all collections from Intercom Help Center
   */
  async getAllCollections(): Promise<IntercomCollection[]> {
    const collections: IntercomCollection[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.get<IntercomCollectionsResponse>(
        '/help_center/collections',
        {
          params: {
            page,
            per_page: 50,
          },
        }
      );

      collections.push(...response.data.data);

      hasMore = page < response.data.pages.total_pages;
      page++;
    }

    return collections;
  }

  /**
   * Fetch a single article by ID
   */
  async getArticle(articleId: string): Promise<IntercomArticle> {
    const response = await this.client.get<IntercomArticle>(
      `/articles/${articleId}`
    );
    return response.data;
  }

  /**
   * Create a new article
   */
  async createArticle(data: {
    title: string;
    body: string;
    author_id: number;
    state?: 'published' | 'draft';
    parent_id?: string;
    parent_type?: string;
    translated_content?: IntercomArticle['translated_content'];
  }): Promise<IntercomArticle> {
    const response = await this.client.post<IntercomArticle>('/articles', data);
    return response.data;
  }

  /**
   * Update an existing article
   */
  async updateArticle(
    articleId: string,
    data: {
      title?: string;
      body?: string;
      author_id?: number;
      state?: 'published' | 'draft';
      parent_id?: string;
      parent_type?: string;
      translated_content?: IntercomArticle['translated_content'];
    }
  ): Promise<IntercomArticle> {
    const response = await this.client.put<IntercomArticle>(
      `/articles/${articleId}`,
      data
    );
    return response.data;
  }

  /**
   * Delete an article
   */
  async deleteArticle(articleId: string): Promise<void> {
    await this.client.delete(`/articles/${articleId}`);
  }
}
