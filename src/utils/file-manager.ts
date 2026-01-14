import * as fs from 'fs/promises';
import * as path from 'path';
import { LocalArticle, ArticleFrontMatter, IntercomConfig } from '../types';
import { parseMarkdown, stringifyMarkdown } from './markdown';

/**
 * Check if a file or directory exists
 */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists, create if it doesn't
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!(await exists(dirPath))) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Read a markdown file and parse it
 */
export async function readArticle(filePath: string): Promise<LocalArticle> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { frontMatter, content: body } = parseMarkdown(content);
  
  return {
    filePath,
    frontMatter,
    content: body,
  };
}

/**
 * Write a markdown file with front matter
 */
export async function writeArticle(
  filePath: string,
  frontMatter: ArticleFrontMatter,
  content: string
): Promise<void> {
  const dirPath = path.dirname(filePath);
  await ensureDir(dirPath);
  
  const markdown = stringifyMarkdown(frontMatter, content);
  await fs.writeFile(filePath, markdown, 'utf-8');
}

/**
 * Get all markdown files in a directory recursively
 */
export async function getAllMarkdownFiles(
  dirPath: string
): Promise<string[]> {
  const files: string[] = [];
  
  if (!(await exists(dirPath))) {
    return files;
  }

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dirPath);
  return files;
}

/**
 * Find article file by Intercom ID
 */
export async function findArticleByIntercomId(
  articlesDir: string,
  intercomId: string
): Promise<string | null> {
  const files = await getAllMarkdownFiles(articlesDir);
  
  for (const file of files) {
    try {
      const article = await readArticle(file);
      if (article.frontMatter.intercom_id === intercomId) {
        return file;
      }
    } catch (error) {
      // Skip files that can't be parsed
      continue;
    }
  }
  
  return null;
}

/**
 * Delete a file
 */
export async function deleteArticle(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

/**
 * Load configuration from .intercom-config.json or use defaults
 * @param configPath - Path to config file (optional - returns defaults if file doesn't exist)
 * @param basePath - Base path for resolving articlesDir (used when config file doesn't exist)
 */
export async function loadConfig(configPath?: string, basePath?: string): Promise<IntercomConfig> {
  let config: Partial<IntercomConfig> = {};

  // Try to load config file if path provided
  if (configPath && await exists(configPath)) {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content) as Partial<IntercomConfig>;
  }

  // Apply defaults
  const defaultArticlesDir = basePath || path.join(process.cwd(), 'help-docs');

  const finalConfig: IntercomConfig = {
    intercomAccessToken: config.intercomAccessToken || 'env:INTERCOM_ACCESS_TOKEN',
    articlesDir: config.articlesDir || defaultArticlesDir,
    defaultLocale: config.defaultLocale,
    supportedLocales: config.supportedLocales,
  };

  // Replace env: prefix with actual environment variable
  if (finalConfig.intercomAccessToken.startsWith('env:')) {
    const envVar = finalConfig.intercomAccessToken.slice(4);
    finalConfig.intercomAccessToken = process.env[envVar] || '';

    if (!finalConfig.intercomAccessToken) {
      throw new Error(`Environment variable ${envVar} is not set. Set it with: export ${envVar}=your_token`);
    }
  }

  return finalConfig;
}
