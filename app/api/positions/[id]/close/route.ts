import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { placeSpotMarketSell, fetchSpotTickerPrice, type BitgetCredentials } from "@/lib/bitget";
import { decrypt } from "@/lib/encryption";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const userResult = await db.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [session.user.email],
  });
  if (userResult.rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = userResult.rows[0].id as string;

  const posResult = await db.execute({
    sql: `SELECT id, signal_id, symbol, bitget_symbol, entry_price,
                 total_quantity, total_invested, current_round
          FROM signal_positions
          WHERE id = ? AND user_id = ? AND status = 'active'`,
    args: [id, userId],
  });
  if (posResult.rows.length === 0) {
    return NextResponse.json({ error: "Active position not found" }, { status: 404 });
  }

  const pos = posResult.rows[0];
  const bitgetSymbol = pos.bitget_symbol as string;
  const totalQty = pos.total_quantity as number;
  const totalInvested = pos.total_invested as number;

  const credResult = await db.execute({
    sql: `SELECT api_key_encrypted, api_secret_encrypted, passphrase_encrypted
          FROM exchange_connections
          WHERE user_id = ? AND exchange_name = 'bitget' AND is_active = 1 LIMIT 1`,
    args: [userId],
  });
  if (credResult.rows.length === 0) {
    return NextResponse.json({ error: "No Bitget credentials" }, { status: 400 });
  }

  const creds: BitgetCredentials = {
    apiKey: decrypt(credResult.rows[0].api_key_encrypted as string),
    apiSecret: decrypt(credResult.rows[0].api_secret_encrypted as string),
    passphrase: decrypt(credResult.rows[0].passphrase_encrypted as string),
  };

  const priceResult = await fetchSpotTickerPrice(bitgetSymbol);
  const currentPrice = priceResult.success && priceResult.data
    ? parseFloat(priceResult.data.lastPr)
    : 0;

  const sellResult = await placeSpotMarketSell(creds, bitgetSymbol, totalQty.toString());

  if (!sellResult.success) {
    return NextResponse.json(
      { error: sellResult.error ?? "Sell order failed" },
      { status: 500 }
    );
  }

  const realizedPnl = currentPrice * totalQty - totalInvested;

  await db.execute({
    sql: `INSERT INTO signal_trade_log
            (id, position_id, action, price, quantity, amount_usd, round_at_trade, reason, bitget_order_id)
          VALUES (?, ?, 'sell_manual', ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(), id, currentPrice, totalQty,
      currentPrice * totalQty, pos.current_round,
      "Manual close from dashboard",
      sellResult.data?.orderId ?? null,
    ],
  });

  await db.execute({
    sql: `UPDATE signal_positions
          SET status = 'closed_manual', closed_at = datetime('now'),
              realized_pnl = ?, updated_at = datetime('now')
          WHERE id = ?`,
    args: [realizedPnl, id],
  });

  await db.execute({
    sql: "UPDATE signals SET status = 'completed' WHERE id = ? AND status = 'active'",
    args: [pos.signal_id],
  });

  return NextResponse.json({
    success: true,
    symbol: pos.symbol,
    price: currentPrice,
    quantity: totalQty,
    realizedPnl,
    orderId: sellResult.data?.orderId,
  });
}
