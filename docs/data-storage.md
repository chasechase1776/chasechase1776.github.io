# Data Storage Plan

## Repository Storage

GitHub should store:

- Source code
- Documentation
- Database schema and migrations
- Safe seed data
- Example environment files
- Tests

GitHub should not store:

- Real student records
- Database files or dumps
- Uploaded evidence
- Photos
- Videos
- Audio recordings
- Scans
- Generated legal archive PDFs
- Generated portfolio exports
- Secrets or credentials

## MVP Storage

Use Prisma/PostgreSQL for saved app records. Use Supabase Storage for deployed file uploads once the required environment variables are configured.

- App database: Prisma Postgres through `DATABASE_URL`
- Evidence uploads in production: Supabase Storage bucket, recommended name `homeschool-files`
- Evidence uploads in local troubleshooting: `storage/evidence/`
- Generated reports in local troubleshooting: `storage/exports/`
- Generated Markdown record snapshots: `records/`
- Temporary files in local troubleshooting: `storage/tmp/`

The existing `.gitignore` excludes local databases and runtime storage so records do not get committed accidentally.

Markdown snapshots are generated from database records for readability, backup, long-term records, and Obsidian-style browsing. They are not the primary data store. Manual edits to generated Markdown should not update the database unless a future import/sync feature is intentionally added.

Records created before the official homeschool start date should default to `record_status = trial` and should not be counted in official legal reports unless the parent explicitly promotes or includes them.

## Backup Direction

Backups should be separate from Git.

A good future backup workflow would create encrypted archive files that can be copied to OneDrive, an external drive, or cloud object storage. Backup archives should not be committed to the source repository.

## Future Cloud Option

Production cloud storage direction:

- Hosted database: Postgres
- Evidence storage: Supabase Storage
- App hosting: Vercel

The app should keep storage access behind a small abstraction so local filesystem storage can be replaced later without rewriting the domain model.

## Supabase Storage Setup

Create a private Supabase Storage bucket named:

```text
homeschool-files
```

Set these Vercel environment variables for Production and Preview:

```text
STORAGE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=homeschool-files
SUPABASE_STORAGE_PREFIX=evidence
```

Use the service role key only on the server. Never expose it as `NEXT_PUBLIC_*` and never commit it to GitHub.

## Practical Rule

Keep code in GitHub. Keep family records in app storage and backups.
