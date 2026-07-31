import { NextResponse } from "next/server";

export async function GET() {
  const storageProvider = process.env.STORAGE_PROVIDER ?? "local";

  return NextResponse.json({
    ok: true,
    aiParserMode: process.env.OPENAI_API_KEY ? process.env.AI_PARSER_MODE ?? "enabled" : "mock",
    storageProvider,
    supabaseStorageConfigured:
      storageProvider === "supabase" &&
      Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_STORAGE_BUCKET)
  });
}
