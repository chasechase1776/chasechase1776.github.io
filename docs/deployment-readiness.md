# Deployment Readiness and Trial Mode

## Current State

The repository currently contains planning documents, static mockups, and a public GitHub Pages placeholder. It does not yet contain a production application scaffold with build scripts, Prisma migrations, authentication, upload handling, or a deployed private database.

Do not treat the public GitHub Pages site as a safe place for real student records.

## Pre-Launch Context

The official homeschool record system should not go live until approximately May 2027. The student is still enrolled in another school through May 2027.

Records entered before the official homeschool start date are extras, enrichment, practice logs, or system testing. They should not automatically be treated as the official homeschool legal archive.

## School Year Status

School year status options:

- `planned`
- `trial`
- `active`
- `closed`
- `archived`

Add `official_homeschool_start_date` to the school year or student profile.

Example:

```text
official_homeschool_start_date = 2027-05-01
```

Before the official homeschool start date:

- Activity logs may still be entered.
- Artifacts may still be uploaded.
- Weekly reviews may still be generated.
- Quarter reviews may still be tested.
- Markdown/PDF exports may still work.
- Dashboard should clearly label records as Trial / Enrichment / Practice.
- These records should not be counted as official legal homeschool records by default.

After the official homeschool start date:

- The selected school year can be marked active.
- Logs can be included in official reports.
- Legal archive summaries can count approved records.
- Weekly, quarter, and annual reviews become official unless marked otherwise.

## Record Inclusion Status

Each activity, daily record, weekly review, quarter review, annual review, and artifact should have `record_status`.

Allowed values:

- `trial`
- `enrichment`
- `official`
- `excluded`

Default behavior:

- If date is before `official_homeschool_start_date`, default `record_status = trial`.
- If date is on or after `official_homeschool_start_date` and the school year status is `active`, default `record_status = official`.
- Parent can manually change `record_status`.

Reporting behavior:

- Legal reports include official records by default.
- Portfolio reports may optionally include trial/enrichment records when the parent selects them.
- Subject time reports support Official only, Trial/enrichment only, and All records filters.

## Trial Mode Banner

If today is before `official_homeschool_start_date`, show:

```text
Trial Mode: Records entered before the official homeschool start date are saved as practice/enrichment records and are not included in official legal reports unless you choose to include them.
```

If the school year is active, show:

```text
Active Homeschool Year: Approved records are included in official reports and archives.
```

## Settings

Add setting:

```text
Include trial records in reports? false
```

Add filters throughout the app:

- All records
- Official records
- Trial records
- Enrichment records
- Excluded records

Add button:

```text
Promote trial record to official
```

Confirmation text:

```text
This record was created before the official homeschool start date. Promote it to official record?
```

## AI Parsing

The app must function without an OpenAI API key.

If `OPENAI_API_KEY` is missing:

- Hide or disable Parse with AI, or use mock parser mode.
- Manual save should still work.
- Reviews, records, and exports should still work from manually entered data.

AI parsing should never be required for record keeping.

## Deployment Checklist

Before pushing the real application to the website:

1. Confirm build passes.
2. Confirm database migrations run.
3. Confirm environment variables are documented.
4. Confirm AI parsing can be disabled or mocked if no API key is present.
5. Confirm manual logging works without AI tokens.
6. Confirm Markdown export works or is safely disabled behind a feature flag.
7. Confirm artifact uploads work in the deployment environment or are marked local-only for MVP.
8. Confirm no test records are hard-coded into production.
9. Confirm seed/demo data is optional.
10. Confirm app shows Trial Mode until `official_homeschool_start_date`.

Current setup status:

- Build checks: not applicable until an app scaffold exists.
- Database migrations: not applicable until Prisma/schema exists.
- GitHub Pages: public static placeholder only.

## Environment Variables

Use environment variables for:

- `DATABASE_URL`
- `OPENAI_API_KEY`, optional
- `STORAGE_PROVIDER`
- `LOCAL_UPLOAD_DIR` or cloud storage config
- `APP_BASE_URL`
- `NODE_ENV`
- `OFFICIAL_HOMESCHOOL_START_DATE`
- `INCLUDE_TRIAL_RECORDS_IN_REPORTS`

## Official Launch Workflow

1. Parent creates the 2027-2028 school year.
2. Parent sets `official_homeschool_start_date` around May 2027.
3. Parent builds Annual Plan.
4. Parent tests logging in Trial Mode.
5. On or after official start date, parent clicks Activate School Year.
6. New approved records default to official.
7. Legal archive and annual review use official records by default.
