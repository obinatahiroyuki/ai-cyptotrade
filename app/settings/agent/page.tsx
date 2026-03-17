"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface GatewayInfo {
  online: boolean;
  url: string;
  error?: string;
}

interface StatusData {
  success: boolean;
  gateway: GatewayInfo;
  balance: unknown;
  balanceError?: string;
}

interface CommandResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export default function AgentSettingsPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [commandStatus, setCommandStatus] = useState<{
    type: "idle" | "sending" | "success" | "error";
    message?: string;
    data?: unknown;
  }>({ type: "idle" });
  const [commandHistory, setCommandHistory] = useState<
    { command: string; response: string; time: string }[]
  >([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/status");
      const json = await res.json();
      setStatus(json);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const sendCommand = async (
    command: string,
    customMessage?: string
  ) => {
    setCommandStatus({ type: "sending" });
    try {
      const res = await fetch("/api/agent/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          ...(customMessage ? { message: customMessage } : {}),
        }),
      });
      const json: CommandResponse = await res.json();

      const responseText = json.success
        ? JSON.stringify(json.data, null, 2) || "OK"
        : json.error || "エラーが発生しました";

      setCommandStatus({
        type: json.success ? "success" : "error",
        message: json.success ? "コマンドを送信しました" : json.error,
        data: json.data,
      });

      setCommandHistory((prev) => [
        {
          command: command === "message" ? customMessage || command : command,
          response: responseText,
          time: new Date().toLocaleTimeString("ja-JP"),
        },
        ...prev.slice(0, 19),
      ]);
    } catch (err) {
      setCommandStatus({
        type: "error",
        message: err instanceof Error ? err.message : "送信に失敗しました",
      });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    await sendCommand("message", message);
    setMessage("");
  };

  const online = status?.gateway?.online ?? false;

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">AI エージェント制御</h1>
            <p className="mt-1 text-sm text-zinc-600">
              OpenClaw エージェントの状態確認とコマンド送信
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            ← ダッシュボード
          </Link>
        </div>

        {/* Gateway ステータス */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Gateway ステータス</h2>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
            >
              {loading ? "確認中..." : "再確認"}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`inline-block h-3 w-3 rounded-full ${
                  online ? "bg-green-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span className="text-sm font-medium">
                {online ? "オンライン" : "オフライン"}
              </span>
            </div>

            <div className="rounded-lg bg-zinc-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Gateway URL</span>
                <span className="font-mono text-zinc-700">
                  {status?.gateway?.url || "未設定"}
                </span>
              </div>
            </div>

            {!online && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-medium">Gateway に接続できません</p>
                <p className="mt-1">
                  OpenClaw がインストール・起動されていることを確認してください。
                </p>
                <pre className="mt-2 overflow-auto rounded bg-amber-100 p-2 text-xs">
                  {`# インストール\nnpm install -g openclaw@latest\nopenclaw onboard --install-daemon\n\n# 起動\nopenclaw gateway start\nopenclaw status`}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* クイックアクション */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">クイックアクション</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => sendCommand("portfolio")}
              disabled={!online || commandStatus.type === "sending"}
              className="rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              ポートフォリオ確認
            </button>
            <button
              onClick={() => sendCommand("pause")}
              disabled={!online || commandStatus.type === "sending"}
              className="rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              取引一時停止
            </button>
            <button
              onClick={() => sendCommand("resume")}
              disabled={!online || commandStatus.type === "sending"}
              className="rounded-lg border border-green-200 px-4 py-3 text-sm font-medium text-green-600 hover:bg-green-50 disabled:opacity-50"
            >
              取引再開
            </button>
          </div>
        </div>

        {/* メッセージ送信 */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-medium">
            エージェントにメッセージ送信
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            自然言語でエージェントに指示を送信できます。
          </p>
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="例: BTC/USDTの現在価格を教えて"
              disabled={!online}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
            />
            <button
              type="submit"
              disabled={
                !online || !message.trim() || commandStatus.type === "sending"
              }
              className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {commandStatus.type === "sending" ? "送信中..." : "送信"}
            </button>
          </form>
        </div>

        {/* レスポンス表示 */}
        {commandStatus.type !== "idle" &&
          commandStatus.type !== "sending" && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                commandStatus.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <p className="font-medium">{commandStatus.message}</p>
              {commandStatus.data != null && (
                <pre className="mt-2 overflow-auto rounded bg-white/50 p-2 text-xs">
                  {typeof commandStatus.data === "string"
                    ? commandStatus.data
                    : JSON.stringify(commandStatus.data, null, 2)}
                </pre>
              )}
            </div>
          )}

        {/* コマンド履歴 */}
        {commandHistory.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="text-lg font-medium">コマンド履歴</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {commandHistory.map((entry, i) => (
                <div key={i} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-900">
                      {entry.command}
                    </span>
                    <span className="text-xs text-zinc-400">{entry.time}</span>
                  </div>
                  <pre className="mt-2 overflow-auto rounded bg-zinc-50 p-2 text-xs text-zinc-600">
                    {entry.response}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* セットアップ案内 */}
        {!online && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-medium">セットアップ</h2>
            <p className="text-sm text-zinc-600">
              OpenClaw を使うにはローカルにインストールし、Gateway を起動する必要があります。
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-medium">必要なもの:</p>
              <ul className="ml-4 list-disc space-y-1 text-zinc-600">
                <li>Anthropic API キー（Claude を利用するため）</li>
                <li>Bitget テストネット API キー</li>
              </ul>
              <p className="mt-3">
                詳しい手順は{" "}
                <a
                  href="https://openclawai.me/blog/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  OpenClaw 公式ガイド
                </a>{" "}
                またはプロジェクト内の{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                  doc/openclaw-setup.md
                </code>{" "}
                を参照してください。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
