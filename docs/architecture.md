# Architecture Notes

This project should be built as a private, activity-first homeschool record system.

## Initial Stack

- Next.js / React for the web app
- TypeScript throughout
- Prisma ORM
- SQLite for the local MVP database
- Local filesystem storage for evidence uploads and generated exports
- PDF generation for legal, portfolio, annual, and review exports
- Generated Markdown snapshots for readable records and Obsidian-style browsing

## Core Domain Rule

The activity is the source of truth.

An activity records what happened, when it happened, how long it took, and what evidence was produced. Subjects, legal categories, standards/skills, resources, and portfolio artifacts attach to the activity as metadata.

## Important Boundary

Do not store real user records in Git.

GitHub stores the codebase, planning documents, schema, migrations, and safe seed/config files. The local app database, evidence uploads, generated PDFs, photos, videos, scans, and other records belong in ignored runtime storage.

## Main Application Areas

- Student and school year setup
- Unit study planning
- Daily activity logging
- Subject time allocation
- Legal tag coverage
- Evidence and portfolio capture
- Reading log
- Writing samples
- Weekly reviews
- 9-week reviews
- Annual archive and reports

## Data Model Shape

Keep the model normalized around activity records:

- `students`
- `school_years`
- `legal_requirement_profiles`
- `units`
- `activities`
- `subjects`
- `activity_subject_allocations`
- `legal_tags`
- `activity_legal_tags`
- `standards_or_skills`
- `activity_standards`
- `evidence_artifacts`
- `curriculum_resources`
- `activity_resources`
- `reading_logs`
- `writing_samples`
- `progress_checks`
- `legal_records`
- `exports`

## Reporting Model

Reports should be derived from stored activity data rather than maintained manually:

- Legal compliance report
- Subject time report
- Standards/skills progress report
- Portfolio export
- 9-week review report
- Annual archive PDF
- Markdown record snapshots

Markdown snapshots are generated from database records. The database remains the source of truth; Markdown is not the primary data store and manual Markdown edits do not update the database in the MVP.

See [Markdown Export and Sync Plan](markdown-sync.md) for the regeneration rules and folder structure.

## UX Direction

Daily logging should be fast enough to use consistently. Target 3-5 minutes for normal entry.

The default workflow should be:

1. Select student.
2. Select school year.
3. Select unit/theme.
4. Add activity.
5. Enter actual minutes.
6. Select activity type.
7. Add subject allocations.
8. Add legal tags.
9. Add standards/skills if relevant.
10. Upload evidence.
11. Save.

## Privacy Direction

Assume private-by-default behavior. Child records, legal records, photos, scans, videos, and assessments should not be exposed publicly.
