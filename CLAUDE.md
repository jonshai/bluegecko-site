# bluegecko-site — Blue Gecko Real Estate Website
# Claude Code Context File — Read this before doing anything

## CC + Claude.ai Workflow
Strategic planning and prompt writing happens in Claude.ai (claude.ai).
All code execution happens in CC against the live repo.
Claude.ai output should always be a CC prompt, never raw files.
Keep CC prompts to a single focused pass. Minimize context size —
every unnecessary file read costs tokens. New CC sessions for new
features. CLAUDE.md is the handoff document between sessions.

## What This Is
Astro + Cloudflare Pages website for Blue Gecko real estate team.
GitHub repo: jonshai/bluegecko-site (auto-deploys on push to main)
Live URL: https://bluegecko.homes
Stack: Astro v6, @astrojs/cloudflare adapter, Cloudflare Pages

## Key Architecture Decisions

### Script Injection (CRITICAL)
Astro's SSR build strips inline scripts. The ONLY working pattern
for injecting scripts into all pages is the post-build script:

scripts/inject-scripts.mjs — runs after `astro build`
Patches all HTML files in dist/client/ with:
  <script src="/stella-loader.js" defer></script>
  <script src="/lead-form.js" defer></script>

package.json build script:
  "build": "astro build && node scripts/inject-scripts.mjs"

DO NOT use Vite transformIndexHtml plugin — it does not work with
Cloudflare Pages SSR deployment despite working locally.
DO NOT inline scripts in Astro components — SSR strips them.
Static files in public/ are served correctly at runtime.

### Cloudflare Deployment — NON-STANDARD SETUP ⚠️
This site runs as a Cloudflare Worker with Assets, NOT a standard
Cloudflare Pages project. This atypical configuration was required
to make the Stella chatbot work correctly.

DO NOT attempt to change the deployment mechanism without understanding
this fully. It took ~3 hours of troubleshooting to establish the
working pattern below. Do not break it.

Key facts:
- Output directory: dist/client (NOT dist/)
- Worker entry: dist/client/_worker.js (copied by inject-scripts.mjs)
- Server chunks: dist/client/chunks/ (copied by inject-scripts.mjs)
- Environment variables: set as Secrets in Cloudflare dashboard
  FUB_API_KEY — set as Secret, not in .env (gitignored)
- checkOrigin: false in astro.config.mjs (required for form POST)

wrangler.jsonc MUST have:
  "name": "bluegecko"  ← the live worker name, NOT bluegecko-site
  "assets": { "directory": "./dist/client" }  ← no binding field

wrangler.jsonc MUST NOT have:
  "main" field — breaks deployment
  "assets.binding" field — causes "assets-only Worker" error

There are 3 workers on the Cloudflare account — do not confuse them:
  bluegecko      ← THE LIVE SITE (bluegecko.homes)
  stella-chat    ← Stella chatbot backend
  bluegecko-site ← old/stale worker from failed setup, ignore

### Stella Widget
- Widget assets served by PANTHEON Stella service (port 8012)
- stella-loader.js: fetched from stella.bluegecko.homes/stella-loader.js
- lead-form.js: static file in public/lead-form.js
- Stella trigger buttons: use data-stella-trigger="open" attribute
  NOT href="/contact" — these open the chat widget
- Widget persists across page navigation via localStorage
- Conversation history: localStorage['stella_conversation'] (50 msg cap)

### Contact Form / Lead Capture
- Form: src/pages/contact.astro → src/components/LeadForm.astro
- API route: src/pages/api/lead.ts
- Returns JSON {success: true, redirect: "/thank-you"} — NOT 302
- lead-form.js handles fetch + client-side redirect
- FUB auth: btoa(FUB_API_KEY + ":") — NOT Buffer.from() (Workers runtime)
- Content-Type: multipart/form-data (browser FormData)
- Use request.formData() to parse — NOT URLSearchParams

