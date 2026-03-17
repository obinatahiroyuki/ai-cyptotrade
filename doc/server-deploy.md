# サーバーでの稼働ガイド

サーバー（VPS・クラウド）でシステムを動かす手順です。

---

## 構成パターン

### パターン A: 分離構成（推奨）

| コンポーネント | 稼働場所 |
|----------------|----------|
| ダッシュボード | Vercel（無料枠あり） |
| ワーカー | サーバー（VPS 等） |

→ `doc/production-setup.md` を参照

### パターン B: サーバー統合構成

| コンポーネント | 稼働場所 |
|----------------|----------|
| ダッシュボード + ワーカー | 同一サーバー |

→ 本ドキュメントの手順を使用

---

## パターン B: サーバー統合デプロイ

### 前提条件

- Ubuntu 22.04 等の Linux サーバー
- Node.js 20 以上
- ドメイン（任意、IP のみでも可）

---

### Step 1: サーバーにコードを配置

```bash
# サーバーに SSH 接続後
cd /home/ubuntu  # または任意のディレクトリ
git clone https://github.com/あなたのユーザー名/ai-cyptotrade.git
cd ai-cyptotrade
npm install
```

---

### Step 2: 環境変数の設定

```bash
cp .env.example .env.production
nano .env.production  # または vi
```

以下を設定:

```env
TURSO_DATABASE_URL=libsql://xxx.turso.io
TURSO_AUTH_TOKEN=あなたのトークン
NEXTAUTH_SECRET=openssl rand -base64 32 で生成
NEXTAUTH_URL=https://あなたのドメイン  # または http://サーバーIP:3000
GITHUB_ID=GitHub OAuth Client ID
GITHUB_SECRET=GitHub OAuth Client Secret
ENCRYPTION_KEY=openssl rand -base64 32 で生成
DISCORD_BOT_TOKEN=Discord Bot トークン
DISCORD_CHANNEL_IDS=チャンネルID1,チャンネルID2
ANTHROPIC_API_KEY=Claude API キー
```

---

### Step 3: ダッシュボードのビルド・起動

```bash
npm run build
npm run start
```

ポート 3000 で起動。バックグラウンドで動かす場合は PM2 を使用（Step 5）。

---

### Step 4: ワーカーの起動

別ターミナルで:

```bash
cd /home/ubuntu/ai-cyptotrade
npm run worker
```

---

### Step 5: PM2 で常駐化（推奨）

```bash
# PM2 インストール
npm install -g pm2

# ダッシュボード起動
pm2 start npm --name "ai-cyptotrade-web" -- start

# ワーカー起動（別プロセス）
pm2 start npm --name "ai-cyptotrade-worker" -- run worker

# 起動時に自動起動
pm2 save
pm2 startup
```

---

### Step 6: リバースプロキシ（Nginx、任意）

ドメインでアクセスする場合:

```nginx
server {
    listen 80;
    server_name あなたのドメイン;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Docker Compose で一括起動

ダッシュボードとワーカーを同時に起動:

```bash
# .env.production を用意してから
docker-compose up -d

# ログ確認
docker-compose logs -f
```

---

## クイックスタート（サーバー初回セットアップ）

```bash
git clone https://github.com/あなたのユーザー名/ai-cyptotrade.git
cd ai-cyptotrade
cp .env.production.example .env.production
# .env.production を編集
docker-compose up -d
```

---

## 注意事項

- **ワーカーは 1 プロセスのみ**起動すること（重複起動で重複処理のリスク）
- GitHub OAuth のコールバック URL を本番 URL に設定すること
- ファイアウォールで 3000 番ポートを開放すること（Nginx 使用時は 80/443）
