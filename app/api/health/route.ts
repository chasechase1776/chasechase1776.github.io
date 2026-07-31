import { NextResponse } from "next/server";

function envValue(name: string) {
  return process.env[name]?.trim();
}

export async function GET() {
  const storageProvider = envValue("STORAGE_PROVIDER") ?? "local";

  return NextResponse.json({
    ok: true,
    aiParserMode: envValue("OPENAI_API_KEY") ? envValue("AI_PARSER_MODE") ?? "enabled" : "mock",
    storageProvider,
    supabaseStorageConfigured:
      storageProvider === "supabase" &&
      Boolean(envValue("SUPABASE_URL") && envValue("SUPABASE_SERVICE_ROLE_KEY") && envValue("SUPABASE_STORAGE_BUCKET"))
  });
}
