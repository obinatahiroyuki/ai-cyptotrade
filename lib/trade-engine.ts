import { db } from "@/lib/db";
import {
  placeSpotMarketBuy,
  placeSpotMarketSell,
  fetchSpotSymbols,
  type BitgetCredentials,
} from "@/lib/bitget";
import { parseSignalText, type ParsedEntrySignal } from "@/lib/signal-parser";
import type { DiscordSignalMessage } from "@/lib/discord-bot";

// --- Types ---

export interface InvestmentSettings {
  initialAmount: number;
  incrementAmount: number;
  maxInvestmentPerPosition: number;
  autoTradeEnabled: boolean;
  profitMode: "take_profit" | "pyramid";
  pyramidMaxPct: number;
  interestMode: "simple" | "compound";
  compoundCurrentRound: number;
}

export interface ActivePosition {
  id: string;
  signalId: string;
  userId: string;
  symbol: string;
  bitgetSymbol: string;
  entryPrice: number;
  currentStopLoss: number;
  currentRound: number;
  totalQuantity: number;
  totalInvested: number;
  status: string;
}

interface SignalTarget {
  round: number;
  price: number;
  achieved: boolean;
}

const DEFAULT_SETTINGS: InvestmentSettings = {
  initialAmount: 1.0,
  incrementAmount: 0.5,
  maxInvestmentPerPosition: 100.0,
  autoTradeEnabled: false,
  profitMode: "pyramid",
  pyramidMaxPct: 100,
  interestMode: "simple",
  compoundCurrentRound: 1,
};

// --- Core Functions ---

/**
 * Discord メッセージを受信して処理する（シグナル解析 → DB保存 → 自動売買）
 */
export async function processDiscordMessage(
  message: DiscordSignalMessage,
  userId: string,
  credentials: BitgetCredentials
): Promise<{ action: string; signalId?: string; error?: string }> {
  const existing = await db.execute({
    sql: "SELECT id FROM signals WHERE discord_message_id = ?",
    args: [message.id],
  });
  if (existing.rows.length > 0) {
    return { action: "duplicate", signalId: existing.rows[0].id as string };
  }

  const parsed = await parseSignalText(message.content);

  if (parsed.type === "entry") {
    return handleEntrySignal(parsed, message, userId, credentials);
  }

  if (parsed.type === "achievement") {
    const signalId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO signals (id, discord_message_id, signal_type, symbol, raw_text, status)
            VALUES (?, ?, 'achievement', ?, ?, 'completed')`,
      args: [signalId, message.id, parsed.symbol, message.content],
    });

    await updateAchievement(parsed.symbol, parsed.round);
    return { action: "achievement_recorded", signalId };
  }

  const signalId = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO signals (id, discord_message_id, signal_type, symbol, raw_text, status)
          VALUES (?, ?, 'other', ?, ?, 'skipped')`,
    args: [signalId, message.id, parsed.summary ?? "other", message.content],
  });
  return { action: "skipped", signalId };
}

async function handleEntrySignal(
  signal: ParsedEntrySignal,
  message: DiscordSignalMessage,
  userId: string,
  credentials: BitgetCredentials
): Promise<{ action: string; signalId?: string; error?: string }> {
  const signalId = crypto.randomUUID();

  await db.execute({
    sql: `INSERT INTO signals (id, discord_message_id, signal_type, symbol,
            entry_price_low, entry_price_high, reference_price, stop_loss_price,
            targets, long_term_target, raw_text, status)
          VALUES (?, ?, 'entry', ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    args: [
      signalId,
      message.id,
      signal.symbol,
      signal.entryPriceLow,
      signal.entryPriceHigh,
      signal.referencePrice,
      signal.stopLossPrice,
      JSON.stringify(signal.targets),
      signal.longTermTarget,
      message.content,
    ],
  });

  const settings = await getInvestmentSettings(userId);
  if (!settings.autoTradeEnabled) {
    await db.execute({
      sql: "UPDATE signals SET status = 'new' WHERE id = ?",
      args: [signalId],
    });
    return { action: "signal_saved", signalId };
  }

  const bitgetSymbol = await resolveBitgetSymbol(signal.symbol);
  if (!bitgetSymbol) {
    return {
      action: "symbol_not_found",
      signalId,
      error: `Bitget symbol not found for ${signal.symbol}`,
    };
  }

  const investAmount = calculateInvestAmount(settings, 0);
  const result = await executeEntry(
    signalId,
    userId,
    signal,
    bitgetSymbol,
    investAmount,
    credentials
  );

  return result;
}

/**
 * 新規エントリーを実行する
 */
export async function executeEntry(
  signalId: string,
  userId: string,
  signal: ParsedEntrySignal,
  bitgetSymbol: string,
  investAmount: number,
  credentials: BitgetCredentials
): Promise<{ action: string; signalId: string; error?: string }> {
  const orderResult = await placeSpotMarketBuy(
    credentials,
    bitgetSymbol,
    investAmount.toFixed(2)
  );

  if (!orderResult.success || !orderResult.data) {
    return {
      action: "order_failed",
      signalId,
      error: orderResult.error ?? "Order failed",
    };
  }

  const estimatedQty = investAmount / signal.referencePrice;

  const positionId = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO signal_positions
            (id, signal_id, user_id, symbol, bitget_symbol, entry_price,
             current_stop_loss, current_round, total_quantity, total_invested, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'active')`,
    args: [
      positionId,
      signalId,
      userId,
      signal.symbol,
      bitgetSymbol,
      signal.referencePrice,
      signal.stopLossPrice,
      estimatedQty,
      investAmount,
    ],
  });

  await db.execute({
    sql: `INSERT INTO signal_trade_log
            (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
          VALUES (?, ?, 'buy_entry', ?, ?, ?, 0, 'New signal entry', ?)`,
    args: [
      crypto.randomUUID(),
      positionId,
      signal.referencePrice,
      estimatedQty,
      investAmount,
      orderResult.data.orderId,
    ],
  });

  await db.execute({
    sql: "UPDATE signals SET status = 'active' WHERE id = ?",
    args: [signalId],
  });

  console.log(
    `[TradeEngine] Entry: ${signal.symbol} @ ${signal.referencePrice}, amount: $${investAmount}`
  );

  return { action: "entry_executed", signalId };
}

