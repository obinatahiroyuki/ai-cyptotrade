# Railway でワーカーをデプロイする手順

Discord シグナル監視と価格監視を行うワーカーを Railway で 24 時間稼働させます。

---

## 前提条件

- [Discord Bot の作成と招待](discord-bot-setup.md) が完了していること
- Vercel にダッシュボードがデプロイ済みであること
- Turso DB が稼働していること

---

## Step 1: Railway アカウント作成

1. https://railway.app にアクセス
2. **「Login」** → **「Login with GitHub」** で GitHub アカウントと連携

---

## Step 2: 新規プロジェクト作成

1. **「New Project」** をクリック
2. **「Deploy from GitHub repo」** を選択
3. **ai-cyptotrade** リポジトリを選択して **「Deploy Now」**

※ 初回は GitHub のリポジトリアクセス許可が必要です。

---

## Step 3: ワーカー用に設定を変更

デフォルトでは Next.js アプリが起動します。ワーカーとして動かすため、起動コマンドを変更します。

1. デプロイされたサービスをクリック
2. **「Settings」** タブを開く
3. **「Build」** セクションで（任意・高速化のため）:
   - **Build Command**: `npm install` に変更（ワーカーは Next.js ビルド不要。デフォルトのままで動作するが、ビルド時間を短縮できる）
4. **「Deploy」** セクションで:
   - **Start Command**: `npm run worker` に変更
5. **「Save」** をクリック

---

## Step 4: 環境変数の設定

1. サービス画面で **「Variables」** タブを開く
2. 以下の環境変数を追加（Vercel と同じ値を使用）:

| 変数名 | 値 | 備考 |
|--------|-----|------|
| `TURSO_DATABASE_URL` | `libsql://xxx.turso.io` | Turso の接続 URL |
| `TURSO_AUTH_TOKEN` | （Turso トークン） | Vercel と同じ |
| `ENCRYPTION_KEY` | （32文字以上の秘密鍵） | Vercel と同じ（API キー復号に必須） |
| `DISCORD_BOT_TOKEN` | Discord Bot のトークン | [Discord Developer Portal](https://discord.com/developers/applications) で取得 |
| `DISCORD_CHANNEL_IDS` | 監視するチャンネル ID | カンマ区切り、最大 10 件 |
| `ANTHROPIC_API_KEY` | Claude API キー | [Anthropic Console](https://console.anthropic.com/) で取得 |

### オプション

| 変数名 | 値 | 備考 |
|--------|-----|------|
| `PAPER_TRADING` | `true` | 本番注文を出さずログのみ（テスト用） |

---

## Step 5: 再デプロイ

1. **「Deployments」** タブを開く
2. 最新デプロイの **「⋯」** → **「Redeploy」**
3. または **「Settings」** で変更を保存すると自動で再デプロイされます

---

## Step 6: 動作確認

1. **「Deployments」** でデプロイが **Success** になっているか確認
2. **「Logs」** タブで以下のようなログが出ていれば成功:

```
=== ai-cyptotrade Worker ===
[Worker] User: xxxxxx
[Discord] Logged in as ai-cyptotrade-bot#1234
[Discord] Monitoring 1 channel(s): 123456789012345678
[Worker] Price monitor starting (interval: 30s)
[Worker] Running. Press Ctrl+C to stop.
```

3. Discord の監視チャンネルにテストメッセージを投稿
4. ダッシュボードの `/signals` でシグナルが表示されるか確認

---

## トラブルシューティング

### 「No user found in DB」で終了する

- 先に Vercel のダッシュボードで GitHub ログインを 1 回行い、`users` テーブルにユーザーが登録されている必要があります。

### Discord に接続できない

- `DISCORD_BOT_TOKEN` が正しいか確認
- Discord Developer Portal で **MESSAGE CONTENT INTENT** が ON か確認
- Bot が監視チャンネルがあるサーバーに招待されているか確認

### ビルドが失敗する

- Start Command が `npm run worker` になっているか確認
- Build Command を空欄にするか、`npm install` のみに変更してみる（ワーカーは Next.js ビルド不要）

---

## 料金

- Railway は **無料枠**（月 $5 相当）があります
- ワーカーは常駐プロセスのため、無料枠を超えると従量課金になります
- 使用量は Railway ダッシュボードの **Usage** で確認できます
