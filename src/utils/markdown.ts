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
  return matter.stringify(content, frontMatter);
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
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `${locale}/${collectionId}/${sanitizedSlug}.md`;
}

/**
 * Convert Intercom timestamp to ISO string
 */
export function timestampToISO(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}
