# Bitget API 連携セットアップ

## 1. Bitget で API キーを発行

1. https://www.bitget.com にログイン
2. 右上のプロフィール → **API Management**
3. **Create API** をクリック
4. 以下を設定:
   - **API Name**: 任意（例: ai-cyptotrade）
   - **Passphrase**: 自分で設定（忘れないようにメモ）
   - **Permissions**: 必要に応じて選択（残高確認のみなら Read で可）
5. **Create** をクリック
6. **API Key** と **Secret Key** をコピー（Secret は再表示不可のため必ず保存）

## 2. テストネット（推奨）

本番前にテストネットで検証する場合:

1. https://testnet.bitget.com でアカウント作成
2. テストネット用の API キーを発行
3. 本番用の `api.bitget.com` の代わりに `testnet.binance.vision` 等、Bitget のテストネット URL を確認

※Bitget のテストネットは要確認。本番 API の場合は `https://api.bitget.com` を使用。

## 3. 環境変数

`.env.local` に以下を追加（API キー保存時の暗号化用）:

```
ENCRYPTION_KEY=openssl rand -base64 32 で生成した32文字以上
```

Vercel にも同じ `ENCRYPTION_KEY` を設定してください。

## 4. 動作確認

1. ダッシュボードで **Bitget 連携設定** をクリック
2. API Key, Secret, Passphrase を入力
3. **接続テスト** をクリック → 成功すれば残高情報が表示
4. **保存** をクリック → 暗号化して DB に保存
