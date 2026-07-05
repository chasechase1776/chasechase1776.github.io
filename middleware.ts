import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isValidAuthCookie } from "./lib/auth";

const PUBLIC_PATHS = new Set(["/passcode", "/api/passcode", "/favicon.ico"]);

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthorized = await isValidAuthCookie(cookieValue);

  if (isAuthorized) {
    return NextResponse.next();
  }

  const passcodeUrl = request.nextUrl.clone();
  passcodeUrl.pathname = "/passcode";
  passcodeUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(passcodeUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
