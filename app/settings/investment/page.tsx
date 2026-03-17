"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Settings {
  initialAmount: number;
  incrementAmount: number;
  maxInvestmentPerPosition: number;
  autoTradeEnabled: boolean;
  maxPortfolioPct: number;
  tradeCurrency: string;
  profitMode: string;
  pyramidMaxPct: number;
  interestMode: string;
  compoundCurrentRound: number;
  isDefault?: boolean;
}

const DEFAULTS: Settings = {
  initialAmount: 1.0,
  incrementAmount: 0.5,
  maxInvestmentPerPosition: 100.0,
  autoTradeEnabled: false,
  maxPortfolioPct: 25,
  tradeCurrency: "USD",
  profitMode: "pyramid",
  pyramidMaxPct: 100,
  interestMode: "simple",
  compoundCurrentRound: 1,
};

export default function InvestmentSettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investment-settings");
      const json = await res.json();
      setS({ ...DEFAULTS, ...json });
    } catch { /* keep defaults */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/investment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const json = await res.json();
      setS({ ...DEFAULTS, ...json });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
  };

  const currencySymbol = s.tradeCurrency === "JPY" ? "¥" : "$";

  const calcTradeAmount = (round: number) => {
    if (s.interestMode === "simple") return s.initialAmount;
    return s.initialAmount + s.incrementAmount * (round - 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center gap-4 border-b border-zinc-200 bg-white px-6 py-4">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">&larr; ダッシュボード</Link>
        <h1 className="text-xl font-semibold">投資設定</h1>
      </header>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* 自動売買 */}
          <Section>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">自動売買</h3>
                <p className="text-sm text-zinc-500">
                  Discord シグナル受信時に自動で注文を実行します
                </p>
              </div>
              <Toggle checked={s.autoTradeEnabled} onChange={(v) => update("autoTradeEnabled", v)} />
            </div>
          </Section>

          {/* ポートフォリオ上限 */}
          <Section>
            <h3 className="font-medium">ポートフォリオ投資上限</h3>
            <p className="mb-3 text-sm text-zinc-500">総資産に対する最大投資比率</p>
            <div className="flex items-center gap-4">
              <input
                type="range" min={25} max={50} step={1}
                value={s.maxPortfolioPct}
                onChange={(e) => update("maxPortfolioPct", parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="w-16 text-right font-mono text-lg font-bold">{s.maxPortfolioPct}%</span>
            </div>
          </Section>

          {/* 通貨・1回の投資額 */}
          <Section>
            <h3 className="mb-3 font-medium">1回の投資額</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-600">通貨</label>
                <select
                  value={s.tradeCurrency}
                  onChange={(e) => update("tradeCurrency", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="USD">USD（ドル）</option>
                  <option value="JPY">JPY（円）</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-zinc-600">投資額</label>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-sm text-zinc-400">{currencySymbol}</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={s.initialAmount}
                    onChange={(e) => update("initialAmount", parseFloat(e.target.value) || 0.01)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {s.interestMode === "simple" ? "毎回この金額で投資" : "初回の投資額（複利モードで累進）"}
                </p>
              </div>
            </div>
          </Section>

          {/* 利確モード */}
          <Section>
            <h3 className="mb-3 font-medium">利確モード</h3>
            <div className="space-y-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${s.profitMode === "take_profit" ? "border-indigo-500 bg-indigo-50" : "border-zinc-200 hover:bg-zinc-50"}`}>
                <input
                  type="radio" name="profitMode" value="take_profit"
                  checked={s.profitMode === "take_profit"}
                  onChange={() => update("profitMode", "take_profit")}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium">利確モード</span>
                  <p className="text-sm text-zinc-500">10% 値上がりしたら売却して利益確定</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${s.profitMode === "pyramid" ? "border-indigo-500 bg-indigo-50" : "border-zinc-200 hover:bg-zinc-50"}`}>
                <input
                  type="radio" name="profitMode" value="pyramid"
                  checked={s.profitMode === "pyramid"}
                  onChange={() => update("profitMode", "pyramid")}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium">ピラミッディングモード（デフォルト）</span>
                  <p className="text-sm text-zinc-500">10% 値上がりごとに損切りラインを引き上げ、追加投資を行う</p>
                  <p className="mt-1 text-xs text-zinc-400">決済は損切りラインでの自動売却がデフォルト。ポジション画面から任意のタイミングで手動利確も可能です。</p>
                </div>
              </label>
            </div>

            {s.profitMode === "pyramid" && (
              <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4 space-y-3">
                <div>
                  <label className="text-sm text-zinc-600">追加投資の上限（%）</label>
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      type="range" min={10} max={1000} step={10}
                      value={s.pyramidMaxPct}
                      onChange={(e) => update("pyramidMaxPct", parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-20 text-right font-mono font-bold">{s.pyramidMaxPct}%</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    この % に達したら追加投資を停止し、損切りラインのみ引き上げ継続
                  </p>
                </div>
              </div>
            )}
          </Section>

          {/* 単利/複利モード */}
          <Section>
            <h3 className="mb-3 font-medium">投資額モード</h3>
            <div className="space-y-3">
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${s.interestMode === "simple" ? "border-indigo-500 bg-indigo-50" : "border-zinc-200 hover:bg-zinc-50"}`}>
                <input
                  type="radio" name="interestMode" value="simple"
                  checked={s.interestMode === "simple"}
                  onChange={() => update("interestMode", "simple")}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium">単利モード</span>
                  <p className="text-sm text-zinc-500">
                    毎回 {currencySymbol}{s.initialAmount.toFixed(2)} の固定額で投資
                  </p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${s.interestMode === "compound" ? "border-indigo-500 bg-indigo-50" : "border-zinc-200 hover:bg-zinc-50"}`}>
                <input
                  type="radio" name="interestMode" value="compound"
                  checked={s.interestMode === "compound"}
                  onChange={() => update("interestMode", "compound")}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium">複利モード</span>
                  <p className="text-sm text-zinc-500">
                    取引ごとに投資額を増やしていく
                  </p>
                </div>
              </label>
            </div>

            {s.interestMode === "compound" && (
              <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-zinc-600">追加増分額</label>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-sm text-zinc-400">{currencySymbol}</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={s.incrementAmount}
                        onChange={(e) => update("incrementAmount", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">毎回この金額ずつ増加</p>
                  </div>
                  <div>
                    <label className="text-sm text-zinc-600">現在の回数</label>
                    <input
                      type="number" step="1" min="1"
                      value={s.compoundCurrentRound}
                      onChange={(e) => update("compoundCurrentRound", Math.max(1, parseInt(e.target.value) || 1))}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
                    />
                    <p className="mt-1 text-xs text-zinc-400">次の新規シグナルでこの回数を使用</p>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* 1ポジション最大投資額 */}
          <Section>
            <h3 className="mb-1 font-medium">1ポジション最大投資額</h3>
            <p className="mb-3 text-sm text-zinc-500">この金額を超える追加投資は行いません</p>
            <div className="flex items-center gap-1">
              <span className="text-sm text-zinc-400">{currencySymbol}</span>
              <input
                type="number" step="1" min="1"
                value={s.maxInvestmentPerPosition}
                onChange={(e) => update("maxInvestmentPerPosition", parseFloat(e.target.value) || 1)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </Section>

          {/* プレビュー */}
          <Section>
            <h3 className="mb-3 font-medium">投資額シミュレーション</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-zinc-400">
                    <th className="pb-2 pr-4">回数</th>
                    <th className="pb-2 pr-4">投資額</th>
                    <th className="pb-2 pr-4">累計</th>
                    {s.profitMode === "pyramid" && <th className="pb-2">追加投資</th>}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.min(15, Math.ceil(s.pyramidMaxPct / 10) + 3) }, (_, i) => {
                    const round = i + 1;
                    const amount = calcTradeAmount(s.interestMode === "compound" ? s.compoundCurrentRound + i : round);
                    const cumulative = Array.from({ length: round }, (_, j) =>
                      calcTradeAmount(s.interestMode === "compound" ? s.compoundCurrentRound + j : j + 1)
                    ).reduce((a, b) => a + b, 0);
                    const pctReached = (round - 1) * 10;
                    const isPyramid = s.profitMode === "pyramid" && pctReached < s.pyramidMaxPct;
                    const label = round === 1
                      ? "初回（エントリー）"
                      : `${round - 1}回目（+${pctReached}%）`;
                    return (
                      <tr key={round} className="border-b border-zinc-50">
                        <td className="py-1.5 pr-4 text-zinc-600">{label}</td>
                        <td className="py-1.5 pr-4 font-mono">{currencySymbol}{amount.toFixed(2)}</td>
                        <td className="py-1.5 pr-4 font-mono">{currencySymbol}{cumulative.toFixed(2)}</td>
                        {s.profitMode === "pyramid" && (
                          <td className="py-1.5">
                            {round === 1 ? (
                              <span className="text-blue-600">エントリー</span>
                            ) : isPyramid ? (
                              <span className="text-green-600">あり</span>
                            ) : (
                              <span className="text-zinc-400">なし（損切りのみ）</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 保存 */}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            {saved && <span className="text-sm text-green-600">保存しました</span>}
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-zinc-200 bg-white p-6">{children}</div>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-green-500" : "bg-zinc-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
