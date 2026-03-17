import Anthropic from "@anthropic-ai/sdk";

export interface ProfitTarget {
  round: number;
  price: number;
  achieved: boolean;
  achievedAt?: string;
}

export interface ParsedEntrySignal {
  type: "entry";
  symbol: string;
  entryPriceLow: number;
  entryPriceHigh: number;
  referencePrice: number;
  targets: ProfitTarget[];
  longTermTarget: number | null;
  stopLossPrice: number;
  rawDate: string;
  notes: string | null;
}

export interface ParsedAchievementSignal {
  type: "achievement";
  symbol: string;
  round: number;
  achievedAt: string;
}

export interface ParsedOtherSignal {
  type: "other";
  summary: string;
}

export type ParsedSignal =
  | ParsedEntrySignal
  | ParsedAchievementSignal
  | ParsedOtherSignal;

const SYSTEM_PROMPT = `You are a trading signal parser. You receive Discord messages about cryptocurrency trading signals written in Japanese.

Your job is to extract structured data from these messages. The messages follow these patterns:

**Pattern A: New Entry Signal (新規エントリー・購入対象)**
Contains "🔶売買履歴" or "🔶利確設定" with:
- 銘柄, エントリー価格帯, 参考価格, 利確目標, ロスカット設定
- **重要**: 利確目標に「達成🎉」や「達成」の記述が一切ないこと。目標価格のみが列挙されている（例: 10％　目標：0.150）

**Pattern B: Achievement Report (達成報告・購入対象外)**
以下のいずれか:
- 単体の達成報告: 「3/11　21：24　ARIA　10％達成🎉」のように日時・銘柄・達成ラウンドのみ
- 売買履歴の進捗更新: 利確目標に「→　3/11達成🎉」のように達成記述が含まれる（例: 10％　目標：0.150　→　3/11達成🎉）
→ これらは購入しない。既存ポジションの進捗報告。

**Pattern C: Other (その他)**
コメント、注意書き、バスケット買い、無関係なメッセージ。

Respond ONLY with valid JSON. No markdown, no code fences, no explanation.

For entry signals, respond with:
{
  "type": "entry",
  "symbol": "ELX",
  "entryPriceLow": 0.09,
  "entryPriceHigh": 0.2,
  "referencePrice": 0.186,
  "targets": [{"round": 1, "price": 0.205}, {"round": 2, "price": 0.226}],
  "longTermTarget": 0.75,
  "stopLossPrice": 0.07,
  "rawDate": "2025/8/11 10:45",
  "notes": null
}

For achievement reports, respond with:
{
  "type": "achievement",
  "symbol": "ELX",
  "round": 1,
  "achievedAt": "2025/8/13 19:09"
}

For anything else, respond with:
{
  "type": "other",
  "summary": "Brief description of the message"
}

Important rules:
- If 利確設定の目標に「達成」や「達成🎉」が含まれる → type "achievement" (購入対象外。進捗更新)
- If a signal has "ロスカット：なし" or "10％利確なし", classify as "other" (basket buy, not tradeable).
- Extract ALL target rounds, not just the first few.
- Symbol should be uppercase without any suffix (e.g., "ELX" not "ELXUSDT").
- Prices must be numbers, not strings.
- If the entry price range uses ～ or 〜 or -, split into low and high.
- If there's only one entry price, use it for both low and high.
- 利確設定のフォーマット: "10％　目標：0.150" や "20％　目標：0.163" など。ロスカット未記載時は stopLossPrice を referencePrice の約10%下に設定。`;

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY を環境変数に設定してください");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

export async function parseSignalText(text: string): Promise<ParsedSignal> {
  const client = getClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Parse this Discord trading signal message:\n\n${text}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = JSON.parse(content.text) as ParsedSignal;

  if (parsed.type === "entry") {
    validateEntrySignal(parsed);
  }

  return parsed;
}

function validateEntrySignal(signal: ParsedEntrySignal): void {
  if (!signal.symbol || signal.symbol.length === 0) {
    throw new Error("Symbol is required");
  }
  if (signal.referencePrice <= 0) {
    throw new Error("Reference price must be positive");
  }
  if (signal.stopLossPrice <= 0) {
    throw new Error("Stop-loss price must be positive");
  }
  if (!signal.targets || signal.targets.length === 0) {
    throw new Error("At least one profit target is required");
  }
}
