import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { fetchBitgetAccountBalance } from "@/lib/bitget";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
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

    const result = await fetchBitgetAccountBalance({
      apiKey,
      apiSecret,
      passphrase,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "接続に成功しました",
        data: result.data,
      });
    }

    return NextResponse.json(
      { success: false, error: result.error || "接続に失敗しました" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Exchange test error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
