import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userResult = await db.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [session.user.email],
  });
  if (userResult.rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = userResult.rows[0].id as string;

  const status = req.nextUrl.searchParams.get("status") ?? "active";

  const isActive = status === "active";
  const result = await db.execute({
    sql: `SELECT sp.id, sp.signal_id, sp.symbol, sp.bitget_symbol, sp.entry_price,
                 sp.current_stop_loss, sp.current_round, sp.total_quantity,
                 sp.total_invested, sp.status, sp.realized_pnl,
                 sp.opened_at, sp.closed_at, sp.updated_at,
                 s.targets, s.reference_price, s.long_term_target
          FROM signal_positions sp
          JOIN signals s ON sp.signal_id = s.id
          WHERE sp.user_id = ? AND ${isActive ? "sp.status = 'active'" : "sp.status != 'active'"}
          ORDER BY sp.created_at DESC`,
    args: [userId],
  });

  const positions = result.rows.map((row) => ({
    id: row.id,
    signalId: row.signal_id,
    symbol: row.symbol,
    bitgetSymbol: row.bitget_symbol,
    entryPrice: row.entry_price,
    currentStopLoss: row.current_stop_loss,
    currentRound: row.current_round,
    totalQuantity: row.total_quantity,
    totalInvested: row.total_invested,
    status: row.status,
    realizedPnl: row.realized_pnl,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    updatedAt: row.updated_at,
    targets: row.targets ? JSON.parse(row.targets as string) : null,
    referencePrice: row.reference_price,
    longTermTarget: row.long_term_target,
  }));

  return NextResponse.json({ positions });
}