/**
 * 価格監視で目標達成を検出したときの処理
 */
export async function handleTargetReached(
  position: ActivePosition,
  currentPrice: number,
  nextTarget: SignalTarget,
  credentials: BitgetCredentials
): Promise<void> {
  const newRound = nextTarget.round;
  const previousTargetPrice =
    newRound === 1
      ? position.entryPrice
      : await getPreviousTargetPrice(position.signalId, newRound - 1);

  const newStopLoss = previousTargetPrice;

  const settings = await getInvestmentSettings(position.userId);

  const maxRoundForPyramid = 10;
  const shouldAddInvestment = newRound <= maxRoundForPyramid;

  let addedQty = 0;
  let addedAmount = 0;

  if (shouldAddInvestment) {
    const investAmount = calculateInvestAmount(settings, newRound);
    if (position.totalInvested + investAmount <= settings.maxInvestmentPerPosition) {
      const orderResult = await placeSpotMarketBuy(
        credentials,
        position.bitgetSymbol,
        investAmount.toFixed(2)
      );

      if (orderResult.success && orderResult.data) {
        addedQty = investAmount / currentPrice;
        addedAmount = investAmount;

        await db.execute({
          sql: `INSERT INTO signal_trade_log
                  (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
                VALUES (?, ?, 'buy_add', ?, ?, ?, ?, ?, ?)`,
          args: [
            crypto.randomUUID(),
            position.id,
            currentPrice,
            addedQty,
            addedAmount,
            newRound,
            `Target ${newRound} reached (+${newRound * 10}%), pyramiding`,
            orderResult.data.orderId,
          ],
        });
      }
    }
  }

  await db.execute({
    sql: `UPDATE signal_positions
          SET current_round = ?,
              current_stop_loss = ?,
              total_quantity = total_quantity + ?,
              total_invested = total_invested + ?,
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [newRound, newStopLoss, addedQty, addedAmount, position.id],
  });

  console.log(
    `[TradeEngine] Target ${newRound} reached for ${position.symbol}. ` +
      `New stop-loss: ${newStopLoss}. ` +
      (shouldAddInvestment
        ? `Added $${addedAmount.toFixed(2)}`
        : "No more pyramiding (100%+ gain)")
  );
}

/**
 * 損切り実行
 */
export async function executeStopLoss(
  position: ActivePosition,
  currentPrice: number,
  credentials: BitgetCredentials
): Promise<void> {
  const sellResult = await placeSpotMarketSell(
    credentials,
    position.bitgetSymbol,
    position.totalQuantity.toString()
  );

  const realizedPnl =
    currentPrice * position.totalQuantity - position.totalInvested;

  await db.execute({
    sql: `INSERT INTO signal_trade_log
            (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
          VALUES (?, ?, 'sell_stoploss', ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      position.id,
      currentPrice,
      position.totalQuantity,
      currentPrice * position.totalQuantity,
      position.currentRound,
      `Stop-loss triggered at ${currentPrice}`,
      sellResult.data?.orderId ?? null,
    ],
  });

  await db.execute({
    sql: `UPDATE signal_positions
          SET status = 'closed_stoploss',
              closed_at = datetime('now'),
              realized_pnl = ?,
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [realizedPnl, position.id],
  });

  await db.execute({
    sql: `UPDATE signals SET status = 'completed'
          WHERE id = ? AND status = 'active'`,
    args: [position.signalId],
  });

  console.log(
    `[TradeEngine] Stop-loss: ${position.symbol} @ ${currentPrice}, PnL: $${realizedPnl.toFixed(2)}`
  );
}

// --- Helper Functions ---

/**
 * 投資額を計算（初期額 + 増分 × 回数）
 */
export function calculateInvestAmount(
  settings: InvestmentSettings,
  round: number
): number {
  if (settings.interestMode === "simple") return settings.initialAmount;
  return settings.initialAmount + settings.incrementAmount * (round - 1);
}

async function getInvestmentSettings(
  userId: string
): Promise<InvestmentSettings> {
  const result = await db.execute({
    sql: "SELECT * FROM investment_settings WHERE user_id = ?",
    args: [userId],
  });

  if (result.rows.length === 0) return DEFAULT_SETTINGS;

  const row = result.rows[0];
  return {
    initialAmount: row.initial_amount as number,
    incrementAmount: row.increment_amount as number,
    maxInvestmentPerPosition: row.max_investment_per_position as number,
    autoTradeEnabled: (row.auto_trade_enabled as number) === 1,
    profitMode: (row.profit_mode as string) === "take_profit" ? "take_profit" : "pyramid",
    pyramidMaxPct: (row.pyramid_max_pct as number) ?? 100,
    interestMode: (row.interest_mode as string) === "compound" ? "compound" : "simple",
    compoundCurrentRound: (row.compound_current_round as number) ?? 1,
  };
}

async function getPreviousTargetPrice(
  signalId: string,
  round: number
): Promise<number> {
  const result = await db.execute({
    sql: "SELECT targets, reference_price FROM signals WHERE id = ?",
    args: [signalId],
  });

  if (result.rows.length === 0) return 0;

  const targets = JSON.parse(result.rows[0].targets as string) as SignalTarget[];
  const target = targets.find((t) => t.round === round);
  return target ? target.price : (result.rows[0].reference_price as number);
}

async function resolveBitgetSymbol(
  symbol: string
): Promise<string | null> {
  const candidates = [`${symbol}USDT`, `${symbol}USDC`];

  try {
    const allSymbols = await fetchSpotSymbols();
    for (const candidate of candidates) {
      if (allSymbols.includes(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Fallback: assume USDT pair
    return `${symbol}USDT`;
  }

  return null;
}

async function updateAchievement(
  symbol: string,
  round: number
): Promise<void> {
  const positions = await db.execute({
    sql: `SELECT sp.id, sp.signal_id FROM signal_positions sp
          JOIN signals s ON sp.signal_id = s.id
          WHERE sp.symbol = ? AND sp.status = 'active'
          ORDER BY sp.created_at DESC LIMIT 1`,
    args: [symbol],
  });

  if (positions.rows.length === 0) return;

  const signalId = positions.rows[0].signal_id as string;

  const signalResult = await db.execute({
    sql: "SELECT targets FROM signals WHERE id = ?",
    args: [signalId],
  });

  if (signalResult.rows.length === 0) return;

  const targets = JSON.parse(
    signalResult.rows[0].targets as string
  ) as SignalTarget[];
  const updated = targets.map((t) =>
    t.round === round ? { ...t, achieved: true, achievedAt: new Date().toISOString() } : t
  );

  await db.execute({
    sql: "UPDATE signals SET targets = ? WHERE id = ?",
    args: [JSON.stringify(updated), signalId],
  });
}

/**
 * アクティブポジション一覧を取得
 */
export async function getActivePositions(): Promise<ActivePosition[]> {
  const result = await db.execute({
    sql: `SELECT id, signal_id, user_id, symbol, bitget_symbol, entry_price,
                 current_stop_loss, current_round, total_quantity, total_invested, status
          FROM signal_positions
          WHERE status = 'active'`,
    args: [],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    signalId: row.signal_id as string,
    userId: row.user_id as string,
    symbol: row.symbol as string,
    bitgetSymbol: row.bitget_symbol as string,
    entryPrice: row.entry_price as number,
    currentStopLoss: row.current_stop_loss as number,
    currentRound: row.current_round as number,
    totalQuantity: row.total_quantity as number,
    totalInvested: row.total_invested as number,
    status: row.status as string,
  }));
}

/**
 * シグナルの次の目標価格を取得
 */
export async function getNextTarget(
  signalId: string,
  currentRound: number
): Promise<SignalTarget | null> {
  const result = await db.execute({
    sql: "SELECT targets FROM signals WHERE id = ?",
    args: [signalId],
  });

  if (result.rows.length === 0) return null;

  const targets = JSON.parse(result.rows[0].targets as string) as SignalTarget[];
  return targets.find((t) => t.round === currentRound + 1) ?? null;
}
