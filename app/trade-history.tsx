"use client";

import { useState, useEffect, useCallback } from "react";

interface SpotFill {
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
}

interface FuturesOrder {
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
  totalProfits: string;
  status: string;
  cTime: string;
}

interface TradeHistoryData {
  success: boolean;
  needsSetup?: boolean;
  error?: string;
  spot?: { fills: SpotFill[]; error?: string };
  futures?: { orders: FuturesOrder[]; error?: string };
}

type Tab = "spot" | "futures";

export default function TradeHistory() {
  const [data, setData] = useState<TradeHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("spot");
  const [days, setDays] = useState(7);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trade-history?days=${days}&limit=50`);
      const json = await res.json();
      setData(json);
    } catch {
      setData({ success: false, error: "データの取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h3 className="font-medium">取引履歴</h3>
        </div>
        <div className="p-6">
          <div className="h-48 animate-pulse rounded bg-zinc-200" />
        </div>
      </div>
    );
  }

  if (!data?.success) {
    if (data?.needsSetup) return null;
    return (
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h3 className="font-medium">取引履歴</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-red-600">
            {data?.error || "データの取得に失敗しました"}
          </p>
        </div>
      </div>
    );
  }

  const spotFills = data.spot?.fills ?? [];
  const futuresOrders = data.futures?.orders ?? [];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
        <h3 className="font-medium">取引履歴</h3>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border border-zinc-300 px-2 py-1 text-xs"
          >
            <option value={1}>1日</option>
            <option value={7}>7日</option>
            <option value={30}>30日</option>
            <option value={90}>90日</option>
          </select>
          <button
            onClick={fetchHistory}
            className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
          >
            更新
          </button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-zinc-100">
        <button
          onClick={() => setTab("spot")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            tab === "spot"
              ? "border-b-2 border-zinc-900 text-zinc-900"
              : "text-zinc-400 hover:text-zinc-600"
          }`}
        >
          スポット ({spotFills.length})
        </button>
        <button
          onClick={() => setTab("futures")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            tab === "futures"
              ? "border-b-2 border-zinc-900 text-zinc-900"
              : "text-zinc-400 hover:text-zinc-600"
          }`}
        >
          先物 ({futuresOrders.length})
        </button>
      </div>

      <div className="p-6">
        {tab === "spot" && (
          <>
            {data.spot?.error && (
              <p className="mb-3 text-xs text-amber-600">
                スポット履歴エラー: {data.spot.error}
              </p>
            )}
            {spotFills.length === 0 ? (
              <p className="text-sm text-zinc-400">取引履歴はありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                      <th className="pb-2 font-medium">日時</th>
                      <th className="pb-2 font-medium">ペア</th>
                      <th className="pb-2 font-medium">売買</th>
                      <th className="pb-2 font-medium">タイプ</th>
                      <th className="pb-2 text-right font-medium">価格</th>
                      <th className="pb-2 text-right font-medium">数量</th>
                      <th className="pb-2 text-right font-medium">金額</th>
                      <th className="pb-2 text-right font-medium">手数料</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spotFills.map((fill) => (
                      <tr
                        key={fill.tradeId}
                        className="border-b border-zinc-50 last:border-0"
                      >
                        <td className="whitespace-nowrap py-3 text-xs text-zinc-500">
                          {formatTime(fill.cTime)}
                        </td>
                        <td className="py-3 font-medium">{fill.symbol}</td>
                        <td className="py-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              fill.side === "buy"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {fill.side === "buy" ? "買い" : "売り"}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-zinc-500">
                          {fill.orderType}
                        </td>
                        <td className="py-3 text-right font-mono">
                          {formatNumber(fill.priceAvg)}
                        </td>
                        <td className="py-3 text-right font-mono">
                          {formatNumber(fill.size)}
                        </td>
                        <td className="py-3 text-right font-mono">
                          {formatNumber(fill.amount)}
                        </td>
                        <td className="py-3 text-right font-mono text-zinc-400">
                          {fill.feeDetail.totalFee} {fill.feeDetail.feeCoin}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "futures" && (
          <>
            {data.futures?.error && (
              <p className="mb-3 text-xs text-amber-600">
                先物履歴エラー: {data.futures.error}
              </p>
            )}
            {futuresOrders.length === 0 ? (
              <p className="text-sm text-zinc-400">取引履歴はありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                      <th className="pb-2 font-medium">日時</th>
                      <th className="pb-2 font-medium">ペア</th>
                      <th className="pb-2 font-medium">方向</th>
                      <th className="pb-2 font-medium">タイプ</th>
                      <th className="pb-2 text-right font-medium">約定価格</th>
                      <th className="pb-2 text-right font-medium">数量</th>
                      <th className="pb-2 text-right font-medium">
                        レバレッジ
                      </th>
                      <th className="pb-2 text-right font-medium">損益</th>
                      <th className="pb-2 text-right font-medium">手数料</th>
                      <th className="pb-2 font-medium">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {futuresOrders.map((order) => {
                      const pnl = parseFloat(order.totalProfits);
                      return (
                        <tr
                          key={order.orderId}
                          className="border-b border-zinc-50 last:border-0"
                        >
                          <td className="whitespace-nowrap py-3 text-xs text-zinc-500">
                            {formatTime(order.cTime)}
                          </td>
                          <td className="py-3 font-medium">{order.symbol}</td>
                          <td className="py-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                order.side === "buy"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {formatFuturesSide(order)}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-zinc-500">
                            {order.orderType}
                          </td>
                          <td className="py-3 text-right font-mono">
                            {formatNumber(order.priceAvg)}
                          </td>
                          <td className="py-3 text-right font-mono">
                            {order.baseVolume || order.size}
                          </td>
                          <td className="py-3 text-right font-mono">
                            {order.leverage}x
                          </td>
                          <td
                            className={`py-3 text-right font-mono ${
                              pnl > 0
                                ? "text-green-600"
                                : pnl < 0
                                  ? "text-red-600"
                                  : "text-zinc-400"
                            }`}
                          >
                            {pnl !== 0
                              ? `${pnl > 0 ? "+" : ""}${formatNumber(order.totalProfits)}`
                              : "-"}
                          </td>
                          <td className="py-3 text-right font-mono text-zinc-400">
                            {order.fee} {order.marginCoin}
                          </td>
                          <td className="py-3">
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs ${
                                order.status === "filled"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-zinc-100 text-zinc-500"
                              }`}
                            >
                              {order.status === "filled"
                                ? "約定"
                                : order.status === "canceled"
                                  ? "キャンセル"
                                  : order.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatNumber(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (Math.abs(num) >= 1000)
    return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (Math.abs(num) >= 1) return num.toFixed(4);
  return num.toPrecision(4);
}

function formatTime(timestamp: string): string {
  const ms =
    timestamp.length <= 10
      ? parseInt(timestamp) * 1000
      : parseInt(timestamp);
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFuturesSide(order: FuturesOrder): string {
  if (order.tradeSide === "open") {
    return order.posSide === "long" ? "ロング開" : "ショート開";
  }
  if (order.tradeSide === "close") {
    return order.posSide === "long" ? "ロング決済" : "ショート決済";
  }
  return order.side === "buy" ? "買い" : "売り";
}
