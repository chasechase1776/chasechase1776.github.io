import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    aiParserMode: process.env.OPENAI_API_KEY ? process.env.AI_PARSER_MODE ?? "enabled" : "mock",
    storageProvider: process.env.STORAGE_PROVIDER ?? "local"
  });
}
