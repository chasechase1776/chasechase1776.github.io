# Deployment Notes

## Current Target

The current target website is GitHub Pages.

GitHub Pages is being used only for a safe placeholder and future static previews. It should not publish real homeschool records or private evidence.

Expected project site URL:

`https://chasechase1776-netizen.github.io/bennett-homeschool/`

## Privacy Warning

GitHub Pages sites are publicly available on the internet, even if the repository itself is private when the GitHub plan allows Pages for private repositories.

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

1. Open `https://chasechase1776-netizen.github.io/bennett-homeschool/`.
2. Confirm the page says `Bennett Homeschool`.
3. Confirm the page says this is a target website placeholder.
4. Confirm it says private records are not published.

GitHub Pages can take several minutes to publish after a push.
