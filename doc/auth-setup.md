# 認証（NextAuth）セットアップ

## 1. GitHub OAuth App の作成

1. https://github.com/settings/developers にアクセス
2. 「OAuth Apps」→「New OAuth App」をクリック
3. 以下を入力:
   - **Application name**: `ai-cyptotrade`（任意）
   - **Homepage URL**: 
     - ローカル: `http://localhost:3001`
     - 本番: `https://ai-cyptotrade.vercel.app`
   - **Authorization callback URL**:
     - ローカル: `http://localhost:3001/api/auth/callback/github`
     - 本番: `https://ai-cyptotrade.vercel.app/api/auth/callback/github`
4. 「Register application」をクリック
5. **Client ID** と **Client Secret**（Generate a new client secret）をコピー

※本番とローカルで別々のOAuth Appを作るか、1つで両方のURLを登録するか選べます。

## 2. 環境変数の設定

### ローカル（.env.local）

```
AUTH_SECRET=ここに32文字以上のランダム文字列
AUTH_GITHUB_ID=あなたのClient ID
AUTH_GITHUB_SECRET=あなたのClient Secret
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
2. http://localhost:3001 にアクセス → ログインページにリダイレクト
3. 「GitHub でログイン」をクリック
4. GitHub で認証後、ダッシュボードが表示されればOK
