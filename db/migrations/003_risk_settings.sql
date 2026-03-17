-- リスク管理設定テーブル
-- ユーザーごとに1行（UPSERT で更新）
CREATE TABLE IF NOT EXISTS risk_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  max_position_size_pct REAL NOT NULL DEFAULT 10,
  max_daily_loss REAL NOT NULL DEFAULT 100,
  max_leverage INTEGER NOT NULL DEFAULT 10,
  max_open_positions INTEGER NOT NULL DEFAULT 5,
  default_stop_loss_pct REAL NOT NULL DEFAULT 5,
  default_take_profit_pct REAL NOT NULL DEFAULT 10,
  trading_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_risk_settings_user_id ON risk_settings(user_id);
