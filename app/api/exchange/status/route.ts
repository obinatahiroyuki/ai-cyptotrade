import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { fetchBitgetAccountBalance } from "@/lib/bitget";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.execute(
      `SELECT id, exchange_name, api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted, is_active, created_at, updated_at
       FROM exchange_connections
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [session.user.id]
    );

    const connections = result.rows.map((row) => ({
      id: row.id as string,
      exchange: row.exchange_name as string,
      apiKeyMasked: maskApiKey(
        safeDecrypt(row.api_key_encrypted as string)
      ),
      isActive: row.is_active === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));

    return NextResponse.json({ success: true, connections });
  } catch (err) {
    console.error("Exchange status error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.execute(
      `SELECT id, api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted
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
      });
    }

    const row = result.rows[0];
    const apiKey = decrypt(row.api_key_encrypted as string);
    const apiSecret = decrypt(row.api_secret_encrypted as string);
    const passphrase = decrypt(row.api_passphrase_encrypted as string);

    const balanceResult = await fetchBitgetAccountBalance({
      apiKey,
      apiSecret,
      passphrase,
    });

    return NextResponse.json({
      success: balanceResult.success,
      data: balanceResult.data,
      error: balanceResult.error,
    });
  } catch (err) {
    console.error("Exchange verify error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function safeDecrypt(ciphertext: string): string {
  try {
    return decrypt(ciphertext);
  } catch {
    return "****";
  }
}
