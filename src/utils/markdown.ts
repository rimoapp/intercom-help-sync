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

/**
 * Remove signature parameters (expires, signature, req) from Intercom image URLs
 * These are temporary and change on each API call
 */
export function stripImageSignatures(html: string): string {
  // Match Intercom CDN URLs and remove expires, signature, req parameters
  // Pattern matches: domain + path (no query) + query string
  return html.replace(
    /(https:\/\/(?:downloads\.intercomcdn\.com|[a-z0-9-]+\.intercom-attachments[a-z0-9.-]*)[^"'\s?]*)\?[^"'\s]*/g,
    (match, baseUrl) => {
      // Parse the URL and keep only non-signature parameters
      try {
        const url = new URL(match);
        const paramsToRemove = ['expires', 'signature', 'req'];
        paramsToRemove.forEach(param => url.searchParams.delete(param));

        // If no params left, return base URL
        const remainingParams = url.searchParams.toString();
        return remainingParams ? `${baseUrl}?${remainingParams}` : baseUrl;
      } catch {
        // If URL parsing fails, return base URL
        return baseUrl;
      }
    }
  );
}

/**
 * Restore image signatures from original HTML
 * Maps base URLs to their full signed versions
 */
export function restoreImageSignatures(html: string, originalHtml: string): string {
  // Build a map of base URL -> full signed URL from original
  const signedUrls = new Map<string, string>();
  const urlRegex = /(https:\/\/(?:downloads\.intercomcdn\.com|[a-z0-9-]+\.intercom-attachments[a-z0-9.-]*)[^"'\s?]*\?[^"'\s]*)/g;

  let match;
  while ((match = urlRegex.exec(originalHtml)) !== null) {
    try {
      const fullUrl = match[1];
      const url = new URL(fullUrl);
      // Remove signature params to get base key
      ['expires', 'signature', 'req'].forEach(param => url.searchParams.delete(param));
      const baseKey = url.searchParams.toString()
        ? `${url.origin}${url.pathname}?${url.searchParams.toString()}`
        : `${url.origin}${url.pathname}`;
      signedUrls.set(baseKey, fullUrl);
    } catch {
      // Skip invalid URLs
    }
  }

  // Replace base URLs in html with signed versions
  return html.replace(
    /(https:\/\/(?:downloads\.intercomcdn\.com|[a-z0-9-]+\.intercom-attachments[a-z0-9.-]*)[^"'\s?]*)(?:\?[^"'\s]*)?/g,
    (match) => {
      try {
        const url = new URL(match);
        ['expires', 'signature', 'req'].forEach(param => url.searchParams.delete(param));
        const baseKey = url.searchParams.toString()
          ? `${url.origin}${url.pathname}?${url.searchParams.toString()}`
          : `${url.origin}${url.pathname}`;
        return signedUrls.get(baseKey) || match;
      } catch {
        return match;
      }
    }
  );
}
