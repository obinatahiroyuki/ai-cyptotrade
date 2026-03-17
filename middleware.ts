import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// auth()はEdgeで問題を起こすため、getTokenでJWTを直接検証
export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });
  const isLoggedIn = !!token;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isAuthErrorPage = req.nextUrl.pathname.startsWith("/auth/error");

  if (!isLoggedIn && !isLoginPage && !isAuthErrorPage) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // api, _next, favicon を除外。auth コールバックが確実に通るように
  matcher: [
    "/((?!api/auth|api|_next/static|_next/image|favicon.ico).*)",
  ],
};
