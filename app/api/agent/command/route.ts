import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  sendAgentMessage,
  pauseTrading,
  resumeTrading,
  getPortfolioSummary,
} from "@/lib/openclaw";
import { NextRequest, NextResponse } from "next/server";

type CommandType = "message" | "pause" | "resume" | "portfolio";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      command: CommandType;
      message?: string;
    };

    let result;

    switch (body.command) {
      case "pause":
        result = await pauseTrading();
        break;
      case "resume":
        result = await resumeTrading();
        break;
      case "portfolio":
        result = await getPortfolioSummary();
        break;
      case "message":
        if (!body.message?.trim()) {
          return NextResponse.json(
            { success: false, error: "メッセージを入力してください" },
            { status: 400 }
          );
        }
        result = await sendAgentMessage(body.message);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `不明なコマンド: ${body.command}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: result.success,
      data: result.data,
      error: result.error,
    });
  } catch (err) {
    console.error("Agent command error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
