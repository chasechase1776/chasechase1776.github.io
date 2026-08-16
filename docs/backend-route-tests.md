# Backend Route Safety Checks

The app includes a lightweight backend route check for the save, upload, PDF, report, and snapshot paths that are most important to daily use.

Run:

```bash
pnpm test:backend-routes
```

By default, the check runs against the production site:

```text
https://chasechase1776-github-io.vercel.app
```

To run the same check against another deployed URL:

```bash
BACKEND_TEST_BASE_URL=https://example.vercel.app pnpm test:backend-routes
```

## What It Checks

- The health route responds.
- Activity saving rejects duplicate subject time splits.
- Uploads reject requests without a proof file.
- Daily summary PDF requests reject missing required fields.
- Weekly review PDF requests reject missing required fields.
- Snapshot creation rejects missing school-year information.

These checks intentionally use invalid requests so they do not create real school records, PDFs, uploads, reports, or backup files.
