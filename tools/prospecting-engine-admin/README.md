# Blue Gecko Prospecting Engine Admin (PEA)

Publishes personalized prospecting pages to `bluegecko.homes/p/{slug}`.
Accepts a YAML campaign block pasted from your Claude project, uploads images,
and commits everything directly to GitHub — triggering an auto-deploy.

## Setup

### 1. Get a GitHub Personal Access Token

Go to: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

Create a token with the **`repo`** scope checked. Copy it — you only see it once.
Tokens expire; regenerate when the tool stops committing.

### 2. Create your .env file

```bash
cp tools/prospecting-engine-admin/.env.example tools/prospecting-engine-admin/.env
```

Open `.env` and replace `your_token_here` with your actual token:

```
GITHUB_TOKEN=ghp_yourActualTokenHere
```

The `.env` file is gitignored — it will never be committed.

### 3. Start the server

```bash
node tools/prospecting-engine-admin/server.js
```

Open the admin at: **http://localhost:3335**

If you're accessing it from another device on Tailscale, use your Mac's Tailscale IP:
**http://100.x.x.x:3335**

---

## How to publish a campaign

1. Paste the full YAML campaign block into the **Campaign Content** field
2. Upload the **P1 Hero Image** (required)
3. Upload any **P1 Gallery Images** (optional — reference as `{{gallery:1}}` in body copy)
4. If the campaign includes a P6 follow-up page, leave the **Includes P6 page** toggle ON and upload P6 images
5. Click **Publish Pages**

The tool will:
- Upload images to `public/images/prospecting/{slug}/`
- Generate the Markdown content file at `src/content/prospecting/{slug}.md`
- Commit both to GitHub with the message `feat: publish prospecting page {slug}`
- Repeat for P6 if enabled (slug: `{slug}-6`, separate commit)
- Display the live URLs once complete

GitHub Actions will deploy within ~2 minutes of the last commit.

---

## Paste schema

See `SCHEMA.md` for the full field reference and examples.

Quick summary:

```yaml
slug: cl-648m
prospect_name: Claudia Lozano
address: 648 Munich Lane, Palm Bay, FL 32905
agent: William Whipple
headline: Your neighbor just sold for $342,000.
cma_range: "$310,000–$335,000"
expiry_date: 2027-06-02
body_copy: |
  First section content.

  :::

  Second section. {{gallery:1}} places the first gallery image here.

p6_headline: Here's what that means for you, Claudia.
p6_body_copy: |
  P6 content here.
```

---

## File locations

| What | Where |
|---|---|
| Prospecting pages | `src/content/prospecting/{slug}.md` |
| P6 pages | `src/content/prospecting/{slug}-6.md` |
| P1 images | `public/images/prospecting/{slug}/` |
| P6 images | `public/images/prospecting/{slug}-6/` |

---

## Notes

- Port **3335** — no other tool uses this port
- `pub_date` is always today's publish date — do not include it in the paste
- `expiry_date` defaults to one year from publish date if omitted
- Pages are noindex by default — they cannot be made indexable
- To stop: `Ctrl+C`
- Requires Node.js 22+
