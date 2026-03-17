# 認証（NextAuth）セットアップ

## 1. GitHub OAuth App の作成

1. https://github.com/settings/developers にアクセス
2. 「OAuth Apps」→「New OAuth App」をクリック
3. 以下を入力:
   - **Application name**: `ai-cyptotrade`（任意）
   - **Homepage URL**: 
     - ローカル: `http://localhost:3000`
     - 本番: `https://ai-cyptotrade.vercel.app`
   - **Authorization callback URL**:
     - ローカル: `http://localhost:3000/api/auth/callback/github`
     - 本番: `https://ai-cyptotrade.vercel.app/api/auth/callback/github`
4. 「Register application」をクリック
5. **Client ID** と **Client Secret**（Generate a new client secret）をコピー

※本番とローカルで別々のOAuth Appを作るか、1つで両方のURLを登録するか選べます。

## 2. 環境変数の設定

### ローカル（.env.local）

```
AUTH_SECRET=（openssl rand -base64 32 で生成）
GITHUB_ID=GitHub OAuth AppのClient ID
GITHUB_SECRET=GitHub OAuth AppのClient Secret
# ローカル開発時（アプリのベースURL）
NEXTAUTH_URL=http://localhost:3000
```

AUTH_SECRET の生成:
```bash
openssl rand -base64 32
```

### Vercel

プロジェクトの Settings → Environment Variables で以下を追加:

| 名前 | 値 |
|------|-----|
| AUTH_SECRET | 上記で生成した値 |
| AUTH_GITHUB_ID | Client ID |
| AUTH_GITHUB_SECRET | Client Secret |

## 3. 動作確認

1. `npm run dev` で起動
2. http://localhost:3000 にアクセス → ログインページにリダイレクト
3. 「GitHub でログイン」をクリック
4. GitHub で認証後、ダッシュボードが表示されればOK

## 4. トラブルシューティング

### ログイン時に 404 になる

**原因**: GitHub OAuth App のコールバックURLが、実際のアプリのURLと一致していない。

**確認・修正**:
1. https://github.com/settings/developers で OAuth App を開く
2. **Authorization callback URL** を確認:
   - デフォルト（ポート 3000）: `http://localhost:3000/api/auth/callback/github`
3. `.env.local` に `NEXTAUTH_URL=http://localhost:3000` を追加
4. 開発サーバーを再起動
