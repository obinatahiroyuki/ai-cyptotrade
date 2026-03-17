# GitHub + Vercel + Turso 運用ガイド

この 3 つでシステムを運用する手順です。

---

## 構成図

```
GitHub（コード） → Vercel（ダッシュボード） ←→ Turso（DB）
                         ↑
                   ワーカーは別途必要
                   （Railway / Render 等）
```

**注意**: ワーカー（Discord 監視・価格監視）は Vercel では動きません。**Discord シグナル連動・自動売買を使う場合**は、ワーカーを Railway / Render 等で別途稼働させる必要があります。

---

## Step 1: Turso のセットアップ

### 1.1 Turso CLI のインストール

```bash
# macOS
brew install tursodatabase/tap/turso

# ログイン
turso auth login
```

### 1.2 データベース作成

```bash
turso db create ai-cyptotrade --region nrt
```

### 1.3 接続情報の取得

```bash
# URL
turso db show ai-cyptotrade

# トークン（本番用に再発行推奨）
turso db tokens create ai-cyptotrade
```

### 1.4 マイグレーション

```bash
turso db shell ai-cyptotrade < db/migrations/001_initial.sql
turso db shell ai-cyptotrade < db/migrations/002_add_bitget_passphrase.sql
turso db shell ai-cyptotrade < db/migrations/003_risk_settings.sql
turso db shell ai-cyptotrade < db/migrations/004_discord_signals.sql
turso db shell ai-cyptotrade < db/migrations/005_investment_settings_v2.sql
```

---

## Step 2: GitHub にプッシュ

### 2.1 リポジトリ作成

1. https://github.com/new にアクセス
2. リポジトリ名: `ai-cyptotrade`
3. Public を選択
4. 「Create repository」をクリック

### 2.2 プッシュ

```bash
cd /path/to/ai-cyptotrade
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/ai-cyptotrade.git
git push -u origin main
```

---

## Step 3: シークレットの準備

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY
openssl rand -base64 32
```

### GitHub OAuth App の作成

1. https://github.com/settings/developers → New OAuth App
2. **Application name**: `ai-cyptotrade`
3. **Homepage URL**: `https://あなたのプロジェクト.vercel.app`（後で設定）
4. **Authorization callback URL**: `https://あなたのプロジェクト.vercel.app/api/auth/callback/github`
5. Client ID と Client Secret を控える

---

## Step 4: Vercel でデプロイ

### 4.1 プロジェクトをインポート

1. https://vercel.com にログイン
2. 「Add New...」→「Project」
3. 「Import Git Repository」で `ai-cyptotrade` を選択
4. 「Import」をクリック

### 4.2 環境変数を設定

「Environment Variables」で以下を追加（**Production** にチェック）:

| 名前 | 値 |
|------|-----|
| `TURSO_DATABASE_URL` | `libsql://ai-cyptotrade-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso で発行したトークン |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成 |
| `NEXTAUTH_URL` | `https://あなたのプロジェクト.vercel.app` |
| `GITHUB_ID` | GitHub OAuth の Client ID |
| `GITHUB_SECRET` | GitHub OAuth の Client Secret |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` で生成 |

### 4.3 デプロイ

「Deploy」をクリック。数分で完了します。

### 4.4 NEXTAUTH_URL の更新

デプロイ後、表示された URL に合わせて `NEXTAUTH_URL` を更新し、再デプロイ。

---

## Step 5: 動作確認

- `https://あなたのプロジェクト.vercel.app/` → ログインページ
- GitHub でログイン → ダッシュボード表示
- 設定 → 取引所連携 で Bitget API キーを登録

---

## ワーカー（Discord シグナル連動）を使う場合

ワーカーは **Railway** または **Render** で稼働させます。

### Railway の場合

1. https://railway.app にログイン
2. New Project → Deploy from GitHub repo → `ai-cyptotrade` を選択
3. **Root Directory** を空のまま
4. **Build Command**: `npm install`
5. **Start Command**: `npm run worker`
6. Variables で環境変数を設定（TURSO_*, ENCRYPTION_KEY, DISCORD_*, ANTHROPIC_API_KEY）

### Render の場合

1. https://render.com にログイン
2. New → Background Worker
3. Connect GitHub → `ai-cyptotrade` を選択
4. **Build Command**: `npm install`
5. **Start Command**: `npm run worker`
6. Environment で環境変数を設定

---

## まとめチェックリスト

- [ ] Turso で DB 作成・マイグレーション
- [ ] GitHub にリポジトリ作成・プッシュ
- [ ] GitHub OAuth App 作成（コールバック URL を Vercel の URL に）
- [ ] Vercel でプロジェクトをインポート
- [ ] 環境変数を設定
- [ ] デプロイ成功
- [ ] （Discord 連動を使う場合）ワーカーを Railway / Render でデプロイ
