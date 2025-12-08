/**
 * Markdown to HTML converter for Intercom articles
 * Based on docs/design/html-markdown-conversion.md
 */

import { restoreImageSignatures } from './markdown';

// Callout color mapping (color name -> background + border colors)
const CALLOUT_STYLES: Record<string, { bg: string; border: string }> = {
  gray: { bg: '#e8e8e880', border: '#73737633' },
  blue: { bg: '#e3e7fa80', border: '#334bfa33' },
  green: { bg: '#d7efdc80', border: '#1bb15733' },
  red: { bg: '#fed9db80', border: '#fd3a5733' },
  yellow: { bg: '#feedaf80', border: '#fbc91633' },
};

/**
 * Convert Markdown to Intercom HTML
 * @param markdown - The markdown content
 * @param originalHtml - Optional original HTML to restore image signatures from
 */
export function markdownToHtml(markdown: string, originalHtml?: string): string {
  let result = markdown;

  // Process block-level elements first, then inline elements

  // 1. Handle callouts (```callout-color)
  result = convertCalloutBlocks(result);

  // 2. Handle code blocks (```)
  result = convertCodeBlocksToHtml(result);

  // 3. Handle headings with alignment
  result = convertHeadingsToHtml(result);

  // 4. Handle images with alignment
  result = convertImagesToHtml(result);

  // 5. Handle tables
  result = convertTablesToHtml(result);

  // 6. Handle horizontal rules
  result = result.replace(/^---$/gm, '<hr>');

  // 7. Handle lists
  result = convertListsToHtml(result);

  // 8. Handle paragraphs BEFORE inline formatting
  // so that plain text lines get wrapped in <p> tags first
  result = convertParagraphsToHtml(result);

  // 9. Handle links (do before inline formatting to preserve link structure)
  result = convertLinksToHtml(result);

  // 10. Handle inline formatting
  result = convertInlineFormattingToHtml(result);

  // 11. Handle line breaks
  result = result.replace(/  \n/g, '<br>');

  // 12. Clean up
  result = cleanupHtml(result);

  // 13. Restore image signatures if original HTML provided
  if (originalHtml) {
    result = restoreImageSignatures(result, originalHtml);
  }

  return result;
}

/**
 * Convert callout code blocks to HTML divs
 */
function convertCalloutBlocks(markdown: string): string {
  const calloutRegex = /```callout-(gray|blue|green|red|yellow)\n([\s\S]*?)```/g;

  return markdown.replace(calloutRegex, (match, color, content) => {
    const style = CALLOUT_STYLES[color] || CALLOUT_STYLES.gray;
    // Convert inner content to HTML
    let innerContent = content.trim();
    innerContent = convertInlineFormattingToHtml(innerContent);
    // Wrap in paragraph
    innerContent = `<p class="no-margin">${innerContent}</p>`;

    return `<div class="intercom-interblocks-callout" style="background-color: ${style.bg}; border-color: ${style.border};">${innerContent}</div>`;
  });
}

/**
 * Convert code blocks to pre/code HTML
 */
function convertCodeBlocksToHtml(markdown: string): string {
  // Match code blocks that are NOT callouts
  const codeBlockRegex = /```(?!callout-)(\w*)\n([\s\S]*?)```/g;

  return markdown.replace(codeBlockRegex, (match, lang, content) => {
    // Encode HTML entities
    const encoded = encodeHtmlEntities(content.trim());
    return `<pre><code>${encoded}</code></pre>`;
  });
}

/**
 * Convert headings to HTML
 */
