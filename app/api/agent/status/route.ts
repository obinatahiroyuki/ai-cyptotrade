import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getGatewayStatus, fetchCcxtBalance } from "@/lib/openclaw";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gateway = await getGatewayStatus();

  if (!gateway.online) {
    return NextResponse.json({
      success: true,
      gateway: {
        online: false,
        url: gateway.url,
        error: gateway.error,
      },
      balance: null,
    });
  }

  const balance = await fetchCcxtBalance();

  return NextResponse.json({
    success: true,
    gateway: {
      online: true,
      url: gateway.url,
    },
    balance: balance.success ? balance.data : null,
    balanceError: balance.error,
  });
}
