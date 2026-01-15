export interface IntercomConfig {
  intercomAccessToken: string;
  articlesDir: string;
  defaultLocale?: string;  // Optional: determined from article.default_locale during sync
  supportedLocales?: string[];  // Optional: all translations are synced if not specified
}

export interface ArticleFrontMatter {
  intercom_id?: string;
  intercom_collection_id?: string;
  locale: string;
  translations?: Record<string, string>;
  updated_at?: string;
  status?: 'published' | 'draft';
  title?: string;
  author_id?: number;
}

export interface IntercomArticle {
  id: string;
  type: 'article';
  title: string;
  body: string;
  description?: string;
  author_id: number;
  state: 'published' | 'draft';
  created_at: number;
  updated_at: number;
  url?: string;
  parent_id?: string;
  parent_type?: string;
  default_locale: string;
  translated_content?: {
    [locale: string]: {
      type: 'article_content';
      title: string;
      body: string;
      description?: string;
      author_id: number;
      state: 'published' | 'draft';
      created_at: number;
      updated_at: number;
    };
  };
}

export interface IntercomCollection {
  id: string;
  type: 'collection';
  workspace_id: string;
  name: string;
  description?: string;
  created_at: number;
  updated_at: number;
  url?: string;
  icon?: string;
  order?: number;
  default_locale: string;
  translated_content?: {
    [locale: string]: {
      type: 'collection_content';
      name: string;
      description?: string;
    };
  };
}

export interface IntercomCollectionsResponse {
  type: 'list';
  pages: {
    type: 'pages';
    page: number;
    per_page: number;
    total_pages: number;
  };
  total_count: number;
  data: IntercomCollection[];
}

export interface IntercomArticlesResponse {
  type: 'list';
  pages: {
    type: 'pages';
    page: number;
    per_page: number;
    total_pages: number;
  };
  total_count: number;
  data: IntercomArticle[];
}

export interface LocalArticle {
  filePath: string;
  frontMatter: ArticleFrontMatter;
  content: string;
}

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    file?: string;
    articleId?: string;
    error: string;
  }>;
}
