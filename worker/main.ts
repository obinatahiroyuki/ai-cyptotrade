/**
 * メインワーカー
 *
 * Discord Bot（メッセージ監視）と価格監視ワーカーを統合して実行する常駐プロセス。
 *
 * 実行: npm run worker
 *       (= npx tsx --env-file=.env.local worker/main.ts)
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { createClient } from "@libsql/client";
import { Client, GatewayIntentBits, Events } from "discord.js";
import Anthropic from "@anthropic-ai/sdk";
import { createHmac, createDecipheriv, scryptSync } from "crypto";

// ============================================================
// Configuration
// ============================================================

const POLL_INTERVAL_MS = 30_000;
const BITGET_BASE = "https://api.bitget.com";

// ============================================================
// DB
// ============================================================

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// ============================================================
// Types
// ============================================================

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
  profitMode: "take_profit" | "pyramid";
  pyramidMaxPct: number;
  interestMode: "simple" | "compound";
  compoundCurrentRound: number;
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

// ============================================================
// Encryption
// ============================================================

function decryptValue(ciphertext: string): string {
  const key = scryptSync(process.env.ENCRYPTION_KEY!, "salt", 32);
  const [ivStr, tagStr, encrypted] = ciphertext.split(":");
  const iv = Buffer.from(ivStr, "base64");
  const tag = Buffer.from(tagStr, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, "base64", "utf8") + decipher.final("utf8");
}

// ============================================================
// Bitget API
// ============================================================

function bitgetSign(ts: string, method: string, path: string, body: string, secret: string) {
  return createHmac("sha256", secret).update(ts + method.toUpperCase() + path + body).digest("base64");
}

async function bitgetReq(creds: Credentials, method: string, path: string, body = "") {
  const ts = Date.now().toString();
  const res = await fetch(`${BITGET_BASE}${path}`, {
    method,
    headers: {
      "ACCESS-KEY": creds.apiKey,
      "ACCESS-SIGN": bitgetSign(ts, method, path, body, creds.apiSecret),
      "ACCESS-TIMESTAMP": ts,
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
        if (set.has(t.symbol)) map.set(t.symbol, parseFloat(t.lastPr));
      }
    }
  } catch (err) {
    console.error("[Worker] Price fetch error:", err);
  }
  return map;
}

async function buyMarket(creds: Credentials, symbol: string, usdAmount: string) {
  if (process.env.PAPER_TRADING === "true") {
    console.log(`[PAPER] Would BUY ${symbol} $${usdAmount}`);
    return { code: "00000", data: { orderId: `paper-buy-${Date.now()}` }, msg: "ok" };
  }
  return bitgetReq(creds, "POST", "/api/v2/spot/trade/place-order",
    JSON.stringify({ symbol, side: "buy", orderType: "market", size: usdAmount, force: "gtc" }));
}

async function sellMarket(creds: Credentials, symbol: string, qty: string) {
  if (process.env.PAPER_TRADING === "true") {
    console.log(`[PAPER] Would SELL ${symbol} qty=${qty}`);
    return { code: "00000", data: { orderId: `paper-sell-${Date.now()}` }, msg: "ok" };
  }
  return bitgetReq(creds, "POST", "/api/v2/spot/trade/place-order",
    JSON.stringify({ symbol, side: "sell", orderType: "market", size: qty, force: "gtc" }));
}

async function fetchSpotTickerPrice(symbol: string): Promise<{ success: boolean; data?: { lastPr: string }; error?: string }> {
  try {
    const res = await fetch(`${BITGET_BASE}/api/v2/spot/market/tickers?symbol=${symbol}`);
    const json = await res.json();
    if (json.code === "00000" && Array.isArray(json.data) && json.data.length > 0) {
      return { success: true, data: { lastPr: json.data[0].lastPr } };
    }
    return { success: false, error: json.msg ?? "No data" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function fetchSpotSymbols(): Promise<string[]> {
  try {
    const res = await fetch(`${BITGET_BASE}/api/v2/spot/public/symbols`);
    const json = await res.json();
    if (json.code === "00000" && Array.isArray(json.data)) {
      return json.data.map((s: { symbol: string }) => s.symbol);
    }
  } catch { /* ignore */ }
  return [];
}

