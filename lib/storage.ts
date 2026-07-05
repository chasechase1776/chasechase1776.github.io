import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const workspaceRoot = process.cwd();

export function uploadRoot() {
  return path.resolve(workspaceRoot, process.env.LOCAL_UPLOAD_DIR ?? "./storage/evidence");
}

export async function saveUploadedFile(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const root = uploadRoot();
  await mkdir(root, { recursive: true });

  const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "artifact";
  const fileName = `${Date.now()}-${randomUUID()}-${safeOriginal}`;
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
