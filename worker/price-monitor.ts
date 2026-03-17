/**
 * 価格監視ワーカー（常駐プロセス）
 *
 * 実行: npx tsx worker/price-monitor.ts
 *
 * 全アクティブポジションの現在価格を定期的に取得し、
 * - 次の目標価格に到達 → 損切り引き上げ + 追加投資
 * - 損切り価格を下回る → 全量売却
 */

import "dotenv/config";
import { createClient } from "@libsql/client";
import { createHmac } from "crypto";

// --- Inline DB client (worker は Next.js 外で動くため直接作成) ---

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// --- Inline Bitget functions (path alias が使えない場合のため) ---

const BITGET_BASE = "https://api.bitget.com";

interface Credentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

interface ActivePosition {
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
}

interface SignalTarget {
  round: number;
  price: number;
  achieved: boolean;
}

interface InvestmentSettings {
  initialAmount: number;
  incrementAmount: number;
  maxInvestmentPerPosition: number;
  autoTradeEnabled: boolean;
}

const DEFAULT_SETTINGS: InvestmentSettings = {
  initialAmount: 1.0,
  incrementAmount: 0.5,
  maxInvestmentPerPosition: 100.0,
  autoTradeEnabled: false,
};

const POLL_INTERVAL_MS = 30_000;

// --- Bitget API helpers ---

function createSignature(
  timestamp: string,
  method: string,
  path: string,
  body: string,
  secret: string
): string {
  const message = timestamp + method.toUpperCase() + path + body;
  return createHmac("sha256", secret).update(message).digest("base64");
}

async function bitgetRequest(
  creds: Credentials,
  method: string,
  path: string,
  body = ""
) {
  const timestamp = Date.now().toString();
  const sig = createSignature(timestamp, method, path, body, creds.apiSecret);
  const res = await fetch(`${BITGET_BASE}${path}`, {
    method,
    headers: {
      "ACCESS-KEY": creds.apiKey,
      "ACCESS-SIGN": sig,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": creds.passphrase,
      "Content-Type": "application/json",
    },
    ...(body ? { body } : {}),
  });
  return res.json();
}

async function fetchPrices(symbols: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(`${BITGET_BASE}/api/v2/spot/market/tickers`);
    const json = await res.json();
    if (json.code === "00000" && Array.isArray(json.data)) {
      const set = new Set(symbols);
      for (const t of json.data) {
        if (set.has(t.symbol)) {
          map.set(t.symbol, parseFloat(t.lastPr));
        }
      }
    }
  } catch (err) {
    console.error("[PriceMonitor] Failed to fetch prices:", err);
  }
  return map;
}

async function placeMarketBuy(creds: Credentials, symbol: string, quoteAmount: string) {
  const body = JSON.stringify({
    symbol,
    side: "buy",
    orderType: "market",
    size: quoteAmount,
    force: "gtc",
  });
  return bitgetRequest(creds, "POST", "/api/v2/spot/trade/place-order", body);
}

async function placeMarketSell(creds: Credentials, symbol: string, quantity: string) {
  const body = JSON.stringify({
    symbol,
    side: "sell",
    orderType: "market",
    size: quantity,
    force: "gtc",
  });
  return bitgetRequest(creds, "POST", "/api/v2/spot/trade/place-order", body);
}

// --- Encryption helpers ---

import { createDecipheriv, scryptSync } from "crypto";

function decryptValue(ciphertext: string): string {
  const secret = process.env.ENCRYPTION_KEY!;
  const key = scryptSync(secret, "salt", 32);
  const [ivStr, tagStr, encrypted] = ciphertext.split(":");
  const iv = Buffer.from(ivStr, "base64");
  const tag = Buffer.from(tagStr, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, "base64", "utf8") + decipher.final("utf8");
}

// --- DB query helpers ---

async function getActivePositions(): Promise<ActivePosition[]> {
  const result = await db.execute({
    sql: `SELECT id, signal_id, user_id, symbol, bitget_symbol, entry_price,
                 current_stop_loss, current_round, total_quantity, total_invested
          FROM signal_positions WHERE status = 'active'`,
    args: [],
  });
  return result.rows.map((r) => ({
    id: r.id as string,
    signalId: r.signal_id as string,
    userId: r.user_id as string,
    symbol: r.symbol as string,
    bitgetSymbol: r.bitget_symbol as string,
    entryPrice: r.entry_price as number,
    currentStopLoss: r.current_stop_loss as number,
    currentRound: r.current_round as number,
    totalQuantity: r.total_quantity as number,
    totalInvested: r.total_invested as number,
  }));
}

async function getNextTarget(signalId: string, currentRound: number): Promise<SignalTarget | null> {
  const result = await db.execute({
    sql: "SELECT targets FROM signals WHERE id = ?",
    args: [signalId],
  });
  if (result.rows.length === 0) return null;
  const targets = JSON.parse(result.rows[0].targets as string) as SignalTarget[];
  return targets.find((t) => t.round === currentRound + 1) ?? null;
}

async function getInvestmentSettings(userId: string): Promise<InvestmentSettings> {
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
  };
}

