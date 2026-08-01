import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const workspaceRoot = process.cwd();

function envValue(name: string) {
  return process.env[name]?.trim();
}

export function uploadRoot() {
  return path.resolve(workspaceRoot, envValue("LOCAL_UPLOAD_DIR") ?? "./storage/evidence");
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

function storedFileName(name: string) {
  return `${Date.now()}-${randomUUID()}-${safeFileName(name)}`;
}

function storageFileName(file: File) {
  return storedFileName(file.name);
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
  const supabaseUrl = envValue("SUPABASE_URL");
  const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = envValue("SUPABASE_STORAGE_BUCKET");
  const prefix = envValue("SUPABASE_STORAGE_PREFIX") ?? "evidence";

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new Error("Supabase storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.");
  }

  return { bucket, prefix, serviceRoleKey, supabaseUrl };
}

async function saveSupabaseUploadedFile(file: File): Promise<SavedFile> {
  const bytes = Buffer.from(await file.arrayBuffer());
  return saveSupabaseBuffer(bytes, file.name, file.type || "application/octet-stream");
}

async function saveSupabaseBuffer(bytes: Buffer, originalName: string, mimeType: string): Promise<SavedFile> {
  const { bucket, prefix, serviceRoleKey, supabaseUrl } = supabaseStorageConfig();

  const fileName = storedFileName(originalName);
  const storagePath = `${prefix.replace(/^\/+|\/+$/g, "")}/${fileName}`;
  const uploadUrl = `${supabaseUrl.replace(/\/+$/g, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": mimeType,
      "x-upsert": "false"
    },
    body: new Uint8Array(bytes)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Supabase upload failed with ${response.status}${details ? `: ${details}` : "."}`);
  }

  return {
    fileName,
    originalName,
    mimeType,
    sizeBytes: bytes.length,
    storagePath: `supabase://${bucket}/${storagePath}`
  };
}

async function saveLocalBuffer(bytes: Buffer, originalName: string, mimeType: string): Promise<SavedFile> {
  const root = uploadRoot();
  await mkdir(root, { recursive: true });

  const fileName = storedFileName(originalName);
  const storagePath = path.join(root, fileName);
  await writeFile(storagePath, bytes);

  return {
    fileName,
    originalName,
    mimeType,
    sizeBytes: bytes.length,
    storagePath
  };
}

export async function saveUploadedFile(file: File) {
  if (envValue("STORAGE_PROVIDER") === "supabase") {
    return saveSupabaseUploadedFile(file);
  }

  return saveLocalUploadedFile(file);
}

export async function saveGeneratedFile(bytes: Buffer, originalName: string, mimeType: string) {
  if (envValue("STORAGE_PROVIDER") === "supabase") {
    return saveSupabaseBuffer(bytes, originalName, mimeType);
  }

  return saveLocalBuffer(bytes, originalName, mimeType);
}
