import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await db.execute({
    sql: `SELECT id, action, price, quantity, amount_usd, round_at_trade,
                 reason, bitget_order_id, created_at
          FROM signal_trade_log
          WHERE position_id = ?
          ORDER BY created_at ASC`,
    args: [id],
  });

  const trades = result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    price: row.price,
    quantity: row.quantity,
    amountUsd: row.amount_usd,
    roundAtTrade: row.round_at_trade,
    reason: row.reason,
    bitgetOrderId: row.bitget_order_id,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ trades });
}
