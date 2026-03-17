-- 投資設定の拡張
-- 新しいモード・パラメータの追加

-- 総資産に対する最大投資比率（25〜50%、デフォルト25%）
ALTER TABLE investment_settings ADD COLUMN max_portfolio_pct REAL NOT NULL DEFAULT 25;

-- 通貨単位（USD / JPY）
ALTER TABLE investment_settings ADD COLUMN trade_currency TEXT NOT NULL DEFAULT 'USD';

-- 利確モード: take_profit（10%で利確売り） / pyramid（損切り引き上げ+追加投資）
ALTER TABLE investment_settings ADD COLUMN profit_mode TEXT NOT NULL DEFAULT 'pyramid';

-- ピラミッディング上限 %（デフォルト100%、この%に達したら追加投資を停止）
ALTER TABLE investment_settings ADD COLUMN pyramid_max_pct INTEGER NOT NULL DEFAULT 100;

-- 利息モード: simple（単利＝固定額） / compound（複利＝累進額）
ALTER TABLE investment_settings ADD COLUMN interest_mode TEXT NOT NULL DEFAULT 'simple';

-- 複利モードの現在の回数（表示・設定用、新規シグナルごとにインクリメント）
ALTER TABLE investment_settings ADD COLUMN compound_current_round INTEGER NOT NULL DEFAULT 1;
