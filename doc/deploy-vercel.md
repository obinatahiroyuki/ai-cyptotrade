# Vercel デプロイ手順

## 前提条件

- GitHub アカウント
- Vercel アカウント（https://vercel.com で無料登録）

---

## Step 1: GitHub にプッシュ

### 1-1. Git を初期化

```bash
cd /Users/obinatahiroyuki/Desktop/dev/ai-cyptotrade
git init
git add .
git commit -m "Initial commit"
```

### 1-2. GitHub でリポジトリを作成

1. https://github.com/new にアクセス
2. リポジトリ名: `ai-cyptotrade`（任意）
3. Public を選択
4. 「Create repository」をクリック
5. **README や .gitignore は追加しない**（既にプロジェクトにあるため）

### 1-3. プッシュ

GitHub で表示されるコマンドを実行（ユーザー名は適宜変更）:

```bash
git remote add origin https://github.com/あなたのユーザー名/ai-cyptotrade.git
git branch -M main
git push -u origin main
```

---

## Step 2: Vercel でデプロイ

### 2-1. プロジェクトをインポート

1. https://vercel.com にログイン
2. 「Add New...」→「Project」
3. 「Import Git Repository」で GitHub の `ai-cyptotrade` を選択
4. 「Import」をクリック

### 2-2. 環境変数を設定

「Environment Variables」で以下を追加:

| 名前 | 値 | 備考 |
|------|-----|------|
| `TURSO_DATABASE_URL` | `libsql://ai-cyptotrade-xxx.turso.io` | `.env.local` の値 |
| `TURSO_AUTH_TOKEN` | （トークン） | `.env.local` の値 |
| `AUTH_SECRET` | `openssl rand -base64 32` で生成 | NextAuth用 |
| `AUTH_GITHUB_ID` | GitHub OAuth AppのClient ID | `doc/auth-setup.md` 参照 |
| `AUTH_GITHUB_SECRET` | GitHub OAuth AppのClient Secret | 同上 |

※本番用トークンを使う場合は、要件定義書「9. 本番環境移行チェックリスト」を参照して再発行すること。

### 2-3. デプロイ実行

「Deploy」をクリック。数分で完了します。

---

## Step 3: 動作確認

デプロイ後、表示される URL で以下にアクセス:

- `https://あなたのプロジェクト.vercel.app/` … トップページ
- `https://あなたのプロジェクト.vercel.app/api/ping` … `{"ok":true,"message":"pong"}`
- `https://あなたのプロジェクト.vercel.app/api/db/health` … DB接続確認

---

## トラブルシューティング

### ビルドが失敗する

- Vercel のビルドログを確認
- `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` が正しく設定されているか確認

### /api/db/health が 500 エラー

- 環境変数が設定されていない、または誤っている
- Turso のトークンが有効か確認: `turso db tokens create ai-cyptotrade`
