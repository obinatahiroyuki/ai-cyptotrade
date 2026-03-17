import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";

export interface InvestmentSettingsPayload {
  initialAmount?: number;
  incrementAmount?: number;
  maxInvestmentPerPosition?: number;
  autoTradeEnabled?: boolean;
  maxPortfolioPct?: number;
  tradeCurrency?: string;
  profitMode?: string;
  pyramidMaxPct?: number;
  interestMode?: string;
  compoundCurrentRound?: number;
}

const DEFAULTS = {
  initialAmount: 1.0,
  incrementAmount: 0.5,
  maxInvestmentPerPosition: 100.0,
  autoTradeEnabled: false,
  maxPortfolioPct: 25,
  tradeCurrency: "USD",
  profitMode: "pyramid",
  pyramidMaxPct: 100,
  interestMode: "simple",
  compoundCurrentRound: 1,
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userResult = await db.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [session.user.email],
  });
  if (userResult.rows.length === 0) {
    return NextResponse.json({ ...DEFAULTS, isDefault: true });
  }
  const userId = userResult.rows[0].id as string;

  const result = await db.execute({
    sql: "SELECT * FROM investment_settings WHERE user_id = ?",
    args: [userId],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ ...DEFAULTS, isDefault: true });
  }

  const row = result.rows[0];
  return NextResponse.json({
    initialAmount: row.initial_amount,
    incrementAmount: row.increment_amount,
    maxInvestmentPerPosition: row.max_investment_per_position,
    autoTradeEnabled: (row.auto_trade_enabled as number) === 1,
    maxPortfolioPct: row.max_portfolio_pct ?? DEFAULTS.maxPortfolioPct,
    tradeCurrency: row.trade_currency ?? DEFAULTS.tradeCurrency,
    profitMode: row.profit_mode ?? DEFAULTS.profitMode,
    pyramidMaxPct: row.pyramid_max_pct ?? DEFAULTS.pyramidMaxPct,
    interestMode: row.interest_mode ?? DEFAULTS.interestMode,
    compoundCurrentRound: row.compound_current_round ?? DEFAULTS.compoundCurrentRound,
    isDefault: false,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userResult = await db.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [session.user.email],
  });
  if (userResult.rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = userResult.rows[0].id as string;

  const body = (await req.json()) as InvestmentSettingsPayload;

  const initialAmount = Math.max(0.01, body.initialAmount ?? DEFAULTS.initialAmount);
  const incrementAmount = Math.max(0, body.incrementAmount ?? DEFAULTS.incrementAmount);
  const maxInvestmentPerPosition = Math.max(1, body.maxInvestmentPerPosition ?? DEFAULTS.maxInvestmentPerPosition);
  const autoTradeEnabled = body.autoTradeEnabled ?? DEFAULTS.autoTradeEnabled;
  const maxPortfolioPct = clamp(body.maxPortfolioPct ?? DEFAULTS.maxPortfolioPct, 25, 50);
  const tradeCurrency = ["USD", "JPY"].includes(body.tradeCurrency ?? "") ? body.tradeCurrency! : DEFAULTS.tradeCurrency;
  const profitMode = ["take_profit", "pyramid"].includes(body.profitMode ?? "") ? body.profitMode! : DEFAULTS.profitMode;
  const pyramidMaxPct = clamp(body.pyramidMaxPct ?? DEFAULTS.pyramidMaxPct, 10, 1000);
  const interestMode = ["simple", "compound"].includes(body.interestMode ?? "") ? body.interestMode! : DEFAULTS.interestMode;
  const compoundCurrentRound = Math.max(1, Math.floor(body.compoundCurrentRound ?? DEFAULTS.compoundCurrentRound));

  await db.execute({
    sql: `INSERT INTO investment_settings
            (id, user_id, initial_amount, increment_amount, max_investment_per_position,
             auto_trade_enabled, max_portfolio_pct, trade_currency, profit_mode,
             pyramid_max_pct, interest_mode, compound_current_round, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            initial_amount = excluded.initial_amount,
            increment_amount = excluded.increment_amount,
            max_investment_per_position = excluded.max_investment_per_position,
            auto_trade_enabled = excluded.auto_trade_enabled,
            max_portfolio_pct = excluded.max_portfolio_pct,
            trade_currency = excluded.trade_currency,
            profit_mode = excluded.profit_mode,
            pyramid_max_pct = excluded.pyramid_max_pct,
            interest_mode = excluded.interest_mode,
            compound_current_round = excluded.compound_current_round,
            updated_at = datetime('now')`,
    args: [
      crypto.randomUUID(), userId, initialAmount, incrementAmount,
      maxInvestmentPerPosition, autoTradeEnabled ? 1 : 0,
      maxPortfolioPct, tradeCurrency, profitMode, pyramidMaxPct,
      interestMode, compoundCurrentRound,
    ],
  });

  return NextResponse.json({
    initialAmount,
    incrementAmount,
    maxInvestmentPerPosition,
    autoTradeEnabled,
    maxPortfolioPct,
    tradeCurrency,
    profitMode,
    pyramidMaxPct,
    interestMode,
    compoundCurrentRound,
    isDefault: false,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
