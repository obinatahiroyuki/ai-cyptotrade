import { auth } from "@/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { exchange, apiKey, apiSecret, passphrase } = body;

    if (exchange !== "bitget") {
      return NextResponse.json(
        { error: "Unsupported exchange", success: false },
        { status: 400 }
      );
    }

    if (!apiKey || !apiSecret || !passphrase) {
      return NextResponse.json(
        { error: "API Key, Secret, Passphrase は必須です", success: false },
        { status: 400 }
      );
    }

    const id = randomUUID();
    const apiKeyEncrypted = encrypt(apiKey);
    const apiSecretEncrypted = encrypt(apiSecret);
    const passphraseEncrypted = encrypt(passphrase);

    await db.execute(
      `INSERT INTO exchange_connections 
       (id, user_id, exchange_name, api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [
        id,
        session.user.id,
        exchange,
        apiKeyEncrypted,
        apiSecretEncrypted,
        passphraseEncrypted,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "接続を保存しました",
      id,
    });
  } catch (err) {
    console.error("Exchange connect error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
