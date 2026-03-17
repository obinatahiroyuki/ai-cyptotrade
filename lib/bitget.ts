import { createHmac } from "crypto";

const BASE_URL = "https://api.bitget.com";

export interface BitgetCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

export interface SpotAsset {
  coin: string;
  available: string;
  frozen: string;
  locked: string;
  uTime: string;
}

export interface FuturesPosition {
  symbol: string;
  marginCoin: string;
  holdSide: "long" | "short";
  total: string;
  available: string;
  leverage: string;
  openPriceAvg: string;
  markPrice: string;
  unrealizedPL: string;
  achievedProfits: string;
  marginSize: string;
  marginMode: string;
  liquidationPrice: string;
  takeProfit: string;
  stopLoss: string;
  cTime: string;
  uTime: string;
}

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
  credentials: BitgetCredentials,
  method: string,
  path: string,
  body = ""
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const timestamp = Date.now().toString();
  const signature = createSignature(timestamp, method, path, body, credentials.apiSecret);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "ACCESS-KEY": credentials.apiKey,
        "ACCESS-SIGN": signature,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-PASSPHRASE": credentials.passphrase,
        "Content-Type": "application/json",
      },
      ...(body ? { body } : {}),
    });

    const json = await res.json();

    if (json.code === "00000") {
      return { success: true, data: json.data };
    }

    return { success: false, error: json.msg || json.code || "Unknown error" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function fetchBitgetAccountBalance(
  credentials: BitgetCredentials
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  return bitgetRequest(credentials, "GET", "/api/v2/account/all-account-balance");
}

export async function fetchSpotAssets(
  credentials: BitgetCredentials
): Promise<{ success: boolean; data?: SpotAsset[]; error?: string }> {
  const result = await bitgetRequest(
    credentials,
    "GET",
    "/api/v2/spot/account/assets?assetType=hold_only"
  );
  return result as { success: boolean; data?: SpotAsset[]; error?: string };
}

export async function fetchFuturesPositions(
  credentials: BitgetCredentials,
  productType: "USDT-FUTURES" | "COIN-FUTURES" | "USDC-FUTURES" = "USDT-FUTURES"
): Promise<{ success: boolean; data?: FuturesPosition[]; error?: string }> {
  const result = await bitgetRequest(
    credentials,
    "GET",
    `/api/v2/mix/position/all-position?productType=${productType}`
  );
  return result as { success: boolean; data?: FuturesPosition[]; error?: string };
}

export interface SpotFill {
  symbol: string;
  orderId: string;
  tradeId: string;
  orderType: string;
  side: string;
  priceAvg: string;
  size: string;
  amount: string;
  tradeScope: string;
  feeDetail: {
    feeCoin: string;
    totalFee: string;
  };
  cTime: string;
  uTime: string;
}

export interface FuturesOrder {
  symbol: string;
  orderId: string;
  orderType: string;
  side: string;
  posSide: string;
  tradeSide: string;
  price: string;
  priceAvg: string;
  size: string;
  baseVolume: string;
  quoteVolume: string;
  fee: string;
  leverage: string;
  marginCoin: string;
  marginMode: string;
  totalProfits: string;
  status: string;
  orderSource: string;
  cTime: string;
  uTime: string;
}

export async function fetchSpotFills(
  credentials: BitgetCredentials,
  options: { limit?: number; startTime?: string; endTime?: string } = {}
): Promise<{ success: boolean; data?: SpotFill[]; error?: string }> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));
  if (options.startTime) params.set("startTime", options.startTime);
  if (options.endTime) params.set("endTime", options.endTime);

  const result = await bitgetRequest(
    credentials,
    "GET",
    `/api/v2/spot/trade/fills?${params.toString()}`
  );
  return result as { success: boolean; data?: SpotFill[]; error?: string };
}

export async function fetchFuturesOrderHistory(
  credentials: BitgetCredentials,
  options: {
    productType?: "USDT-FUTURES" | "COIN-FUTURES" | "USDC-FUTURES";
    limit?: number;
    startTime?: string;
    endTime?: string;
  } = {}
): Promise<{ success: boolean; data?: { entrustedList: FuturesOrder[]; endId: string }; error?: string }> {
  const params = new URLSearchParams();
  params.set("productType", options.productType ?? "USDT-FUTURES");
  params.set("limit", String(options.limit ?? 50));
  if (options.startTime) params.set("startTime", options.startTime);
  if (options.endTime) params.set("endTime", options.endTime);

  const result = await bitgetRequest(
    credentials,
    "GET",
    `/api/v2/mix/order/orders-history?${params.toString()}`
  );
  return result as { success: boolean; data?: { entrustedList: FuturesOrder[]; endId: string }; error?: string };
}

