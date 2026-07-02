# Deployment Notes

## Current Target

The current target website is GitHub Pages.

GitHub Pages is enabled because this repository is public. The website should contain only the public form/app interface. User-submitted form output should be stored elsewhere and should not be committed to this repository.

Expected project site URL:

`https://chasechase1776.github.io/`

Current status: live.

## Public Repo Warning

This repository and its GitHub Pages site are public.

Do not publish:

- Student records
- Databases
- Photos
- Videos
- Audio recordings
- Scans
- Legal archive PDFs
- Portfolio exports
- Secrets or credentials

## How It Deploys

The workflow at `.github/workflows/pages.yml` publishes the contents of the `site/` folder.

For now, `site/` contains only a static placeholder page. When the real app is built, deployment may need to move to a different host if the app requires server-side features, authentication, database access, or private file storage.

## Nontechnical Verification

After deployment finishes:

1. Open `https://chasechase1776.github.io/`.
2. Confirm the page says `Bennett Homeschool`.
3. Confirm the page says this is a target website placeholder.
4. Confirm it says private records are not published.

GitHub Pages can take several minutes to publish after a push.

## Activation Options

The target website is already live. If privacy needs change later, the safer options are:

1. Move the source repository back to private and use another host.
2. Use a separate public deployment repository that contains only built website files.
3. Use a private-friendly host for the real app.
