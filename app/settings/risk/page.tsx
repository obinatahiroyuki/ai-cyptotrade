"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface RiskSettings {
  maxPositionSizePct: number;
  maxDailyLoss: number;
  maxLeverage: number;
  maxOpenPositions: number;
  defaultStopLossPct: number;
  defaultTakeProfitPct: number;
  tradingEnabled: boolean;
}

const FIELD_CONFIG = [
  {
    key: "maxPositionSizePct" as const,
    label: "最大ポジションサイズ",
    unit: "% (総資産比)",
    description: "1回のエントリーに使う資金の上限",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "maxDailyLoss" as const,
    label: "1日の最大損失額",
    unit: "USDT",
    description: "この金額を超えると当日のトレードを停止",
    min: 1,
    max: 100000,
    step: 10,
  },
  {
    key: "maxLeverage" as const,
    label: "最大レバレッジ",
    unit: "倍",
    description: "先物ポジションで許可するレバレッジの上限",
    min: 1,
    max: 125,
    step: 1,
  },
  {
    key: "maxOpenPositions" as const,
    label: "最大同時ポジション数",
    unit: "個",
    description: "同時に保有できるポジション数の上限",
    min: 1,
    max: 50,
    step: 1,
  },
  {
    key: "defaultStopLossPct" as const,
    label: "デフォルト損切り",
    unit: "%",
    description: "エントリー価格からの損切りライン",
    min: 0.1,
    max: 50,
    step: 0.5,
  },
  {
    key: "defaultTakeProfitPct" as const,
    label: "デフォルト利確",
    unit: "%",
    description: "エントリー価格からの利確ライン",
    min: 0.1,
    max: 100,
    step: 0.5,
  },
] as const;

export default function RiskSettingsPage() {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const [isDefault, setIsDefault] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/risk-settings");
      const json = await res.json();
      if (json.success) {
        setSettings(json.settings);
        setIsDefault(json.isDefault);
      }
    } catch {
      setStatus({ type: "error", message: "設定の読み込みに失敗しました" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch("/api/risk-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.settings);
        setIsDefault(false);
        setStatus({ type: "success", message: "リスク設定を保存しました" });
      } else {
        setStatus({ type: "error", message: json.error || "保存に失敗しました" });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "保存に失敗しました",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof RiskSettings, value: number | boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setStatus({ type: "idle" });
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-2xl">
          <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
          <div className="mt-8 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">リスク管理設定</h1>
            <p className="mt-1 text-sm text-zinc-600">
              自動売買のリスクパラメータを設定します。
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            ← ダッシュボード
          </Link>
        </div>

        {isDefault && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            デフォルトの設定値が表示されています。運用開始前に確認・保存してください。
          </div>
        )}

        {/* 自動売買の有効/無効 */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">自動売買</h2>
              <p className="mt-1 text-sm text-zinc-500">
                有効にすると、エージェントが設定に基づいて自動で取引を実行します。
              </p>
            </div>
            <button
              onClick={() => updateField("tradingEnabled", !settings.tradingEnabled)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                settings.tradingEnabled ? "bg-green-500" : "bg-zinc-300"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                  settings.tradingEnabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {settings.tradingEnabled && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              自動売買が有効です。設定したリスクパラメータに基づいてエージェントが取引を行います。
            </div>
          )}
        </div>

        {/* リスクパラメータ */}
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-4">
            <h2 className="text-lg font-medium">リスクパラメータ</h2>
          </div>
          <div className="divide-y divide-zinc-100">
            {FIELD_CONFIG.map((field) => {
              const value = settings[field.key] as number;
              return (
                <div key={field.key} className="px-6 py-5">
                  <div className="flex items-start justify-between gap-8">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-zinc-900">
                        {field.label}
                      </label>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {field.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) updateField(field.key, v);
                        }}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-right text-sm font-mono"
                      />
                      <span className="w-16 text-sm text-zinc-500">
                        {field.unit}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <input
                      type="range"
                      value={value}
                      onChange={(e) => updateField(field.key, parseFloat(e.target.value))}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      className="w-full accent-zinc-900"
                    />
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>{field.min}{field.unit}</span>
                      <span>{field.max}{field.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ステータス表示 */}
        {status.type === "success" && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {status.message}
          </div>
        )}
        {status.type === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {status.message}
          </div>
        )}

        {/* 保存ボタン */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            設定はエージェント連携後に自動売買ルールとして適用されます。
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "保存中..." : "設定を保存"}
          </button>
        </div>

        {/* 注意事項 */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>注意:</strong>{" "}
          リスク設定は資金を保護するための上限値です。実際の取引ではこれらの制限内で動作しますが、
          市場の急変時にはスリッページ等により設定値を超える損失が発生する可能性があります。
        </div>
      </div>
    </div>
  );
}