### IDX Search iframe
- Search page: src/pages/search.astro
- iframe crop: --crop-top: 64px (hides CB header at ALL breakpoints)
- Mobile: width: 100%, no min-width (Moxi renders native mobile layout)
- Desktop: card format preserved
- Moxi URL base: https://space-coast.homes/search/#
- Required params: company_uuid=4228033&agent_uuid=364e222e-0ca9-400c-a1d1-12724bc51a54

## File Structure

src/
  layouts/BaseLayout.astro   — main layout, CB strip, header, nav
  pages/
    index.astro              — homepage
    buy.astro                — buyer page
    search.astro             — IDX iframe search page
    contact.astro            — contact form
    list-my-house.astro      — seller page
    privacy.astro            — privacy policy & terms (all legal)
    faq/
      index.astro            — FAQ listing page (grouped by category)
      [slug].astro           — FAQ detail page
    blog/
      index.astro            — Blog listing (featured + grid)
      [slug].astro           — Blog post with prev/next nav
    communities/
      index.astro            — Community grid
      [slug].astro           — Community detail page
    builders/
      index.astro            — Builder grid
      [slug].astro           — Builder detail page
    open-house/
      index.astro            — listing page (hero card, upcoming, recent)
      archive.astro          — all events older than 60 days
      [property]/[date].astro — detail page
    api/lead.ts              — FUB lead submission API
  components/
    LeadForm.astro           — reusable lead form
  content/
    properties/              — one .md per property (shared across events)
    events/                  — one .md per open house date
    faq/                     — one .md per FAQ entry
    blog/                    — one .md per blog post
    communities/             — one .md per community spotlight
    builders/                — one .md per builder profile
  content.config.ts          — Zod schemas for all 6 collections
public/
  stella-loader.js           — loads Stella widget from PANTHEON
  lead-form.js               — handles contact form fetch submission
  uploads/                   — property photos, organized by slug
    [property-slug]/
      hero.jpg (or similar)
      gallery images...
scripts/
  inject-scripts.mjs         — post-build script injection
tools/
  open-house-admin/          — local admin tool (NOT part of Astro build)
    server.js                — Node.js HTTP server on port 3333
    index.html               — admin UI (Properties + Events tabs)
    .env                     — GITHUB_TOKEN (never committed)
    .env.example             — template
    README.md                — setup instructions
.github/workflows/
  deploy.yml                 — GitHub Actions auto-deploy (only deploy mechanism)

## Content Collections

### Schemas (src/content.config.ts)

properties: slug, address, price, beds, baths, sqft, description, hero?, gallery?
events:     property, date (YYYY-MM-DD), start (HH:MM), end (HH:MM), notes?
faq:        question, category?, order?
blog:       title, date, author (default 'Blue Gecko Team'), excerpt, hero?, tags?
communities: name, tagline, hero?, order?
builders:   name, tagline, hero?, website? (url), communities? (slugs array)

### Content authoring workflow
Vera writes Markdown → commits to GitHub → Actions auto-deploys

### faq/[slug].md
---
question: "What's the difference between pre-qualification and pre-approval?"
category: Buying
order: 1
---
Answer body in Markdown.

### blog/[slug].md
---
title: "..."
date: YYYY-MM-DD
author: "Blue Gecko Team"
excerpt: "One-sentence summary."
hero: /uploads/blog/slug/hero.jpg  # optional
tags: [Market Update, Palm Bay]    # optional
---
Post body in Markdown.

### communities/[slug].md
---
name: "Palm Bay"
tagline: "Quiet streets, big lots, and room to breathe."
hero: /uploads/communities/palm-bay/hero.jpg  # optional
order: 1
---
Body in Markdown.

### builders/[slug].md
---
name: "Maronda Homes"
tagline: "..."
hero: /uploads/builders/maronda/hero.jpg  # optional
website: https://marondahomes.com         # optional
communities: [palm-bay, west-melbourne]   # optional, community slugs
---
Body in Markdown.

## Nav — Auto-activating Links
BaseLayout.astro runs getCollection() for all four new collections at
build time. Nav links for Builders, Communities, and Blog only render
when the collection has at least one entry.

Nav order: Buy · Sell · Open Houses · Builders* · Communities* · Blog* · Contact
Footer links: FAQ* · Contact · Privacy Policy & Terms
(* = conditional on collection having entries)

