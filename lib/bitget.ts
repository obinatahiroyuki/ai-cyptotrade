import { createHmac } from "crypto";

const BASE_URL = "https://api.bitget.com";

export interface BitgetCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

function createSignature(
  timestamp: string,
  method: string,
  path: string,
  body: string,
  secret: string
): string {
  const message = timestamp + method.toUpperCase() + path + body;
  const signature = createHmac("sha256", secret).update(message).digest("base64");
  return signature;
}

export async function fetchBitgetAccountBalance(
  credentials: BitgetCredentials
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const timestamp = Date.now().toString();
  const path = "/api/v2/account/all-account-balance";
  const url = `${BASE_URL}${path}`;
  const signature = createSignature(
    timestamp,
    "GET",
    path,
    "",
    credentials.apiSecret
  );

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "ACCESS-KEY": credentials.apiKey,
        "ACCESS-SIGN": signature,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-PASSPHRASE": credentials.passphrase,
        "Content-Type": "application/json",
      },
    });

    const json = await res.json();

    if (json.code === "00000") {
      return { success: true, data: json.data };
    }

    return {
      success: false,
      error: json.msg || json.code || "Unknown error",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