// ============================================================
// DB Queries
// ============================================================

async function getActivePositions(): Promise<ActivePosition[]> {
  const r = await db.execute({
    sql: `SELECT id, signal_id, user_id, symbol, bitget_symbol, entry_price,
                 current_stop_loss, current_round, total_quantity, total_invested
          FROM signal_positions WHERE status = 'active'`,
    args: [],
  });
  return r.rows.map((row) => ({
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
  }));
}

async function getNextTarget(signalId: string, currentRound: number): Promise<SignalTarget | null> {
  const r = await db.execute({ sql: "SELECT targets FROM signals WHERE id = ?", args: [signalId] });
  if (r.rows.length === 0) return null;
  const targets = JSON.parse(r.rows[0].targets as string) as SignalTarget[];
  return targets.find((t) => t.round === currentRound + 1) ?? null;
}

async function getInvestmentSettings(userId: string): Promise<InvestmentSettings> {
  const r = await db.execute({ sql: "SELECT * FROM investment_settings WHERE user_id = ?", args: [userId] });
  if (r.rows.length === 0) return DEFAULT_SETTINGS;
  const row = r.rows[0];
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

function calcTradeAmount(settings: InvestmentSettings, round: number): number {
  if (settings.interestMode === "simple") return settings.initialAmount;
  return settings.initialAmount + settings.incrementAmount * (round - 1);
}

async function getCredentials(userId: string): Promise<Credentials | null> {
  const r = await db.execute({
    sql: `SELECT api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted
          FROM exchange_connections WHERE user_id = ? AND exchange_name = 'bitget' AND is_active = 1 LIMIT 1`,
    args: [userId],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    apiKey: decryptValue(row.api_key_encrypted as string),
    apiSecret: decryptValue(row.api_secret_encrypted as string),
    passphrase: decryptValue(row.api_passphrase_encrypted as string),
  };
}

async function getFirstUserId(): Promise<string | null> {
  const r = await db.execute({ sql: "SELECT id FROM users LIMIT 1", args: [] });
  return r.rows.length > 0 ? (r.rows[0].id as string) : null;
}

async function getPrevTargetPrice(signalId: string, round: number): Promise<number> {
  const r = await db.execute({ sql: "SELECT targets, reference_price FROM signals WHERE id = ?", args: [signalId] });
  if (r.rows.length === 0) return 0;
  const targets = JSON.parse(r.rows[0].targets as string) as SignalTarget[];
  const t = targets.find((x) => x.round === round);
  return t ? t.price : (r.rows[0].reference_price as number);
}

// ============================================================
// Signal Parser (Claude)
// ============================================================

const PARSER_SYSTEM = `You are a trading signal parser. You receive Discord messages about cryptocurrency trading signals written in Japanese.

**Pattern A: New Entry (購入対象)** — 売買履歴で、利確目標に「達成」「達成🎉」が一切含まれない。目標価格のみ列挙（例: 10％　目標：0.150）。

**Pattern B: Achievement (購入対象外)** — 以下のいずれか:
- 単体: 「3/11　21：24　ARIA　10％達成🎉」
- 売買履歴の進捗更新: 利確目標に「→　3/11達成🎉」等の達成記述が含まれる（例: 10％　目標：0.150　→　3/11達成🎉）
→ 購入しない。進捗報告のみ。

**Pattern C: Other** — コメント、注意書き、無関係なメッセージ。

Respond ONLY with valid JSON. No markdown fences.

Entry: {"type":"entry","symbol":"ARIA","entryPriceLow":0.09,"entryPriceHigh":0.16,"referencePrice":0.136,"targets":[{"round":1,"price":0.15},{"round":2,"price":0.163},{"round":3,"price":0.204},{"round":4,"price":0.272}],"longTermTarget":1.4,"stopLossPrice":0.12,"rawDate":"2026/3/11 9:15","notes":null}

Achievement: {"type":"achievement","symbol":"ARIA","round":1,"achievedAt":"2026/3/11 21:24"}

Other: {"type":"other","summary":"description"}

Rules:
- 利確目標に「達成」が含まれる → type "achievement" (購入しない)
- "ロスカット：なし" or "10％利確なし" → "other"
- 利確フォーマット: "10％　目標：0.150" → round 1, "20％　目標：0.163" → round 2
- Symbol uppercase, no suffix. Prices as numbers.
- ロスカット未記載時は stopLossPrice = referencePrice * 0.9 程度
- entryPriceLow/High 未記載時は referencePrice を両方に使用`;

let anthropic: Anthropic | null = null;

async function parseSignal(text: string) {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: PARSER_SYSTEM,
    messages: [{ role: "user", content: `Parse:\n\n${text}` }],
  });
  const c = resp.content[0];
  if (c.type !== "text") throw new Error("Unexpected Claude response");
  return JSON.parse(c.text);
}

