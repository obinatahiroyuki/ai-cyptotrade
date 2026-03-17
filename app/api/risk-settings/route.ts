import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export interface RiskSettings {
  maxPositionSizePct: number;
  maxDailyLoss: number;
  maxLeverage: number;
  maxOpenPositions: number;
  defaultStopLossPct: number;
  defaultTakeProfitPct: number;
  tradingEnabled: boolean;
}

const DEFAULTS: RiskSettings = {
  maxPositionSizePct: 10,
  maxDailyLoss: 100,
  maxLeverage: 1,
  maxOpenPositions: 30,
  defaultStopLossPct: 10,
  defaultTakeProfitPct: 10,
  tradingEnabled: false,
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db.execute(
      `SELECT max_position_size_pct, max_daily_loss, max_leverage,
              max_open_positions, default_stop_loss_pct, default_take_profit_pct,
              trading_enabled, updated_at
       FROM risk_settings
       WHERE user_id = ?`,
      [session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        settings: DEFAULTS,
        isDefault: true,
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      settings: {
        maxPositionSizePct: row.max_position_size_pct as number,
        maxDailyLoss: row.max_daily_loss as number,
        maxLeverage: row.max_leverage as number,
        maxOpenPositions: row.max_open_positions as number,
        defaultStopLossPct: row.default_stop_loss_pct as number,
        defaultTakeProfitPct: row.default_take_profit_pct as number,
        tradingEnabled: (row.trading_enabled as number) === 1,
      } satisfies RiskSettings,
      isDefault: false,
      updatedAt: row.updated_at as string,
    });
  } catch (err) {
    console.error("Risk settings GET error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<RiskSettings>;

    const settings: RiskSettings = {
      maxPositionSizePct: clamp(body.maxPositionSizePct ?? DEFAULTS.maxPositionSizePct, 1, 100),
      maxDailyLoss: clamp(body.maxDailyLoss ?? DEFAULTS.maxDailyLoss, 1, 100000),
      maxLeverage: clamp(Math.floor(body.maxLeverage ?? DEFAULTS.maxLeverage), 1, 125),
      maxOpenPositions: clamp(Math.floor(body.maxOpenPositions ?? DEFAULTS.maxOpenPositions), 1, 50),
      defaultStopLossPct: clamp(body.defaultStopLossPct ?? DEFAULTS.defaultStopLossPct, 0.1, 50),
      defaultTakeProfitPct: clamp(body.defaultTakeProfitPct ?? DEFAULTS.defaultTakeProfitPct, 0.1, 100),
      tradingEnabled: body.tradingEnabled ?? false,
    };

    await db.execute(
      `INSERT INTO risk_settings (id, user_id, max_position_size_pct, max_daily_loss,
        max_leverage, max_open_positions, default_stop_loss_pct, default_take_profit_pct,
        trading_enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
        max_position_size_pct = excluded.max_position_size_pct,
        max_daily_loss = excluded.max_daily_loss,
        max_leverage = excluded.max_leverage,
        max_open_positions = excluded.max_open_positions,
        default_stop_loss_pct = excluded.default_stop_loss_pct,
        default_take_profit_pct = excluded.default_take_profit_pct,
        trading_enabled = excluded.trading_enabled,
        updated_at = datetime('now')`,
      [
        randomUUID(),
        session.user.id,
        settings.maxPositionSizePct,
        settings.maxDailyLoss,
        settings.maxLeverage,
        settings.maxOpenPositions,
        settings.defaultStopLossPct,
        settings.defaultTakeProfitPct,
        settings.tradingEnabled ? 1 : 0,
      ]
    );

    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error("Risk settings POST error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
