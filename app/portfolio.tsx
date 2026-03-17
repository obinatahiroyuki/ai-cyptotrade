"use client";

import { useState, useEffect, useCallback } from "react";

interface SpotAsset {
  coin: string;
  available: string;
  frozen: string;
  locked: string;
}

interface FuturesPosition {
  symbol: string;
  marginCoin: string;
  holdSide: "long" | "short";
  total: string;
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
}

interface PortfolioData {
  success: boolean;
  needsSetup?: boolean;
  error?: string;
  spot?: { assets: SpotAsset[]; error?: string };
  futures?: { positions: FuturesPosition[]; error?: string };
}

export default function Portfolio() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio");
      const json = await res.json();
      setData(json);
    } catch {
      setData({ success: false, error: "データの取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-48 animate-pulse rounded-lg bg-zinc-200" />
      </div>
    );
  }

  if (!data?.success) {
    if (data?.needsSetup) {
      return (
        <div className="rounded-lg border-2 border-dashed border-zinc-300 p-8 text-center">
          <p className="text-sm text-zinc-500">
            Bitget API キーが登録されていません。
          </p>
          <a
            href="/settings/exchange"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Bitget 連携設定
          </a>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {data?.error || "データの取得に失敗しました"}
      </div>
    );
  }

  const spotAssets = data.spot?.assets ?? [];
  const futuresPositions = data.futures?.positions ?? [];

  return (
    <div className="space-y-6">
      {/* スポット残高 */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h3 className="font-medium">スポット残高</h3>
          <button
            onClick={fetchPortfolio}
            className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
          >
            更新
          </button>
        </div>
        <div className="p-6">
          {data.spot?.error && (
            <p className="mb-3 text-xs text-amber-600">
              スポット取得エラー: {data.spot.error}
            </p>
          )}
          {spotAssets.length === 0 ? (
            <p className="text-sm text-zinc-400">保有資産はありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                    <th className="pb-2 font-medium">通貨</th>
                    <th className="pb-2 text-right font-medium">利用可能</th>
                    <th className="pb-2 text-right font-medium">凍結</th>
                  </tr>
                </thead>
                <tbody>
                  {spotAssets.map((asset) => (
                    <tr
                      key={asset.coin}
                      className="border-b border-zinc-50 last:border-0"
                    >
                      <td className="py-3 font-medium uppercase">
                        {asset.coin}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {formatNumber(asset.available)}
                      </td>
                      <td className="py-3 text-right font-mono text-zinc-400">
                        {parseFloat(asset.frozen) > 0
                          ? formatNumber(asset.frozen)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 先物ポジション */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h3 className="font-medium">先物ポジション (USDT-M)</h3>
        </div>
        <div className="p-6">
          {data.futures?.error && (
            <p className="mb-3 text-xs text-amber-600">
              先物取得エラー: {data.futures.error}
            </p>
          )}
          {futuresPositions.length === 0 ? (
            <p className="text-sm text-zinc-400">
              オープンポジションはありません
            </p>
          ) : (
            <div className="space-y-4">
              {futuresPositions.map((pos, i) => {
                const pnl = parseFloat(pos.unrealizedPL);
                const isProfit = pnl >= 0;
                const entryPrice = parseFloat(pos.openPriceAvg);
                const currentPrice = parseFloat(pos.markPrice);
                const pnlPercent =
                  entryPrice > 0
                    ? ((currentPrice - entryPrice) / entryPrice) *
                      100 *
                      (pos.holdSide === "long" ? 1 : -1)
                    : 0;

                return (
                  <div
                    key={`${pos.symbol}-${pos.holdSide}-${i}`}
                    className="rounded-lg border border-zinc-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pos.symbol}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            pos.holdSide === "long"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {pos.holdSide === "long" ? "ロング" : "ショート"}
                        </span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                          {pos.leverage}x
                        </span>
                        <span className="text-xs text-zinc-400">
                          {pos.marginMode === "crossed" ? "クロス" : "分離"}
                        </span>
                      </div>
                      <span
                        className={`text-lg font-semibold ${
                          isProfit ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {isProfit ? "+" : ""}
                        {formatNumber(pos.unrealizedPL)} {pos.marginCoin}
                        <span className="ml-1 text-sm">
                          ({isProfit ? "+" : ""}
                          {pnlPercent.toFixed(2)}%)
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
                      <div>
                        <span className="text-xs text-zinc-400">数量</span>
                        <p className="font-mono">{pos.total}</p>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400">
                          平均取得価格
                        </span>
                        <p className="font-mono">
                          {formatNumber(pos.openPriceAvg)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400">現在価格</span>
                        <p className="font-mono">
                          {formatNumber(pos.markPrice)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400">証拠金</span>
                        <p className="font-mono">
                          {formatNumber(pos.marginSize)} {pos.marginCoin}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400">
                          清算価格
                        </span>
                        <p className="font-mono">
                          {parseFloat(pos.liquidationPrice) > 0
                            ? formatNumber(pos.liquidationPrice)
                            : "低リスク"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400">
                          実現損益
                        </span>
                        <p className="font-mono">
                          {formatNumber(pos.achievedProfits)} {pos.marginCoin}
                        </p>
                      </div>
                      {pos.takeProfit && (
                        <div>
                          <span className="text-xs text-zinc-400">TP</span>
                          <p className="font-mono text-green-600">
                            {formatNumber(pos.takeProfit)}
                          </p>
                        </div>
                      )}
                      {pos.stopLoss && (
                        <div>
                          <span className="text-xs text-zinc-400">SL</span>
                          <p className="font-mono text-red-600">
                            {formatNumber(pos.stopLoss)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatNumber(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (Math.abs(num) >= 1000) return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (Math.abs(num) >= 1) return num.toFixed(4);
  return num.toPrecision(4);
}
