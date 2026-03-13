import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const TIMEOUT_MS = 5000;

export async function GET() {
  try {
    const result = await Promise.race([
      db.execute("SELECT 1 as ok"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("接続がタイムアウトしました")), TIMEOUT_MS)
      ),
    ]);
    return NextResponse.json({
      status: "ok",
      database: "connected",
      result: result.rows[0],
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
