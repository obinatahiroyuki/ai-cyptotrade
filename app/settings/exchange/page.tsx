"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Connection {
  id: string;
  exchange: string;
  apiKeyMasked: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ExchangeSettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{
    type: "idle" | "testing" | "saving" | "verifying" | "deleting" | "success" | "error";
    message?: string;
    data?: Record<string, unknown> | unknown[];
  }>({ type: "idle" });

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/exchange/status");
      const json = await res.json();
      if (json.success) {
        setConnections(json.connections);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleTest = async () => {
    setStatus({ type: "testing" });
    try {
      const res = await fetch("/api/exchange/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchange: "bitget", apiKey, apiSecret, passphrase }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus({ type: "success", message: "接続テスト成功！ Bitget API と通信できています。", data: json.data });
      } else {
        setStatus({ type: "error", message: json.error || "接続に失敗しました" });
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleSave = async () => {
    setStatus({ type: "saving" });
    try {
      const res = await fetch("/api/exchange/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchange: "bitget", apiKey, apiSecret, passphrase }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus({ type: "success", message: "API キーを保存しました" });
        setApiKey("");
        setApiSecret("");
        setPassphrase("");
        fetchConnections();
      } else {
        setStatus({ type: "error", message: json.error || "保存に失敗しました" });
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleVerify = async () => {
    setStatus({ type: "verifying" });
    try {
      const res = await fetch("/api/exchange/status", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setStatus({ type: "success", message: "保存済み API キーで Bitget に接続できました", data: json.data });
      } else {
        setStatus({ type: "error", message: json.error || "接続確認に失敗しました" });
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm("この API キーを削除しますか？")) return;
    setStatus({ type: "deleting" });
    try {
      const res = await fetch("/api/exchange/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus({ type: "success", message: "削除しました" });
        fetchConnections();
      } else {
        setStatus({ type: "error", message: json.error || "削除に失敗しました" });
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const hasConnection = connections.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">取引所連携</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Bitget の API キーを登録して接続します。
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            ← ダッシュボード
          </Link>
        </div>

        {/* 現在の接続状況 */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">接続状況</h2>

          {loading ? (
            <p className="text-sm text-zinc-500">読み込み中...</p>
          ) : hasConnection ? (
            <div className="space-y-4">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {conn.exchange.toUpperCase()}
                      </span>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          conn.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {conn.isActive ? "有効" : "無効"}
                      </span>
                    </div>
                    <p className="font-mono text-sm text-zinc-500">
                      API Key: {conn.apiKeyMasked}
                    </p>
                    <p className="text-xs text-zinc-400">
                      登録日: {new Date(conn.createdAt + "Z").toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleVerify}
                      disabled={status.type === "verifying"}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {status.type === "verifying" ? "確認中..." : "接続確認"}
                    </button>
                    <button
                      onClick={() => handleDelete(conn.id)}
                      disabled={status.type === "deleting"}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-zinc-200 p-6 text-center">
              <p className="text-sm text-zinc-500">
                Bitget API キーが登録されていません。
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                下のフォームから登録してください。
              </p>
            </div>
          )}
        </div>

        {/* ステータス表示 */}
        {status.type === "success" && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            <p className="font-medium">{status.message}</p>
            {status.data != null && (
              <pre className="mt-2 overflow-auto rounded bg-green-100 p-2 text-xs">
                {JSON.stringify(status.data, null, 2)}
              </pre>
            )}
          </div>
        )}
        {status.type === "error" && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
            {status.message}
          </div>
        )}

        {/* API キー登録フォーム */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-medium">
            {hasConnection ? "API キーを更新" : "Bitget API キーを登録"}
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Bitget の
            <a
              href="https://www.bitget.com/account/newapi"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-blue-600 underline"
            >
              API Management
            </a>
            で API Key, Secret, Passphrase を取得してください。
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm"
                placeholder="API Key を入力"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm"
                placeholder="API Secret を入力"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm"
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
              {status.type === "testing" ? "テスト中..." : "接続テスト"}
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKey || !apiSecret || !passphrase || status.type === "saving"}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {status.type === "saving" ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>注意:</strong> API キーは暗号化して保存されます。本番運用前にテストネットで十分に検証してください。
        </div>
      </div>
    </div>
  );
}
