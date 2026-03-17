"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Signal {
  id: string;
  signalType: string;
  symbol: string;
  entryPriceLow: number | null;
  entryPriceHigh: number | null;
  referencePrice: number | null;
  stopLossPrice: number | null;
  targets: { round: number; price: number; achieved: boolean }[] | null;
  longTermTarget: number | null;
  status: string;
  createdAt: string;
}

type FilterStatus = "" | "new" | "active" | "completed" | "skipped";

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("");

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      params.set("limit", "100");
      const res = await fetch(`/api/signals?${params}`);
      const json = await res.json();
      setSignals(json.signals ?? []);
    } catch {
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-700",
      active: "bg-green-100 text-green-700",
      completed: "bg-zinc-100 text-zinc-600",
      skipped: "bg-yellow-100 text-yellow-700",
    };
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-zinc-100 text-zinc-600"}`}>
        {status}
      </span>
    );
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      entry: "bg-indigo-100 text-indigo-700",
      achievement: "bg-amber-100 text-amber-700",
      other: "bg-zinc-100 text-zinc-500",
    };
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] ?? "bg-zinc-100"}`}>
        {type === "entry" ? "エントリー" : type === "achievement" ? "達成" : "その他"}
      </span>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">&larr; ダッシュボード</Link>
          <h1 className="text-xl font-semibold">シグナル一覧</h1>
        </div>
      </header>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-zinc-500">フィルター:</span>
            {(["", "new", "active", "completed", "skipped"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-lg border px-3 py-1 text-sm ${filter === s ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-zinc-300 hover:bg-zinc-50"}`}
              >
                {s === "" ? "すべて" : s === "new" ? "新規" : s === "active" ? "アクティブ" : s === "completed" ? "完了" : "スキップ"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-400">
              読み込み中...
            </div>
          ) : signals.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-400">
              シグナルがありません
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map((sig) => (
                <div key={sig.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">{sig.symbol}</span>
                      {typeBadge(sig.signalType)}
                      {statusBadge(sig.status)}
                    </div>
                    <span className="text-xs text-zinc-400">{sig.createdAt}</span>
                  </div>

                  {sig.signalType === "entry" && (
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                      <div>
                        <span className="text-zinc-400">参考価格</span>
                        <p className="font-mono font-medium">${sig.referencePrice}</p>
                      </div>
                      <div>
                        <span className="text-zinc-400">価格帯</span>
                        <p className="font-mono">${sig.entryPriceLow} ~ ${sig.entryPriceHigh}</p>
                      </div>
                      <div>
                        <span className="text-zinc-400">損切り</span>
                        <p className="font-mono text-red-600">${sig.stopLossPrice}</p>
                      </div>
                      <div>
                        <span className="text-zinc-400">長期目標</span>
                        <p className="font-mono text-green-600">${sig.longTermTarget ?? "-"}</p>
                      </div>

                      {sig.targets && sig.targets.length > 0 && (
                        <div className="col-span-full mt-2">
                          <span className="text-zinc-400">利確目標</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {sig.targets.map((t) => (
                              <span
                                key={t.round}
                                className={`rounded px-2 py-0.5 text-xs font-mono ${t.achieved ? "bg-green-100 text-green-700 line-through" : "bg-zinc-100 text-zinc-600"}`}
                              >
                                {t.round}回: ${t.price}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
