-- ai-cyptotrade 初期スキーマ
-- 要件定義書 6.1 主要テーブル案に基づく

-- 外部キー制約を有効化
PRAGMA foreign_keys = ON;

-- ユーザー
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 取引所接続（APIキーは暗号化して保存）
CREATE TABLE exchange_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  exchange_name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_exchange_connections_user_id ON exchange_connections(user_id);

-- 現在のポジション
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  exchange_connection_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long', 'short')),
  quantity REAL NOT NULL,
  entry_price REAL NOT NULL,
  current_price REAL,
  unrealized_pnl REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (exchange_connection_id) REFERENCES exchange_connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_exchange_connection_id ON positions(exchange_connection_id);

-- 取引履歴
CREATE TABLE trades (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  exchange_connection_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  fee REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (exchange_connection_id) REFERENCES exchange_connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_created_at ON trades(created_at);

-- エージェント設定（OpenClawの戦略・リスクパラメータ）
CREATE TABLE agent_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  risk_params TEXT,  -- JSON: position_limit_pct, daily_loss_limit, stop_loss 等
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_settings_user_id ON agent_settings(user_id);

-- 通知・アラート
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  config TEXT,  -- JSON: Telegram chat_id 等
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
