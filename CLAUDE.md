# CLAUDE.md

## Project Overview

CLI tool to sync Intercom Help Center articles with local Markdown files.

## Commands

- `pull` - Pull articles from Intercom and convert HTML to Markdown
- `push <files...>` - Convert Markdown to HTML and push to Intercom

## Development

### Build
```bash
npm run build
```

### Test
```bash
npm test
```

### Local testing without publishing
```bash
node /path/to/intercom-help-sync/dist/cli.js pull
```

## Releasing

Use `npm version` to bump version, then push with tags, create a GitHub release, and publish to npm:

```bash
# 1. Bump version (creates commit + tag automatically)
npm version patch   # 0.3.0 → 0.3.1
npm version minor   # 0.3.0 → 0.4.0
npm version major   # 0.3.0 → 1.0.0

# 2. Push with tags
git push origin main --tags

# 3. Create GitHub release with notes
gh release create v0.4.0 --title "v0.4.0" --notes "## Changes
- Feature 1
- Feature 2
"

# Or auto-generate notes from commits
gh release create v0.4.0 --generate-notes

# 4. Publish to npm
npm publish
```
