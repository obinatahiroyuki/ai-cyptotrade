"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Target {
  round: number;
  price: number;
  achieved: boolean;
}

interface Position {
  id: string;
  symbol: string;
  bitgetSymbol: string;
  entryPrice: number;
  currentStopLoss: number;
  currentRound: number;
  totalQuantity: number;
  totalInvested: number;
  status: string;
  realizedPnl: number | null;
  openedAt: string;
  closedAt: string | null;
  targets: Target[] | null;
  longTermTarget: number | null;
}

interface Trade {
  id: string;
  action: string;
  price: number;
  quantity: number;
  amountUsd: number;
  roundAtTrade: number;
  reason: string;
  createdAt: string;
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "closed">("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = tab === "active" ? "active" : "closed";
      const res = await fetch(`/api/positions?status=${statusParam}`);
      const json = await res.json();
      setPositions(json.positions ?? []);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const loadTrades = async (posId: string) => {
    if (selectedId === posId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(posId);
    setTradesLoading(true);
    try {
      const res = await fetch(`/api/positions/${posId}/trades`);
      const json = await res.json();
      setTrades(json.trades ?? []);
    } catch {
      setTrades([]);
    } finally {
      setTradesLoading(false);
    }
  };

  const closePosition = async (posId: string, symbol: string) => {
    if (!confirm(`${symbol} のポジションを手動利確しますか？\n全量を現在の市場価格で売却します。`)) return;
    setClosing(posId);
    try {
      const res = await fetch(`/api/positions/${posId}/close`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        alert(`${symbol} を利確しました\n価格: $${json.price}\n損益: $${json.realizedPnl?.toFixed(2)}`);
        fetchPositions();
      } else {
        alert(`エラー: ${json.error}`);
      }
    } catch {
      alert("通信エラー");
    } finally {
      setClosing(null);
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      active: { text: "アクティブ", color: "bg-green-100 text-green-700" },
      closed_stoploss: { text: "損切り", color: "bg-red-100 text-red-700" },
      closed_manual: { text: "手動利確", color: "bg-blue-100 text-blue-700" },
      closed_target: { text: "利確", color: "bg-emerald-100 text-emerald-700" },
    };
    const m = map[status] ?? { text: status, color: "bg-zinc-100 text-zinc-600" };
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.color}`}>{m.text}</span>;
  };

  const actionLabel = (action: string) => {
    const map: Record<string, { text: string; color: string }> = {
      buy_entry: { text: "新規買い", color: "text-blue-600" },
      buy_add: { text: "追加買い", color: "text-indigo-600" },
      sell_stoploss: { text: "損切り売り", color: "text-red-600" },
      sell_manual: { text: "手動売り", color: "text-orange-600" },
      sell_target: { text: "目標売り", color: "text-green-600" },
    };
    const m = map[action] ?? { text: action, color: "text-zinc-600" };
    return <span className={`font-medium ${m.color}`}>{m.text}</span>;
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">&larr; ダッシュボード</Link>
          <h1 className="text-xl font-semibold">ポジション管理</h1>
        </div>
      </header>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex gap-2">
            {(["active", "closed"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelectedId(null); }}
                className={`rounded-lg border px-4 py-1.5 text-sm ${tab === t ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-zinc-300 hover:bg-zinc-50"}`}
              >
                {t === "active" ? "アクティブ" : "クローズ済み"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-400">
              読み込み中...
            </div>
          ) : positions.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-400">
              {tab === "active" ? "アクティブなポジションはありません" : "クローズ済みのポジションはありません"}
            </div>
          ) : (
            <div className="space-y-3">
              {positions.map((pos) => {
                const unrealizedPnlPct = pos.entryPrice > 0
                  ? ((pos.currentStopLoss - pos.entryPrice) / pos.entryPrice * 100)
                  : 0;

                return (
                  <div key={pos.id} className="rounded-xl border border-zinc-200 bg-white">
                    <button
                      onClick={() => loadTrades(pos.id)}
                      className="flex w-full items-center justify-between p-4 text-left hover:bg-zinc-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold">{pos.symbol}</span>
                        {statusLabel(pos.status)}
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono">
                          回数: {pos.currentRound}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-zinc-400">投資額</p>
                          <p className="font-mono font-medium">${pos.totalInvested.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-zinc-400">損切りライン</p>
                          <p className="font-mono text-red-600">${pos.currentStopLoss}</p>
                        </div>
                        {pos.realizedPnl !== null && (
                          <div className="text-right">
                            <p className="text-zinc-400">損益</p>
                            <p className={`font-mono font-medium ${pos.realizedPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                              ${pos.realizedPnl.toFixed(2)}
                            </p>
                          </div>
                        )}
                        <span className="text-zinc-300">{selectedId === pos.id ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {selectedId === pos.id && (
                      <div className="border-t border-zinc-100 p-4">
                        <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          <div>
                            <span className="text-zinc-400">エントリー価格</span>
                            <p className="font-mono">${pos.entryPrice}</p>
                          </div>
                          <div>
                            <span className="text-zinc-400">数量</span>
                            <p className="font-mono">{pos.totalQuantity.toFixed(4)}</p>
                          </div>
                          <div>
                            <span className="text-zinc-400">損切りからの利益率</span>
                            <p className={`font-mono ${unrealizedPnlPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {unrealizedPnlPct.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-400">開始日</span>
                            <p className="text-xs">{pos.openedAt}</p>
                          </div>
                        </div>

                        {pos.targets && pos.targets.length > 0 && (
                          <div className="mb-3">
                            <span className="text-xs text-zinc-400">目標達成状況</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {pos.targets.map((t) => (
                                <span
                                  key={t.round}
                                  className={`rounded px-2 py-0.5 text-xs font-mono ${
                                    t.round <= pos.currentRound
                                      ? "bg-green-100 text-green-700"
                                      : "bg-zinc-100 text-zinc-500"
                                  }`}
                                >
                                  {t.round}回: ${t.price}
                                  {t.round <= pos.currentRound ? " ✓" : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {pos.status === "active" && (
                          <div className="mb-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); closePosition(pos.id, pos.symbol); }}
                              disabled={closing === pos.id}
                              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {closing === pos.id ? "決済中..." : "手動利確（全量売却）"}
                            </button>
                            <p className="mt-1 text-xs text-zinc-400">
                              現在の市場価格で全量を成行売りします
                            </p>
                          </div>
                        )}

                        <h4 className="mb-2 text-sm font-medium text-zinc-600">売買履歴</h4>
                        {tradesLoading ? (
                          <p className="text-sm text-zinc-400">読み込み中...</p>
                        ) : trades.length === 0 ? (
                          <p className="text-sm text-zinc-400">履歴なし</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-zinc-100 text-zinc-400">
                                  <th className="pb-1 pr-3">日時</th>
                                  <th className="pb-1 pr-3">アクション</th>
                                  <th className="pb-1 pr-3">価格</th>
                                  <th className="pb-1 pr-3">数量</th>
                                  <th className="pb-1 pr-3">金額</th>
                                  <th className="pb-1 pr-3">回数</th>
                                  <th className="pb-1">理由</th>
                                </tr>
                              </thead>
                              <tbody>
                                {trades.map((tr) => (
                                  <tr key={tr.id} className="border-b border-zinc-50">
                                    <td className="py-1.5 pr-3 text-zinc-500">{tr.createdAt}</td>
                                    <td className="py-1.5 pr-3">{actionLabel(tr.action)}</td>
                                    <td className="py-1.5 pr-3 font-mono">${tr.price}</td>
                                    <td className="py-1.5 pr-3 font-mono">{tr.quantity.toFixed(4)}</td>
                                    <td className="py-1.5 pr-3 font-mono">${tr.amountUsd.toFixed(2)}</td>
                                    <td className="py-1.5 pr-3">{tr.roundAtTrade}</td>
                                    <td className="py-1.5 text-zinc-500">{tr.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
