import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 200);

  let sql = `SELECT id, discord_message_id, signal_type, symbol,
                    entry_price_low, entry_price_high, reference_price,
                    stop_loss_price, targets, long_term_target, status, created_at
             FROM signals`;
  const args: (string | number)[] = [];

  if (status) {
    sql += " WHERE status = ?";
    args.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  args.push(limit);

  const result = await db.execute({ sql, args });

  const signals = result.rows.map((row) => ({
    id: row.id,
    discordMessageId: row.discord_message_id,
    signalType: row.signal_type,
    symbol: row.symbol,
    entryPriceLow: row.entry_price_low,
    entryPriceHigh: row.entry_price_high,
    referencePrice: row.reference_price,
    stopLossPrice: row.stop_loss_price,
    targets: row.targets ? JSON.parse(row.targets as string) : null,
    longTermTarget: row.long_term_target,
    status: row.status,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ signals });
}
