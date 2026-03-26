# 仮想通貨自動売買システム 要件定義書

## 1. プロジェクト概要

### 1.1 目的
Discord の指定チャンネル（最大10件）に投稿される売買シグナルを AI で自動解析し、Bitget スポット市場で自動売買を行うシステム。利確モード（即時売却 / ピラミッディング）を選択でき、ピラミッディング時は 10% 利確ごとに損切りラインを動的に引き上げ、追加投資を行う。決済は損切りラインでの自動売却をデフォルトとし、任意のタイミングでの手動利確にも対応する。

### 1.2 対応取引所
- **メイン**: Bitget（スポット成行注文）
- **拡張**: Binance, OKX, Hyperliquid 等の追加を想定（exchange_connections テーブルで複数対応可能）

### 1.3 技術スタック

| 項目 | 技術 | 備考 |
|------|------|------|
| 開発環境 | Cursor | AI支援による開発 |
| シグナル監視 | discord.js v14 | Discord チャンネルのリアルタイム監視（最大10チャンネル） |
| AI 解析 | Anthropic Claude API | シグナルテキストの構造化パース |
| 認証 | NextAuth v4 | GitHub OAuth（v5 beta は不安定のため v4 安定版を採用） |
| ソースコード管理 | GitHub | バージョン管理・CI/CD |
| ホスティング・デプロイ | Vercel | フロントエンド・API |
| 常駐ワーカー | Node.js (tsx) | Discord Bot + 価格監視。ローカル / VPS / **Railway** 等の常駐可能ホスト（詳細: `doc/railway-worker-deploy.md`） |
| データベース | Turso | 取引履歴・設定の永続化（東京リージョン） |
| フレームワーク | Next.js 15 | App Router |

---

## 2. 実現可能性の評価

### 2.1 結論：**可能（アーキテクチャの工夫が必要）**

### 2.2 各技術の適合性

#### OpenClaw × 本プロジェクト
- **適合**: OpenClawは100以上の取引所（Binance, OKX, Bitget, Hyperliquid等）に対応
- **リスク管理**: ポジション上限2%、日次/週次損失制限、ストップロスが組み込み済み
- **AIモデル**: Claude Opus 4.5、サブ秒級の実行速度
- **戦略**: モメンタム、DCA、グリッド、平均回帰、センチメント分析、アービトラージに対応

#### Vercel × OpenClaw
- **注意点**: Vercelはサーバーレス向け。OpenClawは24/7稼働の長時間プロセス
- **対応策**:
  - **Vercel Sandbox**: マイクロVMでOpenClawを独立稼働可能（ポート18789でHTTPS公開）
  - **推奨**: ダッシュボード・APIはVercel、エージェント本体は別プラットフォーム（Cloudflare Workers、AWS ECS、VPS等）で稼働させる構成
- **本プロジェクト**: Next.js製の管理UI・設定画面はVercelに最適

#### Turso × 本プロジェクト
- **適合**: SQLite互換のエッジDB。取引履歴、ポジション、ユーザー設定の保存に適する
- **利点**: 低レイテンシ、サーバーレスとの相性が良い

#### GitHub
- **適合**: 標準的なソース管理・CI/CDパイプライン構築に問題なし

---

## 3. システムアーキテクチャ

### 3.1 採用設計：Discord シグナル連動型自動売買

**方針**: Discord の売買シグナルを AI で解析し、Bitget で自動売買を行う。ダッシュボード（Vercel）とワーカー（常駐プロセス）を分離し、Turso を唯一の状態管理とする。

