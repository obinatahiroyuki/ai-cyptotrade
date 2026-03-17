"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
    >
      ログアウト
    </button>
  );
}
