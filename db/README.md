# データベース（Turso）

## マイグレーション

### 初回セットアップ後

```bash
turso db shell ai-cyptotrade < db/migrations/001_initial.sql
```

### テーブル確認

```bash
turso db shell ai-cyptotrade ".tables"
```

## スキーマ

- `users` - ユーザー情報
- `exchange_connections` - 取引所API接続（暗号化）
- `positions` - 現在のポジション
- `trades` - 取引履歴
- `risk_settings` - リスク管理設定
- `agent_settings` - エージェント設定
- `alerts` - 通知設定

詳細は `doc/requirements.md` 6章を参照。
