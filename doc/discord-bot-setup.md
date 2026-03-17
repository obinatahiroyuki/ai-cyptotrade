# Discord Bot セットアップ手順

## 1. Discord テストサーバーの作成

1. Discord アプリ（デスクトップまたはブラウザ）を開く
2. 左サイドバーの一番下にある **「+」ボタン** をクリック
3. **「オリジナルを作成」** → **「自分と友達のために」** を選択
4. サーバー名を入力（例: `ai-cyptotrade-test`）→ **「作成」**

## 2. テスト用チャンネルの作成

1. 作成したサーバーで **「+」** をクリックしてチャンネルを追加
2. チャンネル名: `売買シグナルテスト`（または任意の名前）
3. テキストチャンネルとして作成

## 3. チャンネル ID の取得

1. Discord の設定 → **詳細設定** → **「開発者モード」を ON** にする
2. 作成したチャンネルを **右クリック** → **「チャンネル ID をコピー」**
3. `.env.local` の `DISCORD_CHANNEL_IDS` にペースト（複数はカンマ区切り、最大10件。単一の場合は `DISCORD_CHANNEL_ID` も可）

## 4. Discord Bot の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 右上の **「New Application」** をクリック
3. 名前を入力（例: `ai-cyptotrade-bot`）→ **「Create」**

### 4.1 Bot の設定

1. 左メニューの **「Bot」** をクリック
2. **「Reset Token」** をクリックしてトークンを取得（⚠️ 一度しか表示されないのでコピー）
3. `.env.local` の `DISCORD_BOT_TOKEN` にペースト

### 4.2 Privileged Gateway Intents の有効化（重要）

同じ Bot ページで、以下の **3つの Intent を ON** にする:

- ✅ **PRESENCE INTENT**
- ✅ **SERVER MEMBERS INTENT**
- ✅ **MESSAGE CONTENT INTENT** ← これが最重要（メッセージ本文を読み取るために必要）

**「Save Changes」** をクリックして保存。

## 5. Bot をサーバーに招待

1. 左メニューの **「OAuth2」** をクリック
2. **「URL Generator」** を選択
3. **SCOPES** で以下にチェック:
   - ✅ `bot`
4. **BOT PERMISSIONS** で以下にチェック:
   - ✅ `Read Messages/View Channels`
   - ✅ `Read Message History`
5. 画面下部に生成された **URL をコピー** してブラウザで開く
6. テストサーバーを選択して **「認証」**

## 6. Anthropic API キーの取得

1. [Anthropic Console](https://console.anthropic.com/) にアクセス
2. **「API Keys」** → **「Create Key」**
3. キーをコピーして `.env.local` の `ANTHROPIC_API_KEY` にペースト

## 7. 環境変数の確認

`.env.local` に以下の 3 つが設定されていること:

```
DISCORD_BOT_TOKEN=<Step 4.1 で取得したトークン>
DISCORD_CHANNEL_IDS=<Step 3 で取得したチャンネル ID>（複数はカンマ区切り、最大10件）
ANTHROPIC_API_KEY=<Step 6 で取得した API キー>
```

## 8. ワーカーの起動

```bash
npm run worker
```

以下のログが表示されれば成功:

```
=== ai-cyptotrade Worker ===
[Worker] User: xxxxxx
[Discord] Logged in as ai-cyptotrade-bot#1234
[Discord] Monitoring channel: 123456789012345678
[Worker] Price monitor starting (interval: 30s)
[Worker] Running. Press Ctrl+C to stop.
```

## 9. テストメッセージの送信

### 購入対象（新規エントリー）

利確目標に「達成」の記述がないもの。以下のようなメッセージは購入対象:

```
🔶売買履歴
2026/3/11（水）9:15
銘柄：ARIA
エントリー価格帯：0.09〜0.16
参考価格：0.136

🔶利確設定・進捗
10％　目標：0.150
20％　目標：0.163
50％　目標：0.204
100％ 目標：0.272
長期目標：1.4
```

### 購入対象外（達成報告）

以下のいずれかは購入しない:
- 単体の達成報告: `3/11　21：24　ARIA　10％達成🎉`
- 売買履歴に達成が含まれる: `10％　目標：0.150　→　3/11達成🎉` のように目標に達成記述がある

### 確認ポイント

1. ワーカーのコンソールに `[Discord] Processed message ... : saved` と表示される
2. ダッシュボードの `/signals` にシグナルが表示される
3. 自動売買が OFF なら `saved`、ON なら `entry_executed` と表示される

## 10. 本番移行時

マネースクールのサーバーに移行する際は:

1. **パターン A（推奨）**: 自分の Bot を管理者に招待してもらう
   - Bot の招待 URL（Step 5 で生成）を管理者に共有
   - `DISCORD_CHANNEL_IDS` のみ変更（複数はカンマ区切り）

2. **パターン B**: 管理者が別の Bot を用意する場合
   - 管理者から Bot Token をもらう
   - `DISCORD_BOT_TOKEN` と `DISCORD_CHANNEL_IDS` の両方を変更
