# システム起動ガイド

このドキュメントでは、ai-cyptotrade システムをローカルで動かすための手順を説明します。


## 1. 前提条件

- Node.js 18 以上
- npm または yarn
- Turso CLI（データベース用）
- GitHub アカウント（認証用）

## 2. 依存関係のインストール

```bash
npm install
```

## 3. 環境変数の設定

プロジェクトルートに `.env.local` を作成し、以下の変数を設定してください。

### 必須（ダッシュボード + ワーカー）

| 変数名 | 説明 | 取得方法 |
|--------|------|----------|
| `TURSO_DATABASE_URL` | Turso DB 接続URL | `turso db show ai-cyptotrade` で確認 |
| `TURSO_AUTH_TOKEN` | Turso 認証トークン | `turso db tokens create ai-cyptotrade` で発行 |
| `NEXTAUTH_SECRET` | NextAuth セッション暗号化 | `openssl rand -base64 32` で生成 |
| `GITHUB_ID` | GitHub OAuth Client ID | [GitHub OAuth App](https://github.com/settings/developers) で作成 |
| `GITHUB_SECRET` | GitHub OAuth Client Secret | 同上 |
| `ENCRYPTION_KEY` | APIキー暗号化用（32文字以上） | `openssl rand -base64 32` で生成 |

### ワーカー専用（Discord シグナル連動・自動売買を使う場合）

| 変数名 | 説明 | 取得方法 |
|--------|------|----------|
| `DISCORD_BOT_TOKEN` | Discord Bot トークン | [Discord Developer Portal](https://discord.com/developers/applications) で作成 |
| `DISCORD_CHANNEL_IDS` | 監視対象チャンネル ID（最大10件、カンマ区切り） | Discord でチャンネルを右クリック→IDをコピー。単一の場合は `DISCORD_CHANNEL_ID` も可 |
| `ANTHROPIC_API_KEY` | Claude API キー | [Anthropic Console](https://console.anthropic.com/) で取得 |

### .env.local の例（最小構成：ダッシュボードのみ）

```env
TURSO_DATABASE_URL=libsql://ai-cyptotrade-xxx.turso.io
TURSO_AUTH_TOKEN=your-turso-token
NEXTAUTH_SECRET=your-32-char-secret
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret
ENCRYPTION_KEY=your-32-char-encryption-key
```

## 4. Turso データベースのセットアップ

### 4.1 Turso が未セットアップの場合

```bash
# Turso CLI のインストール（未導入時）
brew install tursodatabase/tap/turso

# ログイン
turso auth login

# データベース作成（東京リージョン推奨）
turso db create ai-cyptotrade --region nrt
```

### 4.2 マイグレーションの実行

```bash
# 順番に実行（001 → 002 → 003 → 004 → 005）
turso db shell ai-cyptotrade < db/migrations/001_initial.sql
turso db shell ai-cyptotrade < db/migrations/002_add_bitget_passphrase.sql
turso db shell ai-cyptotrade < db/migrations/003_risk_settings.sql
turso db shell ai-cyptotrade < db/migrations/004_discord_signals.sql
turso db shell ai-cyptotrade < db/migrations/005_investment_settings_v2.sql
```

## 5. システムの起動

### パターン A: ダッシュボードのみ（UI・設定・取引所連携）

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセス。GitHub でログイン後、ダッシュボードが表示されます。

### パターン B: ダッシュボード + ワーカー（Discord シグナル連動・自動売買）

**ターミナル 1**（ダッシュボード）:
```bash
npm run dev
```

**ターミナル 2**（ワーカー）:
```bash
npm run worker
```

ワーカーは `.env.local` から環境変数を読み込み、Discord のメッセージ監視と価格監視（30秒間隔）を実行します。

> **注意**: ワーカーは **1プロセスのみ** 起動してください。複数起動すると同一メッセージを重複処理します。

## 6. 初回セットアップ後の作業

1. **GitHub OAuth App** の作成  
   - `doc/auth-setup.md` を参照
   - コールバック URL: `http://localhost:3000/api/auth/callback/github`

2. **取引所連携**（Bitget を使う場合）  
   - ログイン後、設定 → 取引所連携 から API キーを登録
   - `doc/bitget-setup.md` があれば参照

3. **投資設定**  
   - 設定 → 投資設定 で初期投資額・利確モード等を設定
   - 自動売買を ON にする場合は、ワーカーが起動している必要があります

## 7. トラブルシューティング

### ログイン時に 404 になる
- GitHub OAuth App のコールバック URL が `http://localhost:3000/api/auth/callback/github` になっているか確認
- `.env.local` に `NEXTAUTH_URL=http://localhost:3000` を追加して再起動

### TURSO_DATABASE_URL エラー
- Turso にログイン済みか確認: `turso auth whoami`
- データベースが存在するか確認: `turso db list`

### ワーカーが起動しない
- `.env.local` に `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_IDS`（または `DISCORD_CHANNEL_ID`）, `ANTHROPIC_API_KEY` が設定されているか確認
- ダッシュボードのみ使う場合は、ワーカーは不要です