```
┌──────────────────────────────────────────────────────────────────┐
│  Discord                                                          │
│  └── 指定チャンネル（最大10件）にシグナル投稿                      │
└──────────────────────────────────────────────────────────────────┘
                              │ 新着メッセージ
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  常駐ワーカー (npm run worker)                                    │
│  ├── Discord Bot (discord.js)     ← メッセージ受信                │
│  ├── AI Signal Parser (Claude)    ← テキスト→構造化データ          │
│  ├── Trade Engine                 ← 新規買い・追加投資・損切り      │
│  └── Price Monitor (30秒間隔)     ← 目標/損切り判定                │
└──────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Turso DB       │ │  Bitget API     │ │  Vercel (Next.js) │
│  signals        │ │  成行買い/売り   │ │  ダッシュボード   │
│  positions      │ │  価格取得       │ │  シグナル一覧     │
│  trade_log      │ │                 │ │  ポジション管理   │
│  settings       │ │                 │ │  投資設定         │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 3.2 売買ロジック（核心）

#### メッセージ種別の判別（購入対象 vs 購入対象外）

| 種別 | 判定条件 | 購入 |
|------|----------|------|
| **entry**（新規エントリー） | 売買履歴で、利確目標に「達成」「達成🎉」の記述が一切ない（例: 10％　目標：0.150） | ✅ する |
| **achievement**（達成報告） | 単体の達成報告（例: 3/11　21：24　ARIA　10％達成🎉）、または利確目標に「→　3/11達成🎉」等が含まれる | ❌ しない |
| **other**（その他） | コメント、注意書き、無関係なメッセージ | ❌ しない |

#### 新規シグナル受信時（type=entry の場合のみ）
1. Discord メッセージを Claude API で解析 → entry / achievement / other に分類。**entry のみ購入対象**
2. **既に当該銘柄を保有している場合は購入しない**（再エントリー防止）
3. Bitget API で **現在の市場価格**を取得
4. **価格帯の範囲内かチェック**（±5% マージン）:
   - 範囲内 → 現在の市場価格で **成行買い**（初期投資額: 設定値）
   - 範囲外 → スキップ（`price_out_of_range`）、シグナルは `skipped` で保存
5. `signal_positions` に記録（entry_price = 実際の約定価格、current_round = 0）

#### 価格監視ループ（30秒間隔）

**重要**: 追加投資・損切り引き上げは**達成報告ではなく実際の市場価格**で判定。価格監視で目標価格（10%、20%、30%...）に到達した時点で実行。

1. 各アクティブポジションの現在価格を Bitget API から取得
2. **次の目標価格に到達した場合（利確モード別）**:
   - **利確モード（take_profit）**: 全量成行売り → ポジションクローズ（即時利益確定）
   - **ピラミッディングモード（pyramid）**:
     - 回数を +1
     - 損切り価格を「前回の目標価格」に引き上げ
     - `pyramidMaxPct`（デフォルト100%）未満なら **追加投資**を実行
     - `pyramidMaxPct` 以上なら追加投資なし、損切りのみ引き上げ継続
3. **損切り価格を下回った場合**:
   - 全量成行売り → ポジションクローズ（自動決済 — デフォルトの利確手段）

#### 長期目標について
- **長期目標（longTermTarget）は参考情報のみ**。売買ロジックには一切影響しない
- 損切りラインは上昇に応じて10%ずつ引き上げ続け、長期目標を超えても継続する

#### 手動利確
- **ピラミッディングモードのデフォルト決済は損切りライン到達時の自動売却**
- ポジション管理画面（`/positions`）から任意のタイミングで **手動利確（全量成行売り）** が可能
- API: `POST /api/positions/[id]/close` — 認証済みユーザーのアクティブポジションを市場価格で全量売却
- 売買ログに `sell_manual`（手動利確）として記録、ポジションステータスは `closed_manual`

#### 追加投資額の計算

**単利モード（simple）**: 毎回固定の投資額
| 回数 | 投資額 | 累計 | 備考 |
|------|--------|------|------|
| 初回（エントリー） | $1.0 | $1.0 | initialAmount |
| 1回目（+10%） | $1.0 | $2.0 | 固定 |
| 2回目（+20%） | $1.0 | $3.0 | 固定 |

**複利モード（compound）**（例: 初期 $1、増分 $0.5）
- **compoundCurrentRound はグローバル**（銘柄横断）。新規シグナル（別銘柄）でも追加投資でも同じカウンターで累進
| 回数 | 投資額 | 累計 | 備考 |
|------|--------|------|------|
| 初回（エントリー） | $1.0 | $1.0 | initialAmount + increment × (currentRound - 1) |
| 1回目（+10%） | $1.5 | $2.5 | currentRound が自動インクリメント |
| 2回目（+20%） | $2.0 | $4.5 | |
| 3回目（+30%） | $2.5 | $7.0 | |
| ... | ... | ... | |
| pyramidMaxPct 到達以降 | 追加なし | - | 損切りのみ引き上げ |

### 3.3 ワーカーの稼働戦略

| フェーズ | 稼働場所 | 目的 |
|----------|----------|------|
| **検証・開発** | ローカル (`npm run worker`) | 動作確認。**`PAPER_TRADING=true`** 推奨（実注文なし） |
| **本番** | **Railway** / VPS / AWS ECS 等 | 24/7 安定稼働。GitHub 連携・`Start Command: npm run worker` でデプロイ可能 |

**重要**: ワーカーは Vercel では動作しません（常駐プロセスのため）。

### 3.4 ペーパートレード（`PAPER_TRADING`）

| 設定 | 挙動 |
|------|------|
| **未設定** または `false` | Bitget へ **実注文 API を呼び得る**（投資設定の自動売買 ON かつ API 登録済みのとき） |
| **`PAPER_TRADING=true`** | Discord 監視・シグナル解析・DB 保存は行うが、**成行買い/売りは Bitget に送らず**ログ（`[PAPER] Would BUY/SELL`）のみ。検証・様子見用 |

- ワーカー環境変数に設定する（例: Railway **Variables**）。反映後は **Redeploy** すること。
- **実売買と独立**: ダッシュボードの **自動売買 ON/OFF**（`investment_settings.auto_trade_enabled`）はそのまま効く。`PAPER_TRADING=true` のときは注文処理の最終段がモックになる。

---

## 4. 機能要件

### 4.1 必須機能（MVP）

| ID | 機能 | 説明 | 優先度 |
|----|------|------|--------|
| F-001 | 取引所連携 | APIキー登録・接続テスト・接続確認・削除（Bitget） | 高 |
| F-002 | Discord シグナル監視 | 指定チャンネル（最大10件、カンマ区切りID）の新着メッセージをリアルタイム取得 | 高 |
| F-003 | AI シグナル解析 | Claude API でテキストを構造化。entry（購入対象）/achievement（達成報告）/other に分類 | 高 |
| F-004 | 自動売買（エントリー） | 達成報告ではないシグナル（entry）受信時に価格帯チェック後、範囲内なら成行買い | 高 |
| F-005 | 動的損切り | 実際の価格が目標（10%、20%、30%...）に到達した時点で損切りラインを10%刻みで引き上げ | 高 |
| F-006 | ピラミッディング | 実際の価格が目標に到達した時点で追加投資（設定上限 % まで） | 高 |
| F-007 | 価格監視 | 30秒間隔でアクティブポジションの価格をチェック | 高 |
| F-008 | 投資設定 | 利確モード・単利/複利・ポートフォリオ比率・初期額・増分・最大投資額・自動売買ON/OFF | 高 |
| F-009 | ポジション管理UI | シグナル一覧・ポジション管理・売買履歴表示・手動利確 | 高 |
| F-010 | 手動利確 | ポジション画面から任意のタイミングで全量成行売り | 高 |
| F-011 | リスク設定 | ポジション上限、日次損失制限、ストップロス | 中 |

### 4.2 拡張機能（フェーズ2）

| ID | 機能 | 説明 | 優先度 |
|----|------|------|--------|
| F-012 | 通知 | 取引実行・損切りの通知（Discord/Telegram） | 中 |
| F-013 | バックテスト | 過去データでの戦略検証 | 中 |
| F-014 | マルチ取引所 | Bitget以外の取引所対応 | 低 |
| F-015 | レポート | 月次・週次のパフォーマンスレポート | 低 |

---

## 5. 非機能要件

### 5.1 セキュリティ
- APIキーはAES-256-GCMで暗号化してTursoに保存（`lib/encryption.ts`）
- 環境変数によるシークレット管理（Vercel Environment Variables）
- 取引実行前のHuman-in-the-Loop（大口取引時の承認フロー）

### 5.2 可用性
- ダッシュボード: VercelのSLAに準拠
- エージェント: 24/7稼働を想定（稼働プラットフォームに依存）

### 5.3 パフォーマンス
- ダッシュボード: 初回表示3秒以内
- 取引実行: OpenClawのサブ秒級レスポンスを維持

### 5.4 コンプライアンス
- 利用規約・リスク開示の明示
- 金融商品取引に係る法規制の確認（対象地域による）

---

## 6. データモデル（Turso）

### 6.1 主要テーブル

| テーブル | 用途 |
|----------|------|
| `users` | ユーザー情報、認証 |
| `exchange_connections` | 取引所APIキー（暗号化）、接続状態。Bitget 用カラム: api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted |
| `signals` | 解析済みシグナル（銘柄、価格帯、利確目標、損切り、ステータス） |
| `signal_positions` | アクティブポジション（回数、投資額累計、現在の損切り価格） |
| `signal_trade_log` | 全売買記録（買い/売り/追加、価格、数量、理由） |
| `investment_settings` | 投資設定（利確モード、単利/複利、ポートフォリオ比率、初期投資額、増分額、最大投資額、追加投資上限%、自動売買ON/OFF） |
| `risk_settings` | リスク管理設定（最大ポジション、日次損失上限等） |
| `positions` | 現在のポジション（レガシー、Bitget API 直接取得用） |
| `trades` | 取引履歴（レガシー、Bitget API 直接取得用） |
| `agent_settings` | エージェント戦略設定（レガシー） |
| `alerts` | 通知履歴、アラート設定 |

### 6.2 環境変数

| 変数名 | 用途 | 設定場所 |
|--------|------|----------|
| `TURSO_DATABASE_URL` | Turso接続URL | ダッシュボード・ワーカー |
| `TURSO_AUTH_TOKEN` | Turso認証トークン | 同上 |
| `NEXTAUTH_SECRET` | NextAuth v4 セッション暗号化 | ダッシュボード |
| `NEXTAUTH_URL` | NextAuth v4 コールバックURL | ダッシュボード |
| `GITHUB_ID` | GitHub OAuth Client ID | ダッシュボード |
| `GITHUB_SECRET` | GitHub OAuth Client Secret | ダッシュボード |
| `ENCRYPTION_KEY` | APIキー暗号化用（AES-256-GCM） | ダッシュボード・ワーカー |
| `DISCORD_BOT_TOKEN` | Discord Bot トークン | ワーカー |
| `DISCORD_CHANNEL_IDS` | 監視対象チャンネル ID（最大10件、カンマ区切り）。単一のみの場合は `DISCORD_CHANNEL_ID` でも可 | ワーカー |
| `ANTHROPIC_API_KEY` | Claude API キー（シグナル解析） | ワーカー |
| `PAPER_TRADING` | `true` のとき **Bitget 実注文なし**（紙トレード）。未設定時は実注文のコードパスに入り得る | ワーカー（任意・検証推奨） |

**補足**: ダッシュボード（Vercel）には `DISCORD_*` / `ANTHROPIC_API_KEY` は不要。ワーカー側の `ENCRYPTION_KEY` は **Vercel と同一**にすること（ Bitget API キー復号に必要）。

---

## 7. 開発フェーズ

### Phase 1: 基盤構築（完了）
- [x] Tursoセットアップ、スキーマ定義
- [x] 認証（NextAuth v4 + GitHub OAuth）の導入
- [x] 取引所API連携の基本実装（Bitget）
- [x] APIキー暗号化・DB保存・接続テスト・接続確認・削除

### Phase 2: MVP（完了）
- [x] ダッシュボードUI（ポジション・残高表示）
- [x] Vercelデプロイ、GitHub連携
- [x] 取引履歴の取得・表示
- [x] リスク設定画面

### Phase 3: Discord シグナル連動自動売買（完了）
- [x] DB スキーマ追加（signals, signal_positions, signal_trade_log, investment_settings）
- [x] Discord Bot 実装（discord.js でメッセージ監視）
- [x] AI シグナルパーサー（Claude API でテキスト解析）
- [x] Bitget スポット注文 API 拡張（成行買い/売り、価格取得）
- [x] 売買エンジン（新規買い・追加投資・損切り）
- [x] 価格監視ワーカー（30秒間隔、常駐プロセス）
- [x] ダッシュボード UI（シグナル一覧・ポジション管理・投資設定）
- [x] 統合ワーカー（Discord Bot + 価格監視を1プロセスで実行）
- [x] 投資設定拡張（利確モード、単利/複利、ポートフォリオ比率、追加投資上限%）
- [x] 手動利確機能（ポジション画面から任意タイミングで全量売却）
- [x] 価格帯チェック付きエントリー（市場価格が範囲内の場合のみ成行買い）
- [x] AI パーサー拡張（売買報告/売買履歴の両方に対応、エントリー価格帯未指定時は referencePrice を使用）

### Phase 4: 運用・拡張（未着手 / 一部進行中）
- [ ] 本番口座での少額動作検証（Bitget スポットはテストネット非対応）。先行検証は **`PAPER_TRADING=true`** を推奨
- [ ] 通知機能（Discord/Telegram）
- [ ] バックテスト
- [ ] パフォーマンス最適化
- [x] ワーカーのクラウド常駐（**Railway** 等: `npm run worker`、環境変数は Vercel と齟齬なく設定）
- [ ] VPS への本番デプロイ（Railway 以外の選択肢）

---

## 8. リスク・注意事項

1. **資金リスク**: 自動売買は損失を伴う。Bitget スポットにテストネットがないため、**`PAPER_TRADING=true`** または **自動売買 OFF** での検証を推奨
2. **API制限**: 取引所のレート制限・API変更に注意
3. **Vercel制約**: エージェントの長時間稼働はSandboxまたは別プラットフォームを検討
4. **法規制**: 地域ごとの仮想通貨取引に関する規制を確認すること
5. **Bitget スポット制約**: 最小注文額は 1 USDT 以上。初期投資額は $2 以上を推奨
6. **Bitget テストネット**: スポット取引にはテストネット非対応。本番口座で少額テストを推奨
7. **ワーカー起動**: ワーカーは **1プロセスのみ** 起動すること。複数起動すると同一メッセージを重複処理する

---

## 9. 本番環境移行チェックリスト

**本番運用に移行する前に、以下を必ず確認・実施すること。**

### 9.1 セキュリティ（必須）

| 項目 | 実施内容 | 理由 |
|------|----------|------|
| **Turso認証トークンの再発行** | `turso db tokens create ai-cyptotrade` で新トークンを発行し、Vercel・エージェントの環境変数を更新。開発中にチャットやログに流出した可能性のあるトークンは使用しない | 漏洩したトークンでDBに不正アクセスされるリスクを排除 |
| **取引所APIキーの再発行** | 本番用に新規APIキーを発行し、開発時使用分は無効化 | 同上 |
| **ENCRYPTION_KEYの変更** | 本番用に新規生成した鍵を使用（開発時と別の値にする） | 暗号化されたAPIキーの復号リスクを排除 |
| **NEXTAUTH_SECRET の変更** | 本番用に `openssl rand -base64 32` で新規生成 | セッション偽造リスクの排除 |
| **GitHub OAuth App の分離** | 本番用に別の OAuth App を作成し、callback URL を本番ドメインに設定 | ローカル用 OAuth App の Client Secret 漏洩リスクを排除 |
| **環境変数の確認** | `.env.local` がGitにコミットされていないこと、**Vercel** に本番用の値が設定されていること。常駐ワーカー（**Railway** 等）にも `TURSO_*`・`ENCRYPTION_KEY`（Vercel と同一）・`DISCORD_*`・`ANTHROPIC_API_KEY`、必要に応じ `PAPER_TRADING` を設定 | シークレットの誤公開防止・ワーカー未設定によるクラッシュ防止 |

### 9.2 運用・インフラ

| 項目 | 実施内容 |
|------|----------|
| エージェントの稼働場所 | ワーカーは **Railway / VPS / AWS ECS 等** で常駐。Vercel 本体での常駐は不可 |
| テストネットでの検証 | 実資金投入前にテストネットで十分に動作確認 |
| 監視・アラート | 異常検知時の通知体制を整備 |

---

## 10. 参考リンク

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw Trading](https://openclawai.me/trading)
- [Turso Documentation](https://docs.turso.tech/)
- [Vercel OpenClaw Sandbox](https://vercel.com/kb/guide/running-openclaw-in-vercel-sandbox)
- [Bitget API v2 Documentation](https://www.bitget.com/api-doc)
- [NextAuth v4 Documentation](https://next-auth.js.org)

---

## 11. 実装進捗サマリー

| 項目 | 状態 | 備考 |
|------|------|------|
| Turso DB | ✅ 完了 | ai-cyptotrade（東京リージョン） |
| スキーマ | ✅ 完了 | users, exchange_connections, signals, signal_positions, signal_trade_log, investment_settings, risk_settings 他 |
| DBクライアント | ✅ 完了 | @libsql/client（`lib/db.ts`） |
| GitHub | ✅ 完了 | obinatahiroyuki/ai-cyptotrade |
| Vercelデプロイ | ✅ 完了 | ai-cyptotrade.vercel.app |
| 認証 | ✅ 完了 | NextAuth v4 + GitHub OAuth + SessionProvider |
| 取引所API連携 | ✅ 完了 | Bitget（接続管理 + スポット成行買い/売り + 価格取得） |
| APIキー暗号化 | ✅ 完了 | AES-256-GCM（`lib/encryption.ts`） |
| Discord Bot | ✅ 完了 | discord.js v14（`lib/discord-bot.ts`） |
| AI シグナルパーサー | ✅ 完了 | Anthropic Claude（`lib/signal-parser.ts`） |
| 売買エンジン | ✅ 完了 | エントリー・追加投資・損切り（`lib/trade-engine.ts`） |
| 価格監視ワーカー | ✅ 完了 | 30秒間隔（`worker/main.ts`） |
| シグナル一覧 | ✅ 完了 | `/signals` — フィルター付き一覧表示 |
| ポジション管理 | ✅ 完了 | `/positions` — アクティブ/クローズ、売買履歴展開 |
| 投資設定 | ✅ 完了 | `/settings/investment` — 利確モード・単利/複利・ポートフォリオ比率・初期額・増分・追加投資上限%・自動売買ON/OFF |
| 手動利確 | ✅ 完了 | `/positions` — アクティブポジションの任意タイミング全量売却 |
| 価格帯チェック付きエントリー | ✅ 完了 | 市場価格が範囲内の場合のみ成行買い、範囲外はスキップ |
| リスク設定 | ✅ 完了 | `/settings/risk` — 最大レバ1倍・損切り10%・最大ポジション30（デフォルト） |
| テストネット検証 | ⏳ 未着手 | Bitget スポットはテストネット非対応。本番口座で少額（$2〜）テストを推奨 |

---

## 12. 実装ファイル構成

```
ai-cyptotrade/
├── auth.ts                           # NextAuth v4 設定
├── middleware.ts                      # 認証ガード
├── lib/
│   ├── db.ts                         # Turso DBクライアント
│   ├── bitget.ts                     # Bitget API（残高・注文・価格取得）
│   ├── discord-bot.ts                # Discord Bot（メッセージ監視）
│   ├── signal-parser.ts              # AI シグナルパーサー（Claude API）
│   ├── trade-engine.ts               # 売買エンジン（エントリー・追加投資・損切り）
│   ├── openclaw.ts                   # OpenClaw Gateway クライアント（レガシー）
│   └── encryption.ts                 # AES-256-GCM 暗号化・復号
├── worker/
│   ├── main.ts                       # 統合ワーカー（Discord Bot + 価格監視）
│   └── price-monitor.ts              # 価格監視単体ワーカー
├── app/
│   ├── layout.tsx                    # ルートレイアウト
│   ├── providers.tsx                 # SessionProvider ラッパー
│   ├── page.tsx                      # ダッシュボード
│   ├── portfolio.tsx                 # ポートフォリオ表示
│   ├── trade-history.tsx             # 取引履歴表示
│   ├── risk-summary.tsx              # リスク設定サマリー
│   ├── signal-summary.tsx            # シグナル/ポジションサマリー
│   ├── logout-button.tsx             # ログアウトボタン
│   ├── signals/page.tsx              # シグナル一覧ページ
│   ├── positions/page.tsx            # ポジション管理ページ（手動利確ボタン付き）
│   ├── login/page.tsx                # ログイン画面
│   ├── auth/error/page.tsx           # 認証エラー画面
│   ├── settings/
│   │   ├── exchange/page.tsx         # 取引所連携設定
│   │   ├── risk/page.tsx             # リスク管理設定
│   │   ├── investment/page.tsx       # 投資設定（利確モード・単利/複利・初期額・増分・追加投資上限%）
│   │   └── agent/page.tsx            # エージェント制御（レガシー）
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── signals/route.ts           # シグナル一覧取得
│       ├── positions/route.ts         # ポジション一覧取得
│       ├── positions/[id]/trades/route.ts  # ポジション別売買履歴
│       ├── positions/[id]/close/route.ts   # 手動利確（全量成行売り）
│       ├── investment-settings/route.ts    # 投資設定 GET/POST
│       ├── portfolio/route.ts
│       ├── trade-history/route.ts
│       ├── risk-settings/route.ts
│       ├── exchange/
│       │   ├── connect/route.ts
│       │   ├── test/route.ts
│       │   ├── status/route.ts
│       │   └── disconnect/route.ts
│       ├── db/health/route.ts
│       └── ping/route.ts
├── db/
│   └── migrations/
│       ├── 001_initial.sql
│       ├── 002_add_bitget_passphrase.sql
│       ├── 003_risk_settings.sql
│       ├── 004_discord_signals.sql    # signals, signal_positions, signal_trade_log, investment_settings
│       └── 005_investment_settings_v2.sql  # investment_settings 拡張（利確モード・単利/複利・ポートフォリオ比率）
└── doc/
    ├── requirements.md
    ├── auth-setup.md
    ├── bitget-setup.md
    ├── openclaw-setup.md
    └── deploy-vercel.md
