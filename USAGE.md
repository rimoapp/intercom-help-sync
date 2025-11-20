# Usage Guide

## Installation in Existing Repository

### 1. Install as Dev Dependency

In your existing repository:

```bash
npm install -D intercom-help-sync
```

Or with yarn:

```bash
yarn add -D intercom-help-sync
```

### 2. Initialize help-docs Directory

```bash
npx intercom-help-sync init
```

This creates:
```
your-repo/
├── help-docs/
│   ├── articles/
│   │   ├── ja/
│   │   └── en/
│   ├── .intercom-config.json
│   └── README.md
├── package.json
└── (other project files)
```

### 3. Configure Environment

Add to your `.env` file:

```env
INTERCOM_ACCESS_TOKEN=your_access_token_here
```

Or export in your shell:

```bash
export INTERCOM_ACCESS_TOKEN=your_access_token_here
```

### 4. Add Scripts to package.json (Optional)

```json
{
  "scripts": {
    "docs:pull": "intercom-help-sync pull",
    "docs:push": "intercom-help-sync push"
  }
}
```

## Workflow Examples

### CS Team Workflow

**Scenario**: CS team updates articles in Intercom UI, and you want to keep local files in sync.

1. CS team updates articles in Intercom
2. Pull changes to local repository:
   ```bash
   npm run docs:pull
   ```
3. Review changes:
   ```bash
   git diff help-docs/articles/
   ```
4. Commit to version control:
   ```bash
   git add help-docs/
   git commit -m "docs: sync from Intercom"
   git push
   ```

### AI-Powered Documentation Updates

**Scenario**: Your code changes require documentation updates, and you want AI to help.

1. AI reads current documentation:
   ```typescript
   import fs from 'fs/promises';

   const article = await fs.readFile(
     'help-docs/articles/ja/api/authentication.md',
     'utf-8'
   );
   ```

2. AI analyzes code changes and updates documentation:
   ```typescript
   // AI modifies the content based on code changes
   const updatedContent = aiGenerateDocumentation(codeChanges, article);

   await fs.writeFile(
     'help-docs/articles/ja/api/authentication.md',
     updatedContent
   );
   ```

3. Push changes to Intercom:
   ```bash
   npm run docs:push -- --file help-docs/articles/ja/api/authentication.md
   ```

### i18n Translation Workflow

**Scenario**: You have content in Japanese and want to add English translation.

1. Create Japanese article first (if not exists):
   ```markdown
   ---
   locale: "ja"
   intercom_collection_id: "api-reference"
   status: "published"
   title: "認証"
   ---

   # 認証

   APIを使用するには認証が必要です...
   ```

2. Create English translation:
   ```markdown
   ---
   locale: "en"
   intercom_collection_id: "api-reference"
   status: "published"
   title: "Authentication"
   ---

   # Authentication

   Authentication is required to use the API...
   ```

3. Link translations (update Japanese article):
   ```markdown
   ---
   locale: "ja"
   intercom_collection_id: "api-reference"
   translations:
     en: "en/api-reference/authentication.md"
   status: "published"
   title: "認証"
   ---
   ```

4. Push both files:
   ```bash
   npm run docs:push
   ```

### Scheduled Sync with CI/CD

**Scenario**: Automatically sync documentation on a schedule.

Create `.github/workflows/sync-docs.yml`:

```yaml
name: Sync Documentation

on:
  schedule:
    # Run every day at 9 AM JST
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Pull from Intercom
        env:
          INTERCOM_ACCESS_TOKEN: ${{ secrets.INTERCOM_ACCESS_TOKEN }}
        run: npx intercom-help-sync pull

      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add help-docs/
          git diff --quiet && git diff --staged --quiet || \
            git commit -m "docs: sync from Intercom [skip ci]"
          git push
```

## Advanced Configuration

### Custom Config Location

```bash
npx intercom-help-sync pull --config path/to/custom-config.json
```

### Multiple Locales

Update `.intercom-config.json`:

```json
{
  "intercomAccessToken": "env:INTERCOM_ACCESS_TOKEN",
  "articlesDir": "./articles",
  "defaultLocale": "ja",
  "supportedLocales": ["ja", "en", "fr", "de", "es"]
}
```

### Selective Sync

Sync only specific article:
```bash
npx intercom-help-sync pull --article-id 123456
```

Sync only specific file:
```bash
npx intercom-help-sync push --file help-docs/articles/ja/getting-started/quick-start.md
```

## Troubleshooting

### Issue: "Environment variable INTERCOM_ACCESS_TOKEN is not set"

**Solution**: Ensure you've set the environment variable:
```bash
export INTERCOM_ACCESS_TOKEN=your_token_here
```

### Issue: Articles not syncing

**Solution**: Check the `intercom_id` in front matter matches the actual article ID in Intercom.

### Issue: Translation not linking correctly

**Solution**: Ensure the `translations` field in front matter points to the correct relative path from the articles directory.

Example:
```yaml
translations:
  en: "en/getting-started/quick-start.md"  # Correct
  en: "./en/getting-started/quick-start.md"  # Incorrect
```

## Best Practices

1. **Always pull before push**: Avoid conflicts by syncing from Intercom first
   ```bash
   npm run docs:pull && npm run docs:push
   ```

2. **Use version control**: Commit documentation changes regularly

3. **Review AI changes**: Always review AI-generated updates before pushing

4. **Keep translations in sync**: When updating content, update all translations

5. **Use draft status**: Set `status: "draft"` in front matter for unpublished changes

6. **Organize by collections**: Use meaningful `intercom_collection_id` values

## Integration with Development Workflow

### Pre-commit Hook

Install husky and add a pre-commit hook:

```bash
npm install -D husky
npx husky install
```

Create `.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Pull latest docs before commit
npx intercom-help-sync pull --config help-docs/.intercom-config.json
git add help-docs/
```

### Post-merge Hook

Automatically push documentation updates after merging:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Push docs to Intercom after merge
npx intercom-help-sync push --config help-docs/.intercom-config.json
```
