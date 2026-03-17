"use client";

import { useEffect, useState } from "react";

interface Summary {
  newCount: number;
  activeCount: number;
  completedCount: number;
  activePositions: number;
}

export default function SignalSummary() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sigRes, posRes] = await Promise.all([
          fetch("/api/signals?limit=200"),
          fetch("/api/positions?status=active"),
        ]);
        const sigJson = await sigRes.json();
        const posJson = await posRes.json();

        const signals = sigJson.signals ?? [];
        setData({
          newCount: signals.filter((s: { status: string }) => s.status === "new").length,
          activeCount: signals.filter((s: { status: string }) => s.status === "active").length,
          completedCount: signals.filter((s: { status: string }) => s.status === "completed").length,
          activePositions: (posJson.positions ?? []).length,
        });
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-400">シグナル情報を読み込み中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-400">シグナル情報を取得できません</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700">シグナル / ポジション</h3>
        <div className="flex gap-2">
          <a
            href="/signals"
            className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
          >
            シグナル一覧
          </a>
          <a
            href="/positions"
            className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
          >
            ポジション
          </a>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-blue-600">{data.newCount}</p>
          <p className="text-xs text-zinc-400">新規シグナル</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">{data.activeCount}</p>
          <p className="text-xs text-zinc-400">アクティブ</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-zinc-500">{data.completedCount}</p>
          <p className="text-xs text-zinc-400">完了</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-indigo-600">{data.activePositions}</p>
          <p className="text-xs text-zinc-400">保有中</p>
        </div>
      </div>
    </div>
  );
}
