/**
 * HTML to Markdown converter for Intercom articles
 * Based on docs/design/html-markdown-conversion.md
 */

import { stripImageSignatures } from './markdown';

// Callout color mapping (background color -> color name)
const CALLOUT_COLORS: Record<string, string> = {
  '#e8e8e880': 'gray',
  '#e8e8e8': 'gray',
  '#e3e7fa80': 'blue',
  '#d7efdc80': 'green',
  '#fed9db80': 'red',
  '#feedaf80': 'yellow',
};

/**
 * Convert Intercom HTML to Markdown
 */
export function htmlToMarkdown(html: string): string {
  // Handle empty/undefined input
  if (!html) {
    return '';
  }

  let result = html;

  // Strip image signatures first
  result = stripImageSignatures(result);

  // Process in order of specificity (more specific patterns first)

  // 1. Handle collapsible sections (keep as raw HTML)
  // Already raw HTML, no conversion needed

  // 2. Handle videos (keep as raw HTML)
  // Already raw HTML, no conversion needed

  // 3. Handle buttons (keep as raw HTML)
  // Already raw HTML, no conversion needed

  // 4. Handle tables - convert to Markdown tables
  result = convertTables(result);

  // 5. Handle callouts - convert to fenced code blocks
  result = convertCallouts(result);

  // 6. Handle code blocks
  result = convertCodeBlocks(result);

  // 7. Handle images
  result = convertImages(result);

  // 8. Handle horizontal rules
  result = result.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // 9. Handle headings (h1-h4)
  result = convertHeadings(result);

  // 10. Handle lists
  result = convertLists(result);

  // 11. Handle links
  result = convertLinks(result);

  // 12. Handle paragraphs with alignment
  result = convertParagraphs(result);

  // 13. Handle inline formatting
  result = convertInlineFormatting(result);

  // 14. Handle line breaks
  result = result.replace(/<br\s*\/?>/gi, '  \n');

  // 15. Clean up empty paragraphs and extra whitespace
  result = cleanupWhitespace(result);

  return result.trim();
}

/**
 * Convert HTML tables to Markdown tables
 */
function convertTables(html: string): string {
  const tableRegex = /<div\s+class="intercom-interblocks-table-container"[^>]*>\s*<table[^>]*>\s*<tbody>([\s\S]*?)<\/tbody>\s*<\/table>\s*<\/div>/gi;

  return html.replace(tableRegex, (match, tbodyContent) => {
    const rows: string[][] = [];

    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        let cellContent = cellMatch[1];
        // Remove p tags and clean up
        cellContent = cellContent.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1');
        cellContent = cellContent.trim();
        // Convert inline formatting
        cellContent = convertInlineFormatting(cellContent);
        cells.push(cellContent);
      }

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) {
      return match; // Return original if no rows found
    }

    // Determine column count
    const colCount = Math.max(...rows.map(row => row.length));

    // Build Markdown table
    const lines: string[] = [];

    // First row as header
    const headerRow = rows[0] || [];
    const headerCells = Array(colCount).fill('').map((_, i) => headerRow[i] || '');
    lines.push('| ' + headerCells.join(' | ') + ' |');

    // Separator row
    lines.push('| ' + Array(colCount).fill('---').join(' | ') + ' |');

    // Data rows
    for (let i = 1; i < rows.length; i++) {
      const dataCells = Array(colCount).fill('').map((_, j) => rows[i][j] || '');
      lines.push('| ' + dataCells.join(' | ') + ' |');
    }

    return '\n\n' + lines.join('\n') + '\n\n';
  });
}

/**
 * Convert callout divs to fenced code blocks
 */
function convertCallouts(html: string): string {
  const calloutRegex = /<div\s+class="intercom-interblocks-callout"[^>]*style="[^"]*background-color:\s*([^;]+);[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  return html.replace(calloutRegex, (match, bgColor, content) => {
    const colorName = CALLOUT_COLORS[bgColor.trim()] || 'gray';
    // Convert inner content to markdown
    let innerContent = content;
    // Remove wrapper p tags
    innerContent = innerContent.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n');
    // Convert inline formatting
    innerContent = convertInlineFormatting(innerContent);
    // Clean up
    innerContent = innerContent.trim();

    return `\n\n\`\`\`callout-${colorName}\n${innerContent}\n\`\`\`\n\n`;
  });
}

/**
 * Convert pre/code blocks to fenced code blocks
 */
function convertCodeBlocks(html: string): string {
  return html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, (match, content) => {
    // Decode HTML entities
    const decoded = decodeHtmlEntities(content);
    return `\n\n\`\`\`\n${decoded}\n\`\`\`\n\n`;
  });
}