## Design System

--brand:  #1f5c4d  (dark green)
--accent: #c96f4a  (copper)
--bg:     #f7f6f2  (warm off-white)
--text:   #1e2a26
--radius: 18px

CB strip: dark navy at top (Coldwell Banker requirement)
BG logo: 108px on mobile, positioned left with nav to right
Voice: Pro Whimsy — warm, human, approachable. Not corporate, not casual.

## Compliance Text (DO NOT REMOVE)
Contact form must include SMS consent disclaimer:
"I agree to be contacted by Jennifer Lee Whipple, LLC via call,
email, and text for real estate services..."
Privacy policy must include:
"Data will not be shared with third parties for marketing or
promotional purposes."

## Privacy & Legal
- src/pages/privacy.astro — full legal page at /privacy
- Sections: information collected, use, SMS terms (STOP/HELP language),
  TCPA consent, AI disclosure (FL § 501.174), real estate disclaimers,
  brokerage info, third-party services (FUB, Meta, Cloudflare, GA,
  MoxiWorks, PANTHEON/Stella), user rights, contact
- This URL is registered with FUB and Meta as the official privacy policy
- FL Lic: William Whipple #3535381, Jennifer "Lucky" Whipple #3535380
- Phone: 321.341.6650

## Footer Legal Bar
- Links: FAQ (conditional) · Contact · Privacy Policy & Terms
- Plain-English Pro Whimsy paragraph
- The legalText object and legal-toggle event listeners are GONE
- Do NOT re-add toggle buttons or inline disclaimer script

## Git / Deploy Workflow ⚠️

### The ONLY working deploy mechanism
GitHub push to main → GitHub Actions → cloudflare/wrangler-action@v3

The working .github/workflows/deploy.yml steps:
1. Checkout
2. Setup Node 22 (NOT 20 — Astro v6 requires >=22.12.0)
3. npm ci
4. npm run build
5. rm -f .wrangler/deploy/config.json  ← CRITICAL: the build generates
   this redirect file which points wrangler at dist/server/wrangler.json
   instead of wrangler.jsonc. Must be deleted before deploy or deploy fails.
6. cloudflare/wrangler-action@v3 with apiToken + accountId

GitHub Secrets required (Settings → Secrets → Actions):
  CLOUDFLARE_API_TOKEN  — Edit Cloudflare Workers token, all zones
  CLOUDFLARE_ACCOUNT_ID — c4b87e3db7bbe4739053d3fa3923f602

### Commands that DO NOT work (do not attempt)
- npx wrangler deploy — hits /workers/services/ API, gets 7003 error
- cd dist/server && npx wrangler deploy — wrong path
- wrangler pages deploy — wrong product
- Any manual wrangler terminal command for production

Why npx wrangler deploy fails: the bluegecko worker was originally
created via wrangler pages deploy and lives under a different Cloudflare
API path. Only cloudflare/wrangler-action@v3 handles this correctly.

### Verification after deploy
curl -s 'https://bluegecko.homes' | grep "stella-loader"

### CC pushes directly to remote
GitHub Desktop requires Pull after CC commits or local changes conflict.
Working directory for CC: /Users/jonshai/AI Projects/bluegecko-site

## Open House System

### Data model
Two Astro content collections:

src/content/properties/[slug].md
  slug, address, price, beds, baths, sqft, description
  hero: /uploads/[slug]/filename.jpg (optional)
  gallery: [array of /uploads/[slug]/filename.jpg] (optional)

src/content/events/[property-slug]-[YYYY-MM-DD].md
  property: [slug], date: YYYY-MM-DD, start: HH:MM, end: HH:MM
  notes: optional per-event text

### Pages
/open-house           — hero card (next event), upcoming grid, recent (60d)
/open-house/[p]/[d]  — detail: hero, map, gallery, RSVP or inquiry form
/open-house/archive   — all events older than 60 days

