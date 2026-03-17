"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const isConfiguration = error === "Configuration";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="mb-4 text-xl font-semibold text-red-800">
          {isConfiguration ? "認証の設定エラー" : "認証エラー"}
        </h1>
        {isConfiguration ? (
          <div className="space-y-4 text-sm text-red-700">
            <p>
              <strong>AUTH_GITHUB_ID</strong> と{" "}
              <strong>AUTH_GITHUB_SECRET</strong> が設定されていません。
            </p>
            <ol className="list-inside list-decimal space-y-2">
              <li>
                <a
                  href="https://github.com/settings/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  GitHub OAuth App
                </a>
                でアプリを作成
              </li>
              <li>
                Authorization callback URL に{" "}
                <code className="rounded bg-red-100 px-1">
                  http://localhost:3000/api/auth/callback/github
                </code>{" "}
                を登録
              </li>
              <li>
                <code className="rounded bg-red-100 px-1">.env.local</code>{" "}
                に以下を追加:
              </li>
            </ol>
            <pre className="overflow-x-auto rounded bg-red-100 p-3 text-xs">
              {`AUTH_GITHUB_ID=Client IDの値
AUTH_GITHUB_SECRET=Client Secretの値`}
            </pre>
            <p>
              詳細は <code className="rounded bg-red-100 px-1">doc/auth-setup.md</code>{" "}
              を参照してください。
            </p>
          </div>
        ) : (
          <p className="text-sm">エラー: {error ?? "不明"}</p>
        )}
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
            ログインに戻る
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">読み込み中...</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
