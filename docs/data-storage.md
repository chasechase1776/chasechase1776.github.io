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
- SQLite database files
- Uploaded evidence
- Photos
- Videos
- Audio recordings
- Scans
- Generated legal archive PDFs
- Generated portfolio exports
- Secrets or credentials

## MVP Storage

Use local storage for the MVP:

- SQLite database: `data/app.db`
- Evidence uploads: `storage/evidence/`
- Generated reports: `storage/exports/`
- Generated Markdown record snapshots: `records/`
- Temporary files: `storage/tmp/`

The existing `.gitignore` excludes local databases and runtime storage so records do not get committed accidentally.

Markdown snapshots are generated from database records for readability, backup, long-term records, and Obsidian-style browsing. They are not the primary data store. Manual edits to generated Markdown should not update the database unless a future import/sync feature is intentionally added.

Records created before the official homeschool start date should default to `record_status = trial` and should not be counted in official legal reports unless the parent explicitly promotes or includes them.

## Backup Direction

Backups should be separate from Git.

A good future backup workflow would create encrypted archive files that can be copied to OneDrive, an external drive, or cloud object storage. Backup archives should not be committed to the source repository.

## Future Cloud Option

If the app needs cloud access later:

- Hosted database: Postgres
- Evidence storage: S3-compatible object storage
- App hosting: Vercel, Railway, Render, Fly.io, or a VPS

The app should keep storage access behind a small abstraction so local filesystem storage can be replaced later without rewriting the domain model.

## Practical Rule

Keep code in GitHub. Keep family records in app storage and backups.
