import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import {
  fetchSpotAssets,
  fetchFuturesPositions,
  type BitgetCredentials,
  type SpotAsset,
  type FuturesPosition,
} from "@/lib/bitget";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      fetchSpotAssets(credentials),
      fetchFuturesPositions(credentials, "USDT-FUTURES"),
    ]);

    const spotAssets: SpotAsset[] = spotResult.success && spotResult.data ? spotResult.data : [];
    const futuresPositions: FuturesPosition[] =
      futuresResult.success && futuresResult.data ? futuresResult.data : [];

    const significantAssets = spotAssets.filter(
      (a) => parseFloat(a.available) > 0 || parseFloat(a.frozen) > 0
    );

    return NextResponse.json({
      success: true,
      spot: {
        assets: significantAssets,
        error: spotResult.error,
      },
      futures: {
        positions: futuresPositions,
        error: futuresResult.error,
      },
    });
  } catch (err) {
    console.error("Portfolio error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
