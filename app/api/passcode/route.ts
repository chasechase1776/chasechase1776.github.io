import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, authCookieOptions, authCookieValue, appPasscode } from "@/lib/auth";

const passcodeSchema = z.object({
  passcode: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = passcodeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the passcode." }, { status: 400 });
  }

  const configuredPasscode = appPasscode();
  if (!configuredPasscode) {
    return NextResponse.json({ error: "APP_PASSCODE is not configured." }, { status: 500 });
  }

  if (parsed.data.passcode !== configuredPasscode) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, await authCookieValue(configuredPasscode), authCookieOptions());
  return response;
}