### Admin tool (tools/open-house-admin/)
- Runs locally on port 3333, accessed via Tailscale
- Start: node tools/open-house-admin/server.js (reads .env automatically)
- GITHUB_TOKEN in tools/open-house-admin/.env — expires periodically,
  regenerate at github.com → Settings → Developer settings → Tokens (classic)
  repo scope required
- "Sync all to GitHub" button commits all local files to repo
- Properties tab: create/edit/delete properties, upload hero + gallery
- Events tab: create/edit/delete events, + button duplicates event (clears date)
- Images stored in public/uploads/[property-slug]/[filename]
- Each property should have unique photos — filenames like Front.jpg can
  exist in multiple slugs since they're in separate subdirectories

### Image upload pipeline (fixed)
putFile() function handles all GitHub API writes with:
- SHA validation (40-char hex or null)
- Retry on 422 (stale SHA race condition)
- Creates new file if SHA is null, updates if SHA present
- All four write paths (upload, sync-all, property save, event save)
  route through this single function

## Common Debugging

# Check what's live vs local build:
curl -s 'https://bluegecko.homes' | grep "stella-loader\|lead-form"

# Test lead API:
curl -s -X POST 'https://bluegecko.homes/api/lead' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'name=Test&email=test@test.com&formType=general-inquiry&redirectTo=/thank-you'
# Should return: {"success":true,"redirect":"/thank-you"}

## Stale Files (cleanup needed)
Root-level files from an early static site attempt — NOT part of Astro build:
README.md, bg.js, contact.html, index.html, open-house.html,
style.css, assets/ folder
Delete these in a future cleanup commit.

## What NOT to Do
- Never use Vite transformIndexHtml for script injection
- Never use Buffer.from() — Cloudflare Workers doesn't have Buffer
- Never return 302 redirects from API routes — Cloudflare swallows them
- Never commit .env — FUB_API_KEY goes in Cloudflare Pages Secrets
- Never set min-width: 920px on the search iframe mobile breakpoint
- Never touch the CB strip styling — Coldwell Banker requirement
- Never re-add the legalText toggle script to BaseLayout.astro
- Never run npx wrangler deploy directly — use GitHub Actions only
- Never add "main" field to wrangler.jsonc — breaks deployment
- Never add "assets.binding" to wrangler.jsonc — causes assets-only error
- Never change the deploy mechanism without reading the deployment section

## Planned Features (not yet built)

### Builder Incentives Dashboard
- Landing page at /incentives (or /new-homes)
- Data fed by TSoT API (separate project, not yet online)
- Design TBD — build begins when TSoT data feed is available

## Current State
- Stella trigger buttons working (data-stella-trigger="open")
- Contact form → thank-you redirect working
- FUB lead capture working
- IDX search with 64px universal crop working
- Privacy page live at /privacy — registered with FUB and Meta
- Footer legal bar: FAQ (conditional) + Contact + Privacy links + plain-English paragraph
- GitHub Actions auto-deploy working via cloudflare/wrangler-action@v3
- Open house system live: listing, detail, archive pages
- Open house admin tool working at port 3333 (Tailscale access)
- Image upload pipeline fixed — putFile() with SHA retry
- Open house nav: /open-house (not test-open-house)
- 4 properties still need real photos re-uploaded by Lucky:
  296-delake-rd-nw, 4645-pagosa-springs-circle-melbourne,
  480-park-ave, 4926-barr-street
- Content collections live: faq, blog, communities, builders
  All 4 are empty — pages build clean, nav links hidden until entries added
  Routes: /faq, /faq/[slug], /blog, /blog/[slug],
          /communities, /communities/[slug], /builders, /builders/[slug]
- Nav auto-activates: Builders/Communities/Blog links appear when collection has content

## Branching Workflow (REQUIRED)

1. git pull origin main
2. git checkout -b [type/description]
   Types: fix/ feature/ content/ style/
3. Make all changes on branch
4. Push branch, get approval before merging
5. Merge: git checkout main && git merge [branch] && git push && git branch -d [branch]

Branch previews do NOT work with this non-standard Worker setup.
Review code changes directly before merging to main.

Exception: CLAUDE.md updates and single-file content additions that
cannot break existing pages may go direct to main — ask first.