function convertHeadingsToHtml(markdown: string): string {
  // Handle headings with alignment comment
  const alignedHeadingRegex = /<!-- align:(center|right|justify) -->(#{1,4}) (.+)$/gm;
  markdown = markdown.replace(alignedHeadingRegex, (match, align, hashes, content) => {
    const level = hashes.length;
    return `<h${level} class="intercom-align-${align}">${content.trim()}</h${level}>`;
  });

  // Handle regular headings (h1-h4)
  for (let level = 4; level >= 1; level--) {
    const regex = new RegExp(`^${'#'.repeat(level)} (.+)$`, 'gm');
    markdown = markdown.replace(regex, (match, content) => {
      return `<h${level}>${content.trim()}</h${level}>`;
    });
  }

  return markdown;
}

/**
 * Convert Markdown tables to Intercom HTML tables
 */
function convertTablesToHtml(markdown: string): string {
  // Match markdown tables (header row, separator row, optional data rows)
  // Use [ \t]* instead of \s* to avoid matching newlines
  // Allow last row to not have trailing newline
  const tableRegex = /^\|(.+)\|[ \t]*\n\|[\s\-:|]+\|[ \t]*(?:\n|$)((?:\|.+\|[ \t]*(?:\n|$))*)/gm;

  return markdown.replace(tableRegex, (match, headerRow, bodyRows) => {
    // Parse header cells
    const headerCells = headerRow.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);

    // Parse body rows
    const rows: string[][] = [];
    if (bodyRows && bodyRows.trim()) {
      const bodyLines = bodyRows.trim().split('\n');
      for (const line of bodyLines) {
        const cells = line.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell);
        if (cells.length > 0) {
          rows.push(cells);
        }
      }
    }

    // Build HTML table
    let html = '<div class="intercom-interblocks-table-container"><table role="presentation"><tbody>';

    // Header row
    html += '<tr>';
    for (const cell of headerCells) {
      html += `<td><p class="no-margin">${cell}</p></td>`;
    }
    html += '</tr>';

    // Data rows
    for (const row of rows) {
      html += '<tr>';
      for (let i = 0; i < headerCells.length; i++) {
        const cell = row[i] || '';
        html += `<td><p class="no-margin">${cell}</p></td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';

    return html;
  });
}

/**
 * Convert images to HTML with containers
 */
function convertImagesToHtml(markdown: string): string {
  // Handle images with alignment comment
  const alignedImageRegex = /<!-- align:center -->!\[([^\]]*)\]\(([^)]+)\)/g;
  markdown = markdown.replace(alignedImageRegex, (match, alt, src) => {
    const altAttr = alt ? ` alt="${alt}"` : '';
    return `<div class="intercom-container intercom-align-center"><img src="${src}"${altAttr}></div>`;
  });

  // Handle regular images
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  markdown = markdown.replace(imageRegex, (match, alt, src) => {
    const altAttr = alt ? ` alt="${alt}"` : '';
    return `<div class="intercom-container"><img src="${src}"${altAttr}></div>`;
  });

  return markdown;
}

/**
 * Convert lists to HTML
 */
function convertListsToHtml(markdown: string): string {
  // Convert unordered lists
  const ulRegex = /(?:^- .+$\n?)+/gm;
  markdown = markdown.replace(ulRegex, (match) => {
    const items = match.trim().split('\n').map(line => {
      const content = line.replace(/^- /, '').trim();
      return `<li><p class="no-margin">${content}</p></li>`;
    });
    return `<ul>${items.join('')}</ul>`;
  });

  // Convert ordered lists
  const olRegex = /(?:^\d+\. .+$\n?)+/gm;
  markdown = markdown.replace(olRegex, (match) => {
    const items = match.trim().split('\n').map(line => {
      const content = line.replace(/^\d+\. /, '').trim();
      return `<li><p class="no-margin">${content}</p></li>`;
    });
    return `<ol>${items.join('')}</ol>`;
  });

  return markdown;
}

/**
 * Convert links to HTML
 */
function convertLinksToHtml(markdown: string): string {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  return markdown.replace(linkRegex, (match, text, href) => {
    return `<a href="${href}" target="_blank" class="intercom-content-link">${text}</a>`;
  });
}

/**
 * Convert inline formatting to HTML
 */
function convertInlineFormattingToHtml(markdown: string): string {
  // Handle bold+italic (***text***)
  markdown = markdown.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');

  // Handle bold (**text**)
  markdown = markdown.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  // Handle italic (*text*)
  markdown = markdown.replace(/\*(.+?)\*/g, '<i>$1</i>');

  // Handle inline code (`text`)
  markdown = markdown.replace(/`([^`]+)`/g, '<code>$1</code>');

  return markdown;
}

/**
 * Convert paragraphs to HTML
 */
function convertParagraphsToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip if already HTML tag (starts with < but not a comment)
    if (trimmed.startsWith('<') && !trimmed.startsWith('<!--')) {
      result.push(trimmed);
      continue;
    }

    // Handle alignment comments
    const alignMatch = trimmed.match(/^<!-- align:(center|right|justify) -->(.+)$/s);
    if (alignMatch) {
      const [, align, content] = alignMatch;
      result.push(`<p class="intercom-align-${align} no-margin">${content.trim()}</p>`);
    } else {
      // Regular paragraph - wrap plain text in p tags
      result.push(`<p class="no-margin">${trimmed}</p>`);
    }
  }

  return result.join('');
}

/**
 * Encode HTML entities
 */
function encodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Clean up HTML output
 */
function cleanupHtml(html: string): string {
  // Remove extra whitespace between tags
  html = html.replace(/>\s+</g, '><');

  // Remove empty paragraphs
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html.trim();
}