/**
 * Convert image containers to markdown images
 */
function convertImages(html: string): string {
  // Handle images with alignment
  const alignedImageRegex = /<div\s+class="intercom-container\s+intercom-align-center"[^>]*>\s*<img\s+[^>]*src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>\s*<\/div>/gi;
  html = html.replace(alignedImageRegex, (match, src, alt) => {
    const altText = alt || '';
    return `\n\n<!-- align:center -->![${altText}](${src})\n\n`;
  });

  // Handle regular images in containers
  const imageRegex = /<div\s+class="intercom-container"[^>]*>\s*<img\s+[^>]*src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>\s*<\/div>/gi;
  html = html.replace(imageRegex, (match, src, alt) => {
    const altText = alt || '';
    return `\n\n![${altText}](${src})\n\n`;
  });

  // Handle standalone images (not in containers)
  const standaloneImageRegex = /<img\s+[^>]*src="([^"]*)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
  html = html.replace(standaloneImageRegex, (match, src, alt) => {
    const altText = alt || '';
    return `![${altText}](${src})`;
  });

  return html;
}

/**
 * Convert headings to markdown
 */
function convertHeadings(html: string): string {
  // Handle headings with alignment
  for (let level = 1; level <= 4; level++) {
    const alignedRegex = new RegExp(
      `<h${level}[^>]*class="[^"]*intercom-align-(center|right|justify)[^"]*"[^>]*>([\\s\\S]*?)<\\/h${level}>`,
      'gi'
    );
    html = html.replace(alignedRegex, (match, align, content) => {
      const cleanContent = stripHtmlTags(content).trim();
      const prefix = '#'.repeat(level);
      return `\n\n<!-- align:${align} -->${prefix} ${cleanContent}\n\n`;
    });

    // Handle regular headings
    const regex = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
    html = html.replace(regex, (match, content) => {
      const cleanContent = stripHtmlTags(content).trim();
      const prefix = '#'.repeat(level);
      return `\n\n${prefix} ${cleanContent}\n\n`;
    });
  }

  return html;
}

/**
 * Convert lists to markdown
 */
function convertLists(html: string): string {
  // Convert unordered lists
  html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    const items = extractListItems(content);
    return '\n\n' + items.map(item => `- ${item}`).join('\n') + '\n\n';
  });

  // Convert ordered lists
  html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    const items = extractListItems(content);
    return '\n\n' + items.map((item, index) => `${index + 1}. ${item}`).join('\n') + '\n\n';
  });

  return html;
}

/**
 * Extract list items from HTML list content
 */
function extractListItems(listContent: string): string[] {
  const items: string[] = [];
  const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = itemRegex.exec(listContent)) !== null) {
    let itemContent = match[1];
    // Remove p tags
    itemContent = itemContent.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1');
    // Convert inline formatting
    itemContent = convertInlineFormatting(itemContent);
    items.push(itemContent.trim());
  }

  return items;
}

/**
 * Convert links to markdown
 */
function convertLinks(html: string): string {
  return html.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
    // Convert any inline formatting in the link text
    const cleanText = convertInlineFormatting(text);
    return `[${stripHtmlTags(cleanText).trim()}](${href})`;
  });
}

/**
 * Convert paragraphs with alignment
 */
function convertParagraphs(html: string): string {
  // Handle paragraphs with alignment
  const alignedParagraphRegex = /<p\s+class="[^"]*intercom-align-(center|right|justify)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  html = html.replace(alignedParagraphRegex, (match, align, content) => {
    if (!content.trim()) return '\n';
    return `\n\n<!-- align:${align} -->${content.trim()}\n\n`;
  });

  // Handle regular paragraphs (with no-margin class)
  html = html.replace(/<p\s+class="no-margin"[^>]*>([\s\S]*?)<\/p>/gi, (match, content) => {
    if (!content.trim()) return '\n';
    return `\n\n${content.trim()}\n\n`;
  });

  // Handle any remaining paragraphs
  html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, content) => {
    if (!content.trim()) return '\n';
    return `\n\n${content.trim()}\n\n`;
  });

  return html;
}

/**
 * Convert inline formatting (bold, italic, code)
 */
function convertInlineFormatting(html: string): string {
  // Handle bold
  html = html.replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, '**$2**');

  // Handle italic
  html = html.replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Handle inline code
  html = html.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

  return html;
}

/**
 * Strip HTML tags from content
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(html: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return html.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Clean up extra whitespace
 */
function cleanupWhitespace(text: string): string {
  // Replace multiple newlines with double newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace from lines
  text = text.split('\n').map(line => line.trimEnd()).join('\n');

  return text;
}