// ============================================================
// Trade Logic
// ============================================================

async function resolveBitgetSymbol(symbol: string): Promise<string | null> {
  const candidates = [`${symbol}USDT`, `${symbol}USDC`];
  try {
    const all = await fetchSpotSymbols();
    for (const c of candidates) {
      if (all.includes(c)) return c;
    }
  } catch {
    return `${symbol}USDT`;
  }
  return null;
}

const processingMessages = new Set<string>();

async function handleNewSignal(text: string, discordMsgId: string, userId: string): Promise<string> {
  if (processingMessages.has(discordMsgId)) return "duplicate";
  processingMessages.add(discordMsgId);
  try {
    return await _handleNewSignal(text, discordMsgId, userId);
  } finally {
    processingMessages.delete(discordMsgId);
  }
}

async function _handleNewSignal(text: string, discordMsgId: string, userId: string): Promise<string> {
  try {
    const existing = await db.execute({ sql: "SELECT id FROM signals WHERE discord_message_id = ?", args: [discordMsgId] });
    if (existing.rows.length > 0) return "duplicate";
  } catch { /* proceed */ }

  let parsed;
  try {
    parsed = await parseSignal(text);
  } catch (err) {
    console.error("[Worker] Parse error:", err);
    return "parse_error";
  }

  if (parsed.type === "entry") {
    const signalId = crypto.randomUUID();
    try {
      await db.execute({
        sql: `INSERT INTO signals (id, discord_message_id, signal_type, symbol,
                entry_price_low, entry_price_high, reference_price, stop_loss_price,
                targets, long_term_target, raw_text, status)
              VALUES (?, ?, 'entry', ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
        args: [signalId, discordMsgId, parsed.symbol, parsed.entryPriceLow, parsed.entryPriceHigh,
          parsed.referencePrice, parsed.stopLossPrice, JSON.stringify(parsed.targets),
          parsed.longTermTarget, text],
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "SQLITE_CONSTRAINT") {
        console.log(`[Worker] Signal already exists (duplicate): ${parsed.symbol}`);
        return "duplicate";
      }
      throw err;
    }

    const settings = await getInvestmentSettings(userId);
    if (!settings.autoTradeEnabled) {
      console.log(`[Worker] Signal saved (auto-trade OFF): ${parsed.symbol}`);
      return "saved";
    }

    const bgSymbol = await resolveBitgetSymbol(parsed.symbol);
    if (!bgSymbol) {
      console.log(`[Worker] Symbol not found on Bitget: ${parsed.symbol}`);
      return "symbol_not_found";
    }

    // 既に当該銘柄を保有している場合は購入しない（達成報告後の再エントリー防止）
    const existingPos = await db.execute({
      sql: `SELECT id FROM signal_positions
            WHERE user_id = ? AND bitget_symbol = ? AND status = 'active' LIMIT 1`,
      args: [userId, bgSymbol],
    });
    if (existingPos.rows.length > 0) {
      console.log(`[Worker] Already holding ${parsed.symbol}, skip entry`);
      await db.execute({ sql: "UPDATE signals SET status = 'skipped' WHERE id = ?", args: [signalId] });
      return "already_holding";
    }

    const priceResult = await fetchSpotTickerPrice(bgSymbol);
    if (!priceResult.success || !priceResult.data) {
      console.error(`[Worker] Failed to fetch price for ${bgSymbol}`);
      return "price_fetch_failed";
    }
    const currentPrice = parseFloat(priceResult.data.lastPr);
    const priceLow = parsed.entryPriceLow ?? parsed.referencePrice;
    const piceHigh = parsed.entryPriceHigh ?? parsed.referencePrice;

    if (currentPrice < priceLow * 0.95 || currentPrice > piceHigh * 1.05) {
      console.log(`[Worker] Price out of range: ${parsed.symbol} current=$${currentPrice}, range=$${priceLow}~$${piceHigh}`);
      await db.execute({ sql: "UPDATE signals SET status = 'skipped' WHERE id = ?", args: [signalId] });
      return "price_out_of_range";
    }

    console.log(`[Worker] Price in range: ${parsed.symbol} current=$${currentPrice}, range=$${priceLow}~$${piceHigh}`);

    const creds = await getCredentials(userId);
    if (!creds) return "no_credentials";

    const entryRound = settings.interestMode === "compound" ? settings.compoundCurrentRound : 1;
    const investAmount = calcTradeAmount(settings, entryRound);
    const order = await buyMarket(creds, bgSymbol, investAmount.toFixed(2));
    if (order.code !== "00000") {
      console.error(`[Worker] Buy failed: ${order.msg}`);
      return "order_failed";
    }

    const qty = investAmount / currentPrice;
    const posId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO signal_positions
              (id, signal_id, user_id, symbol, bitget_symbol, entry_price,
               current_stop_loss, current_round, total_quantity, total_invested, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'active')`,
      args: [posId, signalId, userId, parsed.symbol, bgSymbol, currentPrice,
        parsed.stopLossPrice, qty, investAmount],
    });

    await db.execute({
      sql: `INSERT INTO signal_trade_log
              (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
            VALUES (?, ?, 'buy_entry', ?, ?, ?, 0, ?, ?)`,
      args: [crypto.randomUUID(), posId, currentPrice, qty, investAmount,
        `New signal entry (ref=$${parsed.referencePrice}, market=$${currentPrice})`, order.data.orderId],
    });

    await db.execute({ sql: "UPDATE signals SET status = 'active' WHERE id = ?", args: [signalId] });

    if (settings.interestMode === "compound") {
      await db.execute({
        sql: "UPDATE investment_settings SET compound_current_round = compound_current_round + 1, updated_at = datetime('now') WHERE user_id = ?",
        args: [userId],
      });
    }

    console.log(`[Worker] ENTRY: ${parsed.symbol} @ $${currentPrice} (ref=$${parsed.referencePrice}), $${investAmount} (round ${entryRound})`);
    return "entry_executed";
  }

  if (parsed.type === "achievement") {
    const signalId = crypto.randomUUID();
    try {
      await db.execute({
        sql: "INSERT INTO signals (id, discord_message_id, signal_type, symbol, raw_text, status) VALUES (?, ?, 'achievement', ?, ?, 'completed')",
        args: [signalId, discordMsgId, parsed.symbol, text],
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "SQLITE_CONSTRAINT") return "duplicate";
      throw err;
    }
    console.log(`[Worker] Achievement: ${parsed.symbol} round ${parsed.round}`);
    return "achievement";
  }

  try {
    await db.execute({
      sql: "INSERT INTO signals (id, discord_message_id, signal_type, symbol, raw_text, status) VALUES (?, ?, 'other', ?, ?, 'skipped')",
      args: [crypto.randomUUID(), discordMsgId, parsed.summary ?? "other", text],
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "SQLITE_CONSTRAINT") return "duplicate";
    throw err;
  }
  return "skipped";
}

// --- Price monitoring ---

async function handleTargetReached(pos: ActivePosition, price: number, target: SignalTarget, creds: Credentials) {
  const newRound = target.round;
  const newSL = newRound === 1 ? pos.entryPrice : await getPrevTargetPrice(pos.signalId, newRound - 1);
  const settings = await getInvestmentSettings(pos.userId);

  // 利確モード: 10%到達で売却
  if (settings.profitMode === "take_profit") {
    const order = await sellMarket(creds, pos.bitgetSymbol, pos.totalQuantity.toString());
    const pnl = price * pos.totalQuantity - pos.totalInvested;
    await db.execute({
      sql: `INSERT INTO signal_trade_log (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
            VALUES (?, ?, 'sell_target', ?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), pos.id, price, pos.totalQuantity,
        price * pos.totalQuantity, newRound, `Take profit at +${newRound * 10}%`, order.data?.orderId ?? null],
    });
    await db.execute({
      sql: `UPDATE signal_positions SET status = 'closed_target', closed_at = datetime('now'),
              realized_pnl = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [pnl, pos.id],
    });
    await db.execute({ sql: "UPDATE signals SET status = 'completed' WHERE id = ? AND status = 'active'", args: [pos.signalId] });
    console.log(`[Worker] TAKE PROFIT: ${pos.symbol} @ ${price}, PnL: $${pnl.toFixed(2)}`);
    return;
  }

  // ピラミッディングモード
  const maxRoundForPyramid = Math.ceil(settings.pyramidMaxPct / 10);
  const shouldPyramid = newRound <= maxRoundForPyramid;
  let addQty = 0, addAmt = 0;

  if (shouldPyramid) {
    const amt = calcTradeAmount(settings, newRound);
    if (pos.totalInvested + amt <= settings.maxInvestmentPerPosition) {
      const order = await buyMarket(creds, pos.bitgetSymbol, amt.toFixed(2));
      if (order.code === "00000") {
        addQty = amt / price;
        addAmt = amt;
        await db.execute({
          sql: `INSERT INTO signal_trade_log (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
                VALUES (?, ?, 'buy_add', ?, ?, ?, ?, ?, ?)`,
          args: [crypto.randomUUID(), pos.id, price, addQty, addAmt, newRound,
            `Target ${newRound} (+${newRound * 10}%)`, order.data.orderId],
        });
      }
    }
  }

  await db.execute({
    sql: `UPDATE signal_positions SET current_round = ?, current_stop_loss = ?,
            total_quantity = total_quantity + ?, total_invested = total_invested + ?,
            updated_at = datetime('now') WHERE id = ?`,
    args: [newRound, newSL, addQty, addAmt, pos.id],
  });
  console.log(`[Worker] Target ${newRound}: ${pos.symbol} @ ${price}, SL→${newSL}` +
    (shouldPyramid && addAmt > 0 ? `, +$${addAmt.toFixed(2)}` : ""));
}

async function handleStopLoss(pos: ActivePosition, price: number, creds: Credentials) {
  const order = await sellMarket(creds, pos.bitgetSymbol, pos.totalQuantity.toString());
  const pnl = price * pos.totalQuantity - pos.totalInvested;
  await db.execute({
    sql: `INSERT INTO signal_trade_log (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
          VALUES (?, ?, 'sell_stoploss', ?, ?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), pos.id, price, pos.totalQuantity,
      price * pos.totalQuantity, pos.currentRound, `Stop-loss @ ${price}`, order.data?.orderId ?? null],
  });
  await db.execute({
    sql: `UPDATE signal_positions SET status = 'closed_stoploss', closed_at = datetime('now'),
            realized_pnl = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [pnl, pos.id],
  });
  await db.execute({ sql: "UPDATE signals SET status = 'completed' WHERE id = ? AND status = 'active'", args: [pos.signalId] });
  console.log(`[Worker] STOP-LOSS: ${pos.symbol} @ ${price}, PnL: $${pnl.toFixed(2)}`);
}

async function priceTick() {
  const positions = await getActivePositions();
  if (positions.length === 0) return;

  const symbols = [...new Set(positions.map((p) => p.bitgetSymbol))];
  const prices = await fetchPrices(symbols);
  const credCache = new Map<string, Credentials | null>();

  for (const pos of positions) {
    const price = prices.get(pos.bitgetSymbol);
    if (price === undefined) continue;

    if (!credCache.has(pos.userId)) credCache.set(pos.userId, await getCredentials(pos.userId));
    const creds = credCache.get(pos.userId);
    if (!creds) continue;

    if (price <= pos.currentStopLoss) {
      await handleStopLoss(pos, price, creds);
      continue;
    }

    const next = await getNextTarget(pos.signalId, pos.currentRound);
    if (next && price >= next.price) {
      await handleTargetReached(pos, price, next, creds);
    }
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== ai-cyptotrade Worker ===");
  if (process.env.PAPER_TRADING === "true") {
    console.log("[PAPER] PAPER TRADING MODE - No real orders will be placed");
  }

  // Validate env
  const required = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "ENCRYPTION_KEY"];
  for (const key of required) {
    if (!process.env[key]) { console.error(`Missing: ${key}`); process.exit(1); }
  }

  const userId = await getFirstUserId();
  if (!userId) {
    console.error("[Worker] No user found in DB. Login via the dashboard first.");
    process.exit(1);
  }
  console.log(`[Worker] User: ${userId}`);

  // --- Discord Bot ---
  const discordToken = process.env.DISCORD_BOT_TOKEN;
  const channelIdsRaw = process.env.DISCORD_CHANNEL_IDS ?? process.env.DISCORD_CHANNEL_ID;
  const channelIds = channelIdsRaw
    ? channelIdsRaw.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 10)
    : [];

  if (discordToken && channelIds.length > 0) {
    const channelIdSet = new Set(channelIds);
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    });

    client.once(Events.ClientReady, (c) => {
      console.log(`[Discord] Logged in as ${c.user.tag}`);
      console.log(`[Discord] Monitoring ${channelIds.length} channel(s): ${channelIds.join(", ")}`);
      console.log(`[Discord] Guilds: ${c.guilds.cache.map(g => `${g.name} (${g.id})`).join(", ") || "none"}`);
    });

    client.on(Events.MessageCreate, async (msg) => {
      console.log(`[Discord] Message received: channel=${msg.channelId}, author=${msg.author.tag}, bot=${msg.author.bot}, content_length=${msg.content.length}`);
      if (msg.author.bot || !channelIdSet.has(msg.channelId)) return;
      try {
        const result = await handleNewSignal(msg.content, msg.id, userId);
        console.log(`[Discord] Processed message ${msg.id}: ${result}`);
      } catch (err) {
        console.error("[Discord] Error:", err);
      }
    });

    await client.login(discordToken);
  } else {
    console.warn("[Worker] DISCORD_BOT_TOKEN / DISCORD_CHANNEL_IDS (or DISCORD_CHANNEL_ID) not set. Discord monitoring disabled.");
  }

  // --- Price Monitor ---
  console.log(`[Worker] Price monitor starting (interval: ${POLL_INTERVAL_MS / 1000}s)`);
  await priceTick();
  setInterval(async () => {
    try { await priceTick(); } catch (err) { console.error("[Worker] Price tick error:", err); }
  }, POLL_INTERVAL_MS);

  console.log("[Worker] Running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("[Worker] Fatal:", err);
  process.exit(1);
});
