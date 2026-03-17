"use client";

import { useState, useEffect, useCallback } from "react";

interface RiskSettings {
  maxPositionSizePct: number;
  maxDailyLoss: number;
  maxLeverage: number;
  maxOpenPositions: number;
  defaultStopLossPct: number;
  defaultTakeProfitPct: number;
  tradingEnabled: boolean;
}

export default function RiskSummary() {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/risk-settings");
      const json = await res.json();
      if (json.success) {
        setSettings(json.settings);
        setIsDefault(json.isDefault);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-lg bg-zinc-200" />
    );
  }

  if (!settings) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <h3 className="font-medium">リスク管理</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              settings.tradingEnabled
                ? "bg-green-100 text-green-700"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {settings.tradingEnabled ? "自動売買 ON" : "自動売買 OFF"}
          </span>
          {isDefault && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              未設定
            </span>
          )}
        </div>
        <a
          href="/settings/risk"
          className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50"
        >
          設定変更
        </a>
      </div>
      <div className="grid grid-cols-3 gap-4 p-6 md:grid-cols-6">
        <div className="text-center">
          <p className="text-xs text-zinc-400">最大ポジション</p>
          <p className="mt-1 text-lg font-semibold">{settings.maxPositionSizePct}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-400">日次損失上限</p>
          <p className="mt-1 text-lg font-semibold">${settings.maxDailyLoss}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-400">最大レバ</p>
          <p className="mt-1 text-lg font-semibold">{settings.maxLeverage}x</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-400">同時ポジション</p>
          <p className="mt-1 text-lg font-semibold">{settings.maxOpenPositions}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-400">損切り</p>
          <p className="mt-1 text-lg font-semibold text-red-600">{settings.defaultStopLossPct}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-400">利確</p>
          <p className="mt-1 text-lg font-semibold text-green-600">{settings.defaultTakeProfitPct}%</p>
        </div>
      </div>
    </div>
  );
}
