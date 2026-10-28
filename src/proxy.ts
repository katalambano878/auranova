import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token") && cookie.value);
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/account/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-auranova-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/admin/:path*"],
};