async function getCredentials(userId: string): Promise<Credentials | null> {
  const result = await db.execute({
    sql: `SELECT api_key_encrypted, api_secret_encrypted, passphrase_encrypted
          FROM exchange_connections
          WHERE user_id = ? AND exchange_name = 'bitget' AND is_active = 1
          LIMIT 1`,
    args: [userId],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    apiKey: decryptValue(row.api_key_encrypted as string),
    apiSecret: decryptValue(row.api_secret_encrypted as string),
    passphrase: decryptValue(row.passphrase_encrypted as string),
  };
}

async function getPreviousTargetPrice(signalId: string, round: number): Promise<number> {
  const result = await db.execute({
    sql: "SELECT targets, reference_price FROM signals WHERE id = ?",
    args: [signalId],
  });
  if (result.rows.length === 0) return 0;
  const targets = JSON.parse(result.rows[0].targets as string) as SignalTarget[];
  const t = targets.find((x) => x.round === round);
  return t ? t.price : (result.rows[0].reference_price as number);
}

// --- Core monitoring loop ---

async function handleTargetReached(
  pos: ActivePosition,
  currentPrice: number,
  nextTarget: SignalTarget,
  creds: Credentials
): Promise<void> {
  const newRound = nextTarget.round;
  const newStopLoss =
    newRound === 1 ? pos.entryPrice : await getPreviousTargetPrice(pos.signalId, newRound - 1);

  const settings = await getInvestmentSettings(pos.userId);
  const maxRoundForPyramid = 10; // 100% = 10回 × 10%
  const shouldAdd = newRound <= maxRoundForPyramid;

  let addedQty = 0;
  let addedAmount = 0;

  if (shouldAdd) {
    const investAmount = settings.initialAmount + settings.incrementAmount * newRound;
    if (pos.totalInvested + investAmount <= settings.maxInvestmentPerPosition) {
      const json = await placeMarketBuy(creds, pos.bitgetSymbol, investAmount.toFixed(2));
      if (json.code === "00000" && json.data) {
        addedQty = investAmount / currentPrice;
        addedAmount = investAmount;
        await db.execute({
          sql: `INSERT INTO signal_trade_log
                  (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
                VALUES (?, ?, 'buy_add', ?, ?, ?, ?, ?, ?)`,
          args: [
            crypto.randomUUID(), pos.id, currentPrice, addedQty, addedAmount,
            newRound, `Target ${newRound} reached (+${newRound * 10}%)`, json.data.orderId,
          ],
        });
      }
    }
  }

  await db.execute({
    sql: `UPDATE signal_positions
          SET current_round = ?, current_stop_loss = ?,
              total_quantity = total_quantity + ?, total_invested = total_invested + ?,
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [newRound, newStopLoss, addedQty, addedAmount, pos.id],
  });

  console.log(
    `[PriceMonitor] ${pos.symbol} target ${newRound} reached @ ${currentPrice}. ` +
      `SL→${newStopLoss}` + (shouldAdd ? ` +$${addedAmount.toFixed(2)}` : " (no pyramid)")
  );
}

async function handleStopLoss(
  pos: ActivePosition,
  currentPrice: number,
  creds: Credentials
): Promise<void> {
  const json = await placeMarketSell(creds, pos.bitgetSymbol, pos.totalQuantity.toString());
  const pnl = currentPrice * pos.totalQuantity - pos.totalInvested;

  await db.execute({
    sql: `INSERT INTO signal_trade_log
            (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
          VALUES (?, ?, 'sell_stoploss', ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(), pos.id, currentPrice, pos.totalQuantity,
      currentPrice * pos.totalQuantity, pos.currentRound,
      `Stop-loss at ${currentPrice}`, json.data?.orderId ?? null,
    ],
  });

  await db.execute({
    sql: `UPDATE signal_positions
          SET status = 'closed_stoploss', closed_at = datetime('now'),
              realized_pnl = ?, updated_at = datetime('now')
          WHERE id = ?`,
    args: [pnl, pos.id],
  });

  await db.execute({
    sql: "UPDATE signals SET status = 'completed' WHERE id = ? AND status = 'active'",
    args: [pos.signalId],
  });

  console.log(`[PriceMonitor] STOP-LOSS ${pos.symbol} @ ${currentPrice}, PnL: $${pnl.toFixed(2)}`);
}

async function tick(): Promise<void> {
  const positions = await getActivePositions();
  if (positions.length === 0) return;

  const symbols = [...new Set(positions.map((p) => p.bitgetSymbol))];
  const prices = await fetchPrices(symbols);

  const credCache = new Map<string, Credentials | null>();

  for (const pos of positions) {
    const price = prices.get(pos.bitgetSymbol);
    if (price === undefined) continue;

    if (!credCache.has(pos.userId)) {
      credCache.set(pos.userId, await getCredentials(pos.userId));
    }
    const creds = credCache.get(pos.userId);
    if (!creds) {
      console.warn(`[PriceMonitor] No credentials for user ${pos.userId}`);
      continue;
    }

    // Check stop-loss first
    if (price <= pos.currentStopLoss) {
      await handleStopLoss(pos, price, creds);
      continue;
    }

    // Check next target
    const nextTarget = await getNextTarget(pos.signalId, pos.currentRound);
    if (nextTarget && price >= nextTarget.price) {
      await handleTargetReached(pos, price, nextTarget, creds);
    }
  }
}

// --- Main ---

async function main(): Promise<void> {
  console.log("[PriceMonitor] Starting price monitor worker...");
  console.log(`[PriceMonitor] Poll interval: ${POLL_INTERVAL_MS / 1000}s`);

  // Validate env
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error("[PriceMonitor] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing");
    process.exit(1);
  }
  if (!process.env.ENCRYPTION_KEY) {
    console.error("[PriceMonitor] ENCRYPTION_KEY missing");
    process.exit(1);
  }

  // Initial run
  await tick();

  // Periodic loop
  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error("[PriceMonitor] Tick error:", err);
    }
  }, POLL_INTERVAL_MS);

  console.log("[PriceMonitor] Worker is running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("[PriceMonitor] Fatal error:", err);
  process.exit(1);
});
