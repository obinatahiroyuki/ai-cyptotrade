# 本番環境移行ガイド

本番運用に移行するための手順をまとめています。

- **GitHub + Vercel + Turso で運用** → `doc/github-vercel-turso-guide.md`（手順を1本にまとめたガイド）
- **サーバーでダッシュボード + ワーカーを一括稼働** → `doc/server-deploy.md`

---

## アーキテクチャ概要

| コンポーネント | 本番環境 | 備考 |
|----------------|----------|------|
| **ダッシュボード（Next.js）** | Vercel | UI・API・認証・設定画面 |
| **ワーカー（Discord Bot + 価格監視）** | VPS / AWS / Railway 等 | 24/7 常駐プロセス（Vercel では不可） |
| **データベース** | Turso | 東京リージョン推奨 |

---

## Phase 1: セキュリティ準備（必須）

本番用のシークレットは**開発時と別の値**を使用してください。

### 1.1 Turso 認証トークンの再発行

```bash
turso db tokens create ai-cyptotrade
```

発行したトークンを控え、開発時使用分は無効化を検討。

### 1.2 本番用シークレットの生成

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY（32文字以上）
openssl rand -base64 32
```

### 1.3 GitHub OAuth App の本番用作成

1. https://github.com/settings/developers → New OAuth App
2. **Application name**: `ai-cyptotrade (Production)`
3. **Homepage URL**: `https://あなたのドメイン.vercel.app`
4. **Authorization callback URL**: `https://あなたのドメイン.vercel.app/api/auth/callback/github`
5. Client ID と Client Secret を控える

### 1.4 取引所 API キーの再発行

Bitget で本番用に新規 API キーを発行し、開発時使用分は無効化。

---

## Phase 2: Vercel デプロイ（ダッシュボード）

### 2.1 プロジェクトを Vercel にインポート

1. https://vercel.com にログイン
2. Add New → Project
3. Import Git Repository で `ai-cyptotrade` を選択

### 2.2 環境変数の設定

Settings → Environment Variables で以下を追加（Production にチェック）:

| 名前 | 値 | 備考 |
|------|-----|------|
| `TURSO_DATABASE_URL` | `libsql://xxx.turso.io` | Turso の接続 URL |
| `TURSO_AUTH_TOKEN` | （再発行したトークン） | 本番用 |
| `NEXTAUTH_SECRET` | （openssl rand -base64 32） | 本番用 |
| `NEXTAUTH_URL` | `https://あなたのドメイン.vercel.app` | デプロイ後に確定 |
| `GITHUB_ID` | 本番 OAuth App の Client ID | |
| `GITHUB_SECRET` | 本番 OAuth App の Client Secret | |
| `ENCRYPTION_KEY` | （openssl rand -base64 32） | 本番用、32文字以上 |

### 2.3 デプロイ

Deploy をクリック。初回デプロイ後、`NEXTAUTH_URL` を実際の URL に更新し、再デプロイ。

### 2.4 カスタムドメイン（任意）

Settings → Domains で独自ドメインを設定可能。

---

## Phase 3: ワーカーの本番デプロイ

ワーカーは Vercel では動作しません。VPS・AWS・Railway・Render 等で常駐プロセスとして稼働させます。

### 3.1 推奨プラットフォーム

| プラットフォーム | 特徴 | 目安コスト |
|------------------|------|------------|
| **Railway** | 簡単、Node.js 対応 | 無料枠あり |
| **Render** | 無料枠あり、Cron も可 | 無料枠あり |
| **AWS EC2 / Lightsail** | 柔軟、24/7 安定 | 月 $5〜 |
| **さくらのVPS** | 国内、低レイテンシ | 月 500円〜 |

### 3.2 ワーカーの起動方法

```bash
# 環境変数を設定した上で
npm run worker
```

### 3.3 ワーカー用環境変数

| 名前 | 値 |
|------|-----|
| `TURSO_DATABASE_URL` | Vercel と同じ |
| `TURSO_AUTH_TOKEN` | Vercel と同じ |
| `ENCRYPTION_KEY` | Vercel と同じ（APIキー復号に必須） |
| `DISCORD_BOT_TOKEN` | Discord Bot トークン |
| `DISCORD_CHANNEL_IDS` | 監視対象チャンネル ID（最大10件、カンマ区切り） |
| `ANTHROPIC_API_KEY` | Claude API キー |

### 3.4 Docker での稼働（任意）

```bash
docker build -f Dockerfile.worker -t ai-cyptotrade-worker .
docker run -d --name worker --env-file .env.production --restart unless-stopped ai-cyptotrade-worker
```

`.env.production` は `.env.production.example` を参考に作成。

### 3.5 systemd での常駐化（VPS の場合）

`/etc/systemd/system/ai-cyptotrade-worker.service`:

```ini
[Unit]
Description=ai-cyptotrade Worker
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/ai-cyptotrade
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=10
EnvironmentFile=/home/deploy/ai-cyptotrade/.env.production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ai-cyptotrade-worker
sudo systemctl start ai-cyptotrade-worker
```

---

## Phase 4: 動作確認

### 4.1 ダッシュボード

- `https://あなたのドメイン.vercel.app/` → ログインページ
- GitHub でログイン → ダッシュボード表示
- 設定 → 取引所連携 で Bitget API キーを登録
- 設定 → 投資設定 で自動売買 ON/OFF を確認

### 4.2 ワーカー

- ワーカー起動後、Discord にテストメッセージを投稿
- シグナル一覧に反映されるか確認
- 価格監視が 30 秒間隔で動作しているか確認

### 4.3 少額テスト

Bitget スポットはテストネット非対応のため、本番口座で **$2 程度の少額** で動作検証を推奨。

---

## チェックリスト

- [ ] Turso トークン再発行
- [ ] NEXTAUTH_SECRET 本番用生成
- [ ] ENCRYPTION_KEY 本番用生成
- [ ] GitHub OAuth App 本番用作成（コールバック URL 本番ドメイン）
- [ ] 取引所 API キー本番用再発行
- [ ] Vercel 環境変数設定
- [ ] Vercel デプロイ成功
- [ ] NEXTAUTH_URL を本番 URL に設定
- [ ] ワーカー稼働環境の準備（VPS 等）
- [ ] ワーカー用環境変数設定
- [ ] ワーカー 1 プロセスのみ起動
- [ ] 少額での動作検証
