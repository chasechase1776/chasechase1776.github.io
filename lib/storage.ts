import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const workspaceRoot = process.cwd();

export function uploadRoot() {
  return path.resolve(workspaceRoot, process.env.LOCAL_UPLOAD_DIR ?? "./storage/evidence");
}

type SavedFile = {
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-") || "artifact";
}

function storageFileName(file: File) {
  return `${Date.now()}-${randomUUID()}-${safeFileName(file.name)}`;
}

async function saveLocalUploadedFile(file: File): Promise<SavedFile> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const root = uploadRoot();
  await mkdir(root, { recursive: true });

  const fileName = storageFileName(file);
  const storagePath = path.join(root, fileName);
  await writeFile(storagePath, bytes);

  return {
    fileName,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: bytes.length,
    storagePath
  };
}

function supabaseStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  const prefix = process.env.SUPABASE_STORAGE_PREFIX ?? "evidence";

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new Error("Supabase storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.");
  }

  return { bucket, prefix, serviceRoleKey, supabaseUrl };
}

async function saveSupabaseUploadedFile(file: File): Promise<SavedFile> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const { bucket, prefix, serviceRoleKey, supabaseUrl } = supabaseStorageConfig();
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  const fileName = storageFileName(file);
  const storagePath = `${prefix.replace(/^\/+|\/+$/g, "")}/${fileName}`;
  const { error } = await client.storage.from(bucket).upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return {
    fileName,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: bytes.length,
    storagePath: `supabase://${bucket}/${storagePath}`
  };
}

export async function saveUploadedFile(file: File) {
  if (process.env.STORAGE_PROVIDER === "supabase") {
    return saveSupabaseUploadedFile(file);
  }

  return saveLocalUploadedFile(file);
}
