import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import {
  fetchSpotFills,
  fetchFuturesOrderHistory,
  type BitgetCredentials,
  type SpotFill,
  type FuturesOrder,
} from "@/lib/bitget";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "7", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  const endTime = Date.now().toString();
  const startTime = (Date.now() - days * 24 * 60 * 60 * 1000).toString();

  try {
    const result = await db.execute(
      `SELECT api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted
       FROM exchange_connections
       WHERE user_id = ? AND is_active = 1
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Bitget API キーが登録されていません",
        needsSetup: true,
      });
    }

    const row = result.rows[0];
    const credentials: BitgetCredentials = {
      apiKey: decrypt(row.api_key_encrypted as string),
      apiSecret: decrypt(row.api_secret_encrypted as string),
      passphrase: decrypt(row.api_passphrase_encrypted as string),
    };

    const [spotResult, futuresResult] = await Promise.all([
      fetchSpotFills(credentials, { limit, startTime, endTime }),
      fetchFuturesOrderHistory(credentials, {
        productType: "USDT-FUTURES",
        limit,
        startTime,
        endTime,
      }),
    ]);

    const spotFills: SpotFill[] =
      spotResult.success && spotResult.data ? spotResult.data : [];
    const futuresOrders: FuturesOrder[] =
      futuresResult.success && futuresResult.data?.entrustedList
        ? futuresResult.data.entrustedList
        : [];

    return NextResponse.json({
      success: true,
      spot: {
        fills: spotFills,
        error: spotResult.error,
      },
      futures: {
        orders: futuresOrders,
        error: futuresResult.error,
      },
    });
  } catch (err) {
    console.error("Trade history error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
