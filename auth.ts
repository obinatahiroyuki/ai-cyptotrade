import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      // 初回ログイン時にusersテーブルに登録
      if (user.email) {
        try {
          const { db } = await import("@/lib/db");
          const id = String(user.id ?? crypto.randomUUID());
          await db.execute(
            `INSERT OR IGNORE INTO users (id, email, name, image, created_at, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [id, user.email, user.name ?? null, user.image ?? null]
          );
        } catch {
          // DB接続失敗時もログインは許可
        }
      }
      return true;
    },
  },
});
