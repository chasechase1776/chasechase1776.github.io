export function readableError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim();
  if (!message) return fallback;

  if (message.includes("Unique constraint failed")) {
    return "This record already exists. Refresh the page, then choose whether to update the existing record or add a separate entry.";
  }

  if (message.includes("Foreign key constraint failed")) {
    return "A linked record could not be found. Refresh the page and try again before saving.";
  }

  if (message.includes("Supabase upload failed")) {
    return "File storage rejected the upload. Try a smaller file or a different file type, then upload again.";
  }

  if (message.includes("Stored file could not be retrieved")) {
    return "One saved file could not be retrieved from storage. The record is still saved, but that file may need to be uploaded again.";
  }

  if (message.toLowerCase().includes("fetch failed")) {
    return "The app could not reach the server. Check the connection and try again.";
  }

  return message;
}
