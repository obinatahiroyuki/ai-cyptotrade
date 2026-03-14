"use client";

import { useState } from "react";

export default function ExchangeSettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "testing" | "saving" | "success" | "error";
    message?: string;
    data?: Record<string, unknown> | unknown[];
  }>({ type: "idle" });

  const handleTest = async () => {
    setStatus({ type: "testing" });
    try {
      const res = await fetch("/api/exchange/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: "bitget",
          apiKey,
          apiSecret,
          passphrase,
        }),
      });
      const json = await res.json();

      if (json.success) {
        setStatus({
          type: "success",
          message: "接続に成功しました",
          data: json.data,
        });
      } else {
        setStatus({ type: "error", message: json.error || "接続に失敗しました" });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleSave = async () => {
    setStatus({ type: "saving" });
    try {
      const res = await fetch("/api/exchange/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: "bitget",
          apiKey,
          apiSecret,
          passphrase,
        }),
      });
      const json = await res.json();

      if (json.success) {
        setStatus({ type: "success", message: "保存しました" });
        setApiKey("");
        setApiSecret("");
        setPassphrase("");
      } else {
        setStatus({ type: "error", message: json.error || "保存に失敗しました" });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">取引所連携</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Bitget の API キーを登録して接続します。
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium">Bitget API キー</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Bitget の API Management で API Key, Secret, Passphrase を取得してください。
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              placeholder="API Key"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              placeholder="API Secret"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Passphrase</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-2"
              placeholder="API 作成時に設定したパスフレーズ"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handleTest}
            disabled={!apiKey || !apiSecret || !passphrase || status.type === "testing"}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
          >
            {status.type === "testing" ? "接続中..." : "接続テスト"}
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey || !apiSecret || !passphrase || status.type === "saving"}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {status.type === "saving" ? "保存中..." : "保存"}
          </button>
        </div>

        {status.type === "success" && (
          <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-800">
            {status.message}
            {status.data != null && (
              <pre className="mt-2 overflow-auto text-xs">
                {JSON.stringify(status.data, null, 2)}
              </pre>
            )}
          </div>
        )}
        {status.type === "error" && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {status.message}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>注意:</strong> API キーは暗号化して保存されます。本番運用前にテストネットで十分に検証してください。
      </div>
    </div>
  );
}
