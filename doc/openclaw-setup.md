# OpenClaw セットアップ手順

## 1. 前提条件

| 項目 | 要件 |
|------|------|
| Node.js | v22 以上 |
| npm | v10 以上 |
| Anthropic API キー | https://console.anthropic.com で取得 |
| Bitget テストネット API キー | https://www.bitget.com/ja/testnet で取得 |

### Node.js バージョン確認

```bash
node --version   # v22.x.x 以上
npm --version    # v10.x.x 以上
```

v22 未満の場合は nvm で更新：

```bash
nvm install 22
nvm use 22
```

### Anthropic API キーの取得

1. https://console.anthropic.com にアクセス
2. アカウントを作成（またはログイン）
3. Settings → API Keys → Create Key
4. キーを控えておく（`sk-ant-...` 形式）

---

## 2. OpenClaw のインストール

```bash
npm install -g openclaw@latest

# インストール確認
openclaw --version
```

> **「openclaw: command not found」の場合**: npm のグローバル bin ディレクトリを PATH に追加してください。
> ```bash
> export PATH="$(npm config get prefix)/bin:$PATH"
> ```

---

## 3. オンボーディング（初期設定ウィザード）

対話型ウィザードが起動します。Anthropic API キーの入力が求められます。

```bash
openclaw onboard --install-daemon
```

ウィザードで設定する項目：
- **LLM プロバイダー**: Anthropic を選択し、API キーを入力
- **メッセージングチャネル**: Telegram を推奨（後から追加可能、スキップも可）
- **Gateway**: デーモンとしてインストール（ポート 18789）
- **ワークスペース**: デフォルトのまま

### 起動確認

```bash
openclaw status
openclaw gateway status
```

Gateway が起動していない場合：

```bash
openclaw gateway start
```

---

## 4. CCXT スキルのインストール

CCXT（暗号通貨取引所ライブラリ）を使って Bitget に接続します。

```bash
openclaw skill install ccxt
```

---

## 5. Bitget テストネット API キーの設定

### テストネット API キーの取得

1. https://www.bitget.com/ja/testnet にアクセス
2. API Management で新しい API キーを作成
3. 権限: Read + Trade（Withdraw は不要）
4. API Key, Secret, Passphrase を控える

### OpenClaw vault に保存

```bash
openclaw vault set BITGET_APIKEY <テストネットAPIキー>
openclaw vault set BITGET_SECRET <テストネットAPIシークレット>
openclaw vault set BITGET_PASSWORD <テストネットパスフレーズ>
```

---

## 6. Trading 設定

`~/.openclaw/openclaw.json` を編集し、trading セクションを追加：

```json
{
  "skills": {
    "trading": {
      "enabled": true,
      "exchange": "bitget",
      "riskLimit": 0.02,
      "sandbox": true
    }
  }
}
```

設定後に再起動：

```bash
openclaw restart
```

---

## 7. 動作確認

### Gateway ヘルスチェック

```bash
openclaw gateway health --url ws://127.0.0.1:18789
```

### CCXT 経由で Bitget テストネットに接続確認

```bash
ccxt bitget fetchBalance --sandbox --raw
```

### Gateway の HTTP API を直接テスト

```bash
curl -s http://127.0.0.1:18789/ | head
```

---

## 8. ダッシュボードとの接続

`.env.local` に以下の環境変数を追加：

```
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=<Gatewayのトークン>
```

Gateway トークンは onboarding 時に生成されます。確認方法：

```bash
cat ~/.openclaw/openclaw.json | grep -i token
```

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `openclaw: command not found` | `export PATH="$(npm config get prefix)/bin:$PATH"` を実行 |
| Gateway が起動しない | `openclaw gateway start` を実行。ポート 18789 が使用中でないか確認 |
| CCXT スキルが見つからない | `openclaw skill install ccxt` を再実行 |
| Bitget 接続エラー | vault に設定した API キーが正しいか確認。テストネットの場合は `--sandbox` フラグを使用 |
| 権限エラー | `sudo` は使わず、npm prefix を `~/.npm-global` に設定 |

---

## 参考リンク

- [OpenClaw Getting Started](https://openclawai.me/blog/getting-started)
- [OpenClaw Trading Bot Guide](https://openclawai.me/blog/trading-bot-guide)
- [CCXT Skill](https://playbooks.com/skills/openclaw/skills/ccxt)
- [Bitget テストネット](https://www.bitget.com/ja/testnet)
- [Anthropic Console](https://console.anthropic.com)
