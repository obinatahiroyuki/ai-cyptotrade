import { createClient, type Client } from "@libsql/client";

let _db: Client | null = null;

function getDb(): Client {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error(
        "TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を環境変数に設定してください"
      );
    }
    _db = createClient({ url, authToken });
  }
  return _db;
}

export const db = new Proxy({} as Client, {
  get(_, prop) {
    const value = (getDb() as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});
