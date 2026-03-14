import { auth } from "@/auth";
import { signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">ai-cyptotrade</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600">{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-2xl font-semibold">ダッシュボード</h2>
          <p className="text-zinc-600">
            ようこそ、{session?.user?.name ?? session?.user?.email} さん。
          </p>
          <div className="mt-6 flex gap-4">
            <a
              href="/settings/exchange"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Bitget 連携設定
            </a>
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            ポジション表示などの機能は、今後の開発で追加されます。
          </p>
        </div>
      </main>
    </div>
  );
}
