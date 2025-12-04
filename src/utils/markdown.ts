import matter from 'gray-matter';
import { ArticleFrontMatter } from '../types';

/**
 * Parse markdown file with front matter
 */
export function parseMarkdown(content: string): {
  frontMatter: ArticleFrontMatter;
  content: string;
} {
  const parsed = matter(content);
  return {
    frontMatter: parsed.data as ArticleFrontMatter,
    content: parsed.content,
  };
}

/**
 * Stringify markdown with front matter
 */
export function stringifyMarkdown(
  frontMatter: ArticleFrontMatter,
  content: string
): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yaml = require('js-yaml');
  const result = matter.stringify(content, frontMatter, {
    engines: {
      yaml: {
        parse: (input: string) => yaml.load(input),
        stringify: (obj: object) => {
          return yaml.dump(obj, {
            quotingType: '"',
            forceQuotes: false,
            lineWidth: -1,
          });
        },
      },
    },
  });
  // Ensure newline after front matter
  return result.replace(/^(---\n[\s\S]*?\n---)\n*/, '$1\n\n');
}

/**
 * Extract title from markdown content (first h1)
 */
export function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Generate file path from article metadata
 */
export function generateFilePath(
  locale: string,
  collectionId: string,
  slug: string
): string {
  const sanitizedSlug = slug
    .replace(/[\/\\:*?"<>|]/g, '-')  // ファイル名に使えない文字のみ置換
    .replace(/\s+/g, '-')             // スペースをハイフンに
    .replace(/-+/g, '-')              // 連続ハイフンを1つに
    .replace(/^-|-$/g, '');           // 先頭末尾のハイフンを除去

  return `${locale}/${collectionId}/${sanitizedSlug}.md`;
}

/**
 * Convert Intercom timestamp to ISO string
 */
export function timestampToISO(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}
