"use client";

import { useState, useEffect, useCallback } from "react";

interface GatewayInfo {
  online: boolean;
  url: string;
  error?: string;
}

interface AgentStatusData {
  success: boolean;
  gateway: GatewayInfo;
  balance: unknown;
  balanceError?: string;
}

export default function AgentStatus() {
  const [data, setData] = useState<AgentStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/status");
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return <div className="h-20 animate-pulse rounded-lg bg-zinc-200" />;
  }

  const online = data?.gateway?.online ?? false;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                online ? "bg-green-500 animate-pulse" : "bg-zinc-300"
              }`}
            />
            <h3 className="font-medium">AI エージェント</h3>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              online
                ? "bg-green-100 text-green-700"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {online ? "オンライン" : "オフライン"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
          >
            更新
          </button>
          <a
            href="/settings/agent"
            className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
          >
            制御パネル
          </a>
        </div>
      </div>
      {!online && data?.gateway?.error && (
        <div className="border-t border-zinc-100 px-6 py-3">
          <p className="text-xs text-zinc-500">
            Gateway ({data.gateway.url}) に接続できません。
            <a
              href="/doc/openclaw-setup.md"
              className="ml-1 text-blue-600 underline"
            >
              セットアップ手順
            </a>
            を確認してください。
          </p>
        </div>
      )}
    </div>
  );
}