```

---

## 13. 技術的な判断記録

### 13.1 NextAuth v5 → v4 へのダウングレード
- **理由**: NextAuth v5 beta.30 は Next.js 15 との組み合わせで以下の問題が発生
  - Edge ランタイムでの `auth()` 呼び出し失敗（ミドルウェア）
  - `UnknownAction` エラー（`AUTH_URL` 環境変数との競合）
  - サーバーアクションでの `signIn()` が CSRF トークンなしで POST できない
- **対応**: NextAuth v4（安定版 4.24.x）に切り替え
  - ミドルウェアは `getToken()` で JWT を直接検証
  - ログインは `signIn("github")` クライアント関数を使用（CSRF トークンを自動処理）
  - `SessionProvider` でアプリ全体をラップ

### 13.2 Bitget API バージョン
- **採用**: Bitget API v2
- **使用エンドポイント**:
  - `GET /api/v2/account/all-account-balance` — 全アカウント残高
  - `GET /api/v2/spot/account/assets` — スポット資産
  - `GET /api/v2/mix/position/all-position` — 先物ポジション
  - `GET /api/v2/spot/trade/fills` — スポット約定履歴（90日以内）
  - `GET /api/v2/mix/order/orders-history` — 先物注文履歴（90日以内）
- **認証**: HMAC-SHA256 署名（timestamp + method + path + body）

### 13.3 Discord シグナル連動自動売買のアーキテクチャ

- **方針**: Discord → AI 解析 → 直接 Bitget 注文の独自パイプライン
- **複数チャンネル監視**: `DISCORD_CHANNEL_IDS` で最大10チャンネルをカンマ区切りで指定。指定したチャンネル/スレッドのいずれかに投稿されたメッセージを監視
- **購入条件**: 達成報告（達成🎉等）は購入対象外。既に当該銘柄を保有している場合は購入しない（再エントリー防止）。達成していなく、投稿時点で保有していない銘柄のみ購入
- **追加投資・損切り引き上げ**: 達成報告ではなく**実際の価格**で判定。価格監視（30秒間隔）で市場価格が目標価格（10%、20%、30%...）に到達した時点で追加投資し、損切りラインを10%刻みで引き上げる
- **シグナルフォーマット**: 人間が投稿する半構造化テキスト（`🔶売買履歴` / `🔶売買報告`、`🔶10％利確設定`、`🔶ロスカット設定`）。エントリー価格帯が明示されていない場合は referencePrice を entryPriceLow/High に使用
- **AI パーサー**: Claude API でテキストを JSON に変換。新規エントリー / 達成報告 / その他を分類
- **売買ロジック**:
  - エントリー: シグナル受信 → 市場価格取得 → 価格帯（entryPriceLow〜entryPriceHigh）範囲内なら成行買い、範囲外ならスキップ → ポジション作成
  - 利確モード（take_profit）: 最初の目標到達で全量売却
  - ピラミッディングモード（pyramid）: 損切りを前回目標価格に引き上げ + 追加投資（設定上限% まで）
  - 損切り（デフォルト決済）: 動的損切りライン到達 → 全量成行売り → ポジションクローズ
  - 手動利確: ポジション画面から任意タイミングで全量成行売り
- **常駐ワーカー**: `npm run worker` で Discord Bot + 価格監視を1プロセスで実行
- **投資額計算**:
  - 単利モード: 毎回固定額（`initialAmount`）
  - 複利モード: `初期額 + 増分 × (現在ラウンド - 1)` で累進増加

### 13.4 投資設定のデータモデル

| パラメータ | デフォルト値 | 説明 |
|-----------|-------------|------|
| ポートフォリオ上限 | 25% | 総資産に対する最大投資比率（25〜50% で設定可） |
| 通貨 | USD | 投資額の表示・計算通貨（USD / JPY） |
| 利確モード | pyramid | `take_profit`（10%で即売却）/ `pyramid`（損切り引き上げ＋追加投資） |
| 追加投資上限 | 100% | ピラミッディング時の追加投資を止めるゲイン %（損切りは継続） |
| 金利モード | simple | `simple`（固定額）/ `compound`（累進増加） |
| 初期投資額 | $1.0 | 新規シグナルでの初回投資額（Bitget 最小注文 1 USDT のため $2 以上を推奨） |
| 増分額 | $0.5 | 複利モード時の10% 達成ごとの投資額増分 |
| 現在ラウンド | 1 | 複利モード時の現在の取引回数（表示・設定可能） |
| 最大投資額/ポジション | $100.0 | 1ポジションあたりの累計投資上限 |
| 自動売買 | OFF | ワーカーによる自動注文のON/OFF |

### 13.5 リスク設定のデフォルト値

| パラメータ | デフォルト値 | 説明 |
|-----------|-------------|------|
| 最大レバレッジ | 1倍 | 先物ポジションのレバレッジ上限 |
| デフォルト損切り | 10% | エントリー価格からの損切りライン |
| 最大同時ポジション数 | 30 | 同時に保有できるポジション数の上限 |

### 13.6 利確方法の設計

| 方法 | トリガー | 説明 |
|------|----------|------|
| **損切りライン決済（デフォルト）** | 自動 | 動的に引き上げた損切り価格を下回ると全量成行売り |
| **手動利確** | ユーザー操作 | ポジション管理画面の「手動利確」ボタンで任意タイミングに全量売却 |
| **利確モード売却** | 自動 | `take_profit` モード選択時、最初の目標到達で全量売却 |

- ピラミッディングモードでは、損切りラインがデフォルトの利確手段となる
- ユーザーは `/positions` 画面からいつでも手動利確が可能
- 手動利確時はポジションステータスが `closed_manual` に設定され、売買ログに記録される

### 13.7 ワーカーの起動方法

```bash
# 環境変数を .env.local から読み込んで起動
npm run worker
```

必要な環境変数:
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — DB接続
- `ENCRYPTION_KEY` — APIキー復号（**Vercel と同一値**）
- `DISCORD_BOT_TOKEN` — Discord Bot ログイン
- `DISCORD_CHANNEL_IDS` — 監視対象チャンネル（最大10件、カンマ区切り）。**実際にメッセージを送るチャンネル ID を含めること**
- `ANTHROPIC_API_KEY` — Claude API
- `PAPER_TRADING` — （任意）`true` で **Bitget 実注文なし**。検証・様子見時に設定

クラウド運用例: **Railway** でリポジトリ接続、`Build Command: npm install`、`Start Command: npm run worker`、上記 Variables を設定（手順: `doc/railway-worker-deploy.md`）。

---

*作成日: 2025年3月14日*
*更新日: 2026年3月26日*
*バージョン: 7.2*（`PAPER_TRADING`、ワーカー稼働先に Railway を明記、環境変数・リスク・Phase 4 の整合）
