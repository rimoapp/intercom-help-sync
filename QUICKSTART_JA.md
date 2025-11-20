# Intercom Docs Sync - Quick Start

このCLIツールは、IntercomのヘルプセンターとローカルのMarkdownファイルを同期するためのツールです。

## 🚀 すぐに始める

### 1. プロジェクトのセットアップ

```bash
cd intercom-help-sync
npm install
npm run build
```

### 2. 既存のリポジトリで使用する

既存のプロジェクトで使用する場合：

```bash
# パッケージをインストール（将来的にnpmに公開後）
npm install -D intercom-help-sync

# または、ローカルでリンク
cd /path/to/intercom-help-sync
npm link

cd /path/to/your-project
npm link intercom-help-sync
```

### 3. help-docsディレクトリを初期化

```bash
npx intercom-help-sync init
```

これにより以下の構造が作成されます：
```
your-project/
├── help-docs/
│   ├── articles/
│   │   ├── ja/
│   │   └── en/
│   ├── .intercom-config.json
│   └── README.md
```

### 4. Intercomのアクセストークンを設定

```bash
export INTERCOM_ACCESS_TOKEN=your_access_token_here
```

または `.env` ファイルに追加：
```
INTERCOM_ACCESS_TOKEN=your_access_token_here
```

### 5. 記事を同期

**Intercomから取得:**
```bash
npx intercom-help-sync pull
```

**ローカルの変更をIntercomに反映:**
```bash
npx intercom-help-sync push
```

## 📁 ファイル構造

### プロジェクト構成
```
intercom-help-sync/
├── src/                    # TypeScriptソースコード
│   ├── sync/              # 同期ロジック
│   │   ├── intercom-client.ts
│   │   ├── sync-from-intercom.ts
│   │   └── sync-to-intercom.ts
│   ├── utils/             # ユーティリティ
│   │   ├── markdown.ts
│   │   └── file-manager.ts
│   ├── types.ts           # 型定義
│   └── cli.ts             # CLIエントリーポイント
├── examples/              # サンプルファイル
├── dist/                  # ビルド済みファイル
├── package.json
├── tsconfig.json
├── README.md             # 英語ドキュメント
├── USAGE.md             # 詳細な使用例
└── CHANGELOG.md         # 変更履歴
```

### 記事のフォーマット

Markdownファイルは以下の形式で保存されます：

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

記事の本文...
```

## 🔧 主な機能

- ✅ Intercomからローカルへの記事取得
- ✅ ローカルからIntercomへの記事更新
- ✅ 多言語対応（i18n）
- ✅ AIが読み書きしやすいMarkdown形式
- ✅ Front matterでメタデータ管理
- ✅ 双方向同期

## 📖 使用例

### CSチームのワークフロー

1. CSチームがIntercom UIで記事を更新
2. `npx intercom-help-sync pull` で変更を取得
3. Gitでバージョン管理

### AI活用のワークフロー

1. AIがローカルのMarkdownファイルを読み込み
2. コード変更に応じてAIが内容を更新
3. `npx intercom-help-sync push` でIntercomに反映

### 翻訳ワークフロー

1. デフォルト言語（ja）で記事を作成
2. 他言語（en）で翻訳を作成
3. Front matterの`translations`で紐付け
4. 両方のファイルをプッシュ

## 🛠️ コマンド一覧

```bash
# 全記事を取得
npx intercom-help-sync pull

# 特定の記事を取得
npx intercom-help-sync pull --article-id 123456

# 全記事をプッシュ
npx intercom-help-sync push

# 特定のファイルをプッシュ
npx intercom-help-sync push --file articles/ja/getting-started/quick-start.md

# help-docsディレクトリを初期化
npx intercom-help-sync init

# カスタム設定ファイルを使用
npx intercom-help-sync pull --config path/to/config.json
```

## 🔑 Intercomアクセストークンの取得方法

1. Intercom Settings > Developers > Developer Hub にアクセス
2. 新しいアプリを作成または既存のアプリを使用
3. "Articles" の読み書き権限を追加
4. アクセストークンをコピー

## 📚 詳細ドキュメント

- `README.md` - 基本的な使い方
- `USAGE.md` - 詳細な使用例とワークフロー
- `examples/` - サンプルファイル

## 🐛 トラブルシューティング

### 環境変数が設定されていないエラー
```bash
export INTERCOM_ACCESS_TOKEN=your_token_here
```

### 記事が同期されない
- Front matterの`intercom_id`がIntercomの実際の記事IDと一致しているか確認

### 翻訳がリンクされない
- `translations`フィールドの相対パスが正しいか確認
- 例: `en/getting-started/quick-start.md`（`./`は不要）

## 📝 ライセンス

MIT

## 👤 作者

Naoyoshi
