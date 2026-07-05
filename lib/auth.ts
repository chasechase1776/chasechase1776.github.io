export const AUTH_COOKIE_NAME = "homeschool_auth";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function appPasscode() {
  return process.env.APP_PASSCODE ?? "";
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS
  };
}

export async function authCookieValue(passcode = appPasscode()) {
  if (!passcode) {
    return "";
  }

  const encoded = new TextEncoder().encode(`homeschool:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `v1:${hash}`;
}

export async function isValidAuthCookie(cookieValue?: string | null) {
  if (!cookieValue) {
    return false;
  }

  const expected = await authCookieValue();
  return Boolean(expected) && cookieValue === expected;
}
