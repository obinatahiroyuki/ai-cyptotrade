-- Discord シグナル連動 自動売買システム用テーブル
PRAGMA foreign_keys = ON;

-- 解析済みシグナル
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  discord_message_id TEXT UNIQUE,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('entry', 'achievement', 'other')),
  symbol TEXT NOT NULL,
  entry_price_low REAL,
  entry_price_high REAL,
  reference_price REAL,
  stop_loss_price REAL,
  targets TEXT,            -- JSON: [{ "round": 1, "price": 0.205 }, ...]
  long_term_target REAL,
  raw_text TEXT NOT NULL,
  parsed_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'completed', 'skipped')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);

-- アクティブポジション（シグナルに基づく売買管理）
CREATE TABLE IF NOT EXISTS signal_positions (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  bitget_symbol TEXT NOT NULL,     -- Bitget 上の正式なシンボル名 (e.g. ELXUSDT)
  entry_price REAL NOT NULL,
  current_stop_loss REAL NOT NULL,
  current_round INTEGER NOT NULL DEFAULT 0,   -- 達成済みの回数
  total_quantity REAL NOT NULL DEFAULT 0,      -- 保有数量合計
  total_invested REAL NOT NULL DEFAULT 0,      -- 投資額合計 (USD)
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed_stoploss', 'closed_manual', 'closed_target')),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  realized_pnl REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (signal_id) REFERENCES signals(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_signal_positions_signal_id ON signal_positions(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_positions_user_id ON signal_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_positions_status ON signal_positions(status);

-- 売買ログ（全売買記録）
CREATE TABLE IF NOT EXISTS signal_trade_log (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy_entry', 'buy_add', 'sell_stoploss', 'sell_manual', 'sell_target')),
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  amount_usd REAL NOT NULL,
  round_at_trade INTEGER NOT NULL DEFAULT 0,  -- この取引時の回数
  reason TEXT,
  bitget_order_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (position_id) REFERENCES signal_positions(id)
);

CREATE INDEX IF NOT EXISTS idx_signal_trade_log_position_id ON signal_trade_log(position_id);
CREATE INDEX IF NOT EXISTS idx_signal_trade_log_created_at ON signal_trade_log(created_at);

-- 投資設定（ユーザーごと1行）
CREATE TABLE IF NOT EXISTS investment_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  initial_amount REAL NOT NULL DEFAULT 1.0,        -- 初期投資額 (USD)
  increment_amount REAL NOT NULL DEFAULT 0.5,      -- 毎回の追加増分 (USD)
  max_investment_per_position REAL NOT NULL DEFAULT 100.0,  -- 1ポジションあたりの最大投資額
  auto_trade_enabled INTEGER NOT NULL DEFAULT 0,   -- 自動売買ON/OFF
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_investment_settings_user_id ON investment_settings(user_id);
