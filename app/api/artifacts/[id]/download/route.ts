import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function envValue(name: string) {
  return process.env[name]?.trim();
}

function supabaseObjectPath(storagePath: string) {
  if (!storagePath.startsWith("supabase://")) return null;
  const withoutProtocol = storagePath.replace("supabase://", "");
  const slashIndex = withoutProtocol.indexOf("/");
  if (slashIndex === -1) return null;

  return {
    bucket: withoutProtocol.slice(0, slashIndex),
    objectPath: withoutProtocol.slice(slashIndex + 1)
  };
}

async function signedSupabaseDownloadUrl(storagePath: string) {
  const supabaseUrl = envValue("SUPABASE_URL");
  const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const parsed = supabaseObjectPath(storagePath);

  if (!supabaseUrl || !serviceRoleKey || !parsed) {
    throw new Error("Download is not configured for this proof file.");
  }

  const signUrl = `${supabaseUrl.replace(/\/+$/g, "")}/storage/v1/object/sign/${encodeURIComponent(parsed.bucket)}/${parsed.objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  const response = await fetch(signUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expiresIn: 300 })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Could not create download link${details ? `: ${details}` : "."}`);
  }

  const data = (await response.json()) as { signedURL?: string };
  if (!data.signedURL) throw new Error("Supabase did not return a download link.");

  if (data.signedURL.startsWith("http")) return data.signedURL;

  const relativePath = data.signedURL.startsWith("/storage/v1/")
    ? data.signedURL
    : `/storage/v1${data.signedURL.startsWith("/") ? data.signedURL : `/${data.signedURL}`}`;
  return `${supabaseUrl.replace(/\/+$/g, "")}${relativePath}`;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const artifact = await prisma.evidenceArtifact.findUnique({ where: { id } });
    if (!artifact) {
      return NextResponse.json({ error: "Proof file was not found." }, { status: 404 });
    }

    const url = await signedSupabaseDownloadUrl(artifact.storagePath);
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
