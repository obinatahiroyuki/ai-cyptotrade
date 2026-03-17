import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import LogoutButton from "./logout-button";
import Portfolio from "./portfolio";
import TradeHistory from "./trade-history";
import RiskSummary from "./risk-summary";
import SignalSummary from "./signal-summary";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">ai-cyptotrade</h1>
        <div className="flex items-center gap-4">
          <a
            href="/signals"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            シグナル
          </a>
          <a
            href="/positions"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            ポジション
          </a>
          <a
            href="/settings/investment"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            投資設定
          </a>
          <a
            href="/settings/exchange"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            取引所連携
          </a>
          <a
            href="/settings/risk"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            リスク設定
          </a>
          <span className="text-sm text-zinc-600">{session?.user?.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">ダッシュボード</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {session?.user?.name ?? session?.user?.email} さんのポートフォリオ
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SignalSummary />
            <RiskSummary />
          </div>
          <div className="mt-6">
            <Portfolio />
          </div>
          <div className="mt-6">
            <TradeHistory />
          </div>
        </div>
      </main>
    </div>
  );
}
