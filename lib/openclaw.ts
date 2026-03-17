const GATEWAY_URL =
  process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

interface GatewayResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface GatewayStatus {
  online: boolean;
  url: string;
  error?: string;
}

interface ToolInvokeParams {
  tool: string;
  action?: string;
  args?: Record<string, unknown>;
  sessionKey?: string;
  dryRun?: boolean;
}

interface AgentCommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (GATEWAY_TOKEN) {
    h["Authorization"] = `Bearer ${GATEWAY_TOKEN}`;
  }
  return h;
}

export async function getGatewayStatus(): Promise<GatewayStatus> {
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "GET",
      headers: headers(),
      signal: AbortSignal.timeout(5000),
    });
    return {
      online: res.ok,
      url: GATEWAY_URL,
    };
  } catch (err) {
    return {
      online: false,
      url: GATEWAY_URL,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export async function invokeTool(
  params: ToolInvokeParams
): Promise<GatewayResponse> {
  try {
    const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        tool: params.tool,
        action: params.action ?? "json",
        args: params.args ?? {},
        sessionKey: params.sessionKey ?? "main",
        dryRun: params.dryRun ?? false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `HTTP ${res.status}: ${text || res.statusText}`,
      };
    }

    return (await res.json()) as GatewayResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

export async function fetchCcxtBalance(): Promise<AgentCommandResult> {
  const result = await invokeTool({
    tool: "ccxt",
    args: {
      exchange: "bitget",
      method: "fetchBalance",
    },
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.result };
}

export async function sendAgentMessage(
  message: string
): Promise<AgentCommandResult> {
  const result = await invokeTool({
    tool: "sessions_send",
    args: { message },
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.result };
}

export async function pauseTrading(): Promise<AgentCommandResult> {
  return sendAgentMessage("Pause all trading immediately. Confirm when done.");
}

export async function resumeTrading(): Promise<AgentCommandResult> {
  return sendAgentMessage(
    "Resume trading with the previously configured strategy and risk limits."
  );
}

export async function getPortfolioSummary(): Promise<AgentCommandResult> {
  return sendAgentMessage(
    "Show my current portfolio summary including all positions and PnL."
  );
}