// --- スポット注文 API ---

export interface SpotOrderResult {
  orderId: string;
  clientOid?: string;
}

/**
 * スポット成行買い（金額指定: quoteAmount USD分を購入）
 * PAPER_TRADING=true の場合は実際のAPIを呼ばずモック成功を返す（取引テスト用）
 */
export async function placeSpotMarketBuy(
  credentials: BitgetCredentials,
  symbol: string,
  quoteAmount: string
): Promise<{ success: boolean; data?: SpotOrderResult; error?: string }> {
  if (process.env.PAPER_TRADING === "true") {
    console.log(`[PAPER] Would BUY ${symbol} $${quoteAmount}`);
    return {
      success: true,
      data: { orderId: `paper-buy-${Date.now()}`, clientOrderId: "" },
    };
  }

  const body = JSON.stringify({
    symbol,
    side: "buy",
    orderType: "market",
    size: quoteAmount,
    force: "gtc",
  });

  const result = await bitgetRequest(
    credentials,
    "POST",
    "/api/v2/spot/trade/place-order",
    body
  );
  return result as { success: boolean; data?: SpotOrderResult; error?: string };
}

/**
 * スポット成行売り（数量指定: quantity 分を売却）
 * PAPER_TRADING=true の場合は実際のAPIを呼ばずモック成功を返す（取引テスト用）
 */
export async function placeSpotMarketSell(
  credentials: BitgetCredentials,
  symbol: string,
  quantity: string
): Promise<{ success: boolean; data?: SpotOrderResult; error?: string }> {
  if (process.env.PAPER_TRADING === "true") {
    console.log(`[PAPER] Would SELL ${symbol} qty=${quantity}`);
    return {
      success: true,
      data: { orderId: `paper-sell-${Date.now()}`, clientOrderId: "" },
    };
  }

  const body = JSON.stringify({
    symbol,
    side: "sell",
    orderType: "market",
    size: quantity,
    force: "gtc",
  });

  const result = await bitgetRequest(
    credentials,
    "POST",
    "/api/v2/spot/trade/place-order",
    body
  );
  return result as { success: boolean; data?: SpotOrderResult; error?: string };
}

export interface SpotTickerPrice {
  symbol: string;
  lastPr: string;
  askPr: string;
  bidPr: string;
  high24h: string;
  low24h: string;
  ts: string;
}

/**
 * スポット価格取得（単一シンボル）
 */
export async function fetchSpotTickerPrice(
  symbol: string
): Promise<{ success: boolean; data?: SpotTickerPrice; error?: string }> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/v2/spot/market/tickers?symbol=${symbol}`
    );
    const json = await res.json();
    if (json.code === "00000" && json.data?.length > 0) {
      return { success: true, data: json.data[0] };
    }
    return { success: false, error: json.msg || "No data" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * 複数シンボルの価格を一括取得
 */
export async function fetchSpotTickerPrices(
  symbols: string[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  try {
    const res = await fetch(`${BASE_URL}/api/v2/spot/market/tickers`);
    const json = await res.json();
    if (json.code === "00000" && Array.isArray(json.data)) {
      const symbolSet = new Set(symbols);
      for (const ticker of json.data) {
        if (symbolSet.has(ticker.symbol)) {
          priceMap.set(ticker.symbol, parseFloat(ticker.lastPr));
        }
      }
    }
  } catch (err) {
    console.error("[Bitget] Failed to fetch ticker prices:", err);
  }

  return priceMap;
}

/**
 * Bitget 上のスポットシンボル一覧を取得（シンボル名の検証用）
 */
export async function fetchSpotSymbols(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/v2/spot/public/symbols`);
    const json = await res.json();
    if (json.code === "00000" && Array.isArray(json.data)) {
      return json.data.map((s: { symbol: string }) => s.symbol);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * 注文の詳細を取得
 */
export async function fetchSpotOrderDetail(
  credentials: BitgetCredentials,
  orderId: string
): Promise<{ success: boolean; data?: Record<string, string>; error?: string }> {
  const result = await bitgetRequest(
    credentials,
    "GET",
    `/api/v2/spot/trade/orderInfo?orderId=${orderId}`
  );
  return result as { success: boolean; data?: Record<string, string>; error?: string };
}
