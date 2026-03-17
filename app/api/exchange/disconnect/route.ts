import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId は必須です", success: false },
        { status: 400 }
      );
    }

    await db.execute(
      `DELETE FROM exchange_connections WHERE id = ? AND user_id = ?`,
      [connectionId, session.user.id]
    );

    return NextResponse.json({ success: true, message: "接続を削除しました" });
  } catch (err) {
    console.error("Exchange disconnect error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
