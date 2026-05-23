# Blue Gecko Content Admin Dashboard

Local admin panel for managing site content and assets. Runs on port **3334**.

All reads and writes go through the GitHub API against the live `main` branch.
The local checkout is never used for data — changes are committed directly to GitHub.

## Setup

1. Copy `.env.example` to `.env`:
   ```
   cp tools/content-admin/.env.example tools/content-admin/.env
   ```

2. Generate a GitHub personal access token:
   - Go to https://github.com/settings/tokens
   - Classic token, `repo` scope required
   - Tokens expire — regenerate when needed

3. Add your token to `tools/content-admin/.env`:
   ```
   GITHUB_TOKEN=ghp_your_token_here
   ```

4. Start the server:
   ```
   node tools/content-admin/server.js
   ```

5. Open in browser:
   - Local: http://localhost:3334
   - Via Tailscale: http://[your-tailscale-ip]:3334

The server requires Node 22. It will refuse to start if `GITHUB_TOKEN` is missing.

## Panels

### Content Browser
Browse all content collections: Blog, Builders, Communities, FAQ, and Open Houses
(Properties + Events). Each entry shows parsed frontmatter fields and a Delete
button. Deleting commits the removal directly to GitHub with a descriptive commit message.

### Site Map
Visual tree of all live routes, grouped by collection. Shows cross-references
(e.g., which builders reference which communities), and flags orphaned content
(entries with no inbound links and no index page) in amber.

### Asset Audit
Full inventory of all files under `public/` with sizes. Files over 400KB are
flagged red; over 150KB amber. Each file shows whether it's referenced anywhere
in markdown or Astro files. Filter by: All | Oversized | Large | Orphaned |
Oversized + Orphaned. Read-only — deletions should go through GitHub directly.

### Image Optimizer
Lists all images over 150KB. For each: thumbnail preview, quality slider (50–95),
max-width input (default 1920px), and an Optimize button that:
- Fetches the image from GitHub raw URL
- Resizes via `<canvas>` (never upscales)
- Re-uploads as JPEG/PNG at selected quality
- Commits with `assets: optimize filename (old → new KB)`

WebP sources are flagged as unsupported (optimize manually).

"Optimize All Flagged" batch-processes all images over 400KB with default settings.

### Deploy Log
Shows the 10 most recent GitHub Actions workflow runs with status, branch,
commit message, duration, and a link to GitHub. Auto-refreshes every 60 seconds.

## Notes

- This tool is completely separate from `tools/open-house-admin/` (port 3333)
- Never commit `tools/content-admin/.env` — it is gitignored
- Asset audit fetches the full repo tree; the first load takes 10–30 seconds
  depending on how many text files need to be scanned for references
- Asset data is cached for 5 minutes; click Refresh to force a fresh fetch
