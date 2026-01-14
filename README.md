# intercom-help-sync

CLI tool to sync Intercom Help Center articles with local markdown files, enabling AI-powered documentation management and i18n workflows.

## Features

- 📥 **Pull articles** from Intercom to local markdown files
- 📤 **Push local changes** back to Intercom
- 🌍 **i18n support** with translations management
- 🤖 **AI-friendly** markdown format with front matter metadata
- 🔄 **Bidirectional sync** between Intercom and local files

## Installation

```bash
npm install -D intercom-help-sync
```

## Quick Start

### 1. Set your Intercom access token

```bash
export INTERCOM_ACCESS_TOKEN=your_access_token_here
```

### 2. Sync articles

Pull all articles from Intercom:

```bash
npx intercom-help-sync pull
```

Push a file to Intercom:

```bash
npx intercom-help-sync push help-docs/ja/getting-started/quick-start.md
```

## Usage

### Pull Commands

Pull all articles:
```bash
npx intercom-help-sync pull
```

Pull specific article:
```bash
npx intercom-help-sync pull --article-id 123456
```

Use custom config:
```bash
npx intercom-help-sync pull --config path/to/config.json
```

### Push Commands

Push a single file:
```bash
npx intercom-help-sync push help-docs/ja/getting-started/quick-start.md
```

Push multiple files:
```bash
npx intercom-help-sync push help-docs/ja/file1.md help-docs/ja/file2.md
```

Dry run (show diff without pushing):
```bash
npx intercom-help-sync push help-docs/ja/quick-start.md --dry-run
```

## Article Format

Articles are stored as markdown files with YAML front matter:

```markdown
---
intercom_id: "123456"
intercom_collection_id: "getting-started"
locale: "ja"
translations:
  en: "en/getting-started/quick-start.md"
updated_at: "2024-11-19T10:00:00Z"
status: "published"
title: "クイックスタート"
author_id: 12345
---

# クイックスタート

本文はここに書きます...
```

### Front Matter Fields

- `intercom_id`: Intercom article ID (auto-generated on first push)
- `intercom_collection_id`: Collection/category ID
- `locale`: Language code (ja, en, etc.)
- `translations`: Map of locale to file path for translations
- `updated_at`: Last update timestamp
- `status`: `published` or `draft`
- `title`: Article title
- `author_id`: Intercom author ID

## Workflow Examples

### CS Team Workflow

1. CS team updates articles in Intercom UI
2. Run `npx intercom-help-sync pull` to sync changes locally
3. Commit to git for version control

### AI-Powered Updates

1. AI reads local markdown files
2. AI modifies content based on code changes
3. Run `npx intercom-help-sync push <path>` to update Intercom

### i18n Workflow

1. Create article in default locale (ja)
2. Add translation in another locale (en)
3. Link via `translations` field in front matter
4. Push both files - they'll be synced as one article with translations

## Configuration (Optional)

Configuration file is optional. By default, the tool uses:
- `INTERCOM_ACCESS_TOKEN` environment variable
- `help-docs` as the articles directory
- Default locale is determined from articles (the one with `translations` field)
- All translations are synced

To customize, create `help-docs/.intercom-config.json`:

```json
{
  "articlesDir": "./custom-articles-path"
}
```

Available options:
- `intercomAccessToken`: Access token (use `env:VAR_NAME` for environment variables)
- `articlesDir`: Relative path to articles directory

## Getting Intercom Access Token

1. Go to Intercom Settings > Developers > Developer Hub
2. Create a new app or use existing one
3. Add "Articles" permissions (read & write)
4. Copy the access token

## License

MIT

## Author

Naoyoshi Aikawa @ Rimo, LLC.
