# Blue Gecko Open House Admin

A lightweight local admin tool for managing open house properties and events.
Saves Markdown files locally and commits them directly to GitHub — triggering an auto-deploy.

## Setup

### 1. Get a GitHub Personal Access Token

Go to: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

Create a token with the **`repo`** scope checked. Copy it — you only see it once.

### 2. Create your .env file

In the `tools/open-house-admin/` folder, copy the example file:

```bash
cp tools/open-house-admin/.env.example tools/open-house-admin/.env
```

Open `.env` and replace `your_token_here` with your actual token:

```
GITHUB_TOKEN=ghp_yourActualTokenHere
```

The `.env` file is gitignored — it will never be committed.

### 3. Start the server

```bash
node tools/open-house-admin/server.js
```

That's it. No token in the command line, no environment variables to set manually.

Open the admin at: **http://localhost:3333**

If you're accessing it from another device on Tailscale, use your Mac's Tailscale IP:
**http://100.x.x.x:3333**

### 4. What it does when you save

1. Writes the Markdown file to the local repo (`src/content/properties/` or `src/content/events/`)
2. Commits it directly to GitHub via the Contents API (no git required)
3. GitHub Actions detects the push and auto-deploys to bluegecko.homes

---

## Sync all to GitHub

If any saves failed to reach GitHub (no internet, token expired, etc.), use the
**↑ Sync all to GitHub** button in the top-right corner of the admin.

It will push every local property file, event file, and photo to GitHub in one pass,
skipping anything already up to date. Check the terminal window for per-file results.

---

## How to add a property

1. Click **Properties** tab → **+ Add property**
2. Fill in: Address, Price, Sq ft, Beds, Baths, Description
3. Optionally upload a hero image and/or gallery photos
4. Click **Save property**

The slug is auto-generated from the address (e.g. `5017-barr-st-palm-bay`).
Photos are saved to `public/uploads/[slug]/` and served as static assets.

## How to add an open house event

1. Click **Events** tab → **+ Add event**
2. Select the property from the dropdown
3. Set the date, start time, and end time
4. Add any per-event notes (optional — these appear above the property description on the detail page)
5. Click **Save event**

The event filename is `[property-slug]-[YYYY-MM-DD].md`.
Multiple events can exist for the same property on different dates.

## File locations

| What | Where |
|------|--------|
| Properties | `src/content/properties/[slug].md` |
| Events | `src/content/events/[property-slug]-[YYYY-MM-DD].md` |
| Photos | `public/uploads/[slug]/[filename]` |

## Notes

- The server runs on port **3333** — nothing else should be using it
- No database — everything is Markdown files in the repo
- To stop: `Ctrl+C`
- Requires Node.js 22+ (same as the main site)
