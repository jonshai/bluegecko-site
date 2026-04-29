# bluegecko-site — Blue Gecko Real Estate Website
# Claude Code Context File — Read this before doing anything

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
    api/lead.ts              — FUB lead submission API
  components/
    LeadForm.astro           — reusable lead form
public/
  stella-loader.js           — loads Stella widget from PANTHEON
  lead-form.js               — handles contact form fetch submission
scripts/
  inject-scripts.mjs         — post-build script injection
.github/workflows/
  deploy.yml                 — GitHub Actions auto-deploy (only deploy mechanism)

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
- Simplified to: single <a href="/privacy"> link + plain-English
  Pro Whimsy paragraph
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

### Verification
After deploy completes:
curl -s 'https://bluegecko.homes' | grep "stella-loader"

### CC pushes directly to remote
GitHub Desktop requires Pull after CC commits or local changes conflict.

## Common Debugging

# Check what's live vs local build:
curl -s 'https://bluegecko.homes' | grep "stella-loader\|lead-form"
grep "stella-loader" dist/client/index.html

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
- Never change the deploy mechanism without reading the deployment section above

## Planned Features (not yet built)

### Content Collections
- /communities/[slug] — community spotlights (Vera writes, photo + article)
- /builders/[slug]    — builder spotlights (same workflow)
- /blog/[slug]        — market updates, open house recaps, neighborhood guides
- /faq/[slug]         — Q&A pages targeting AEO queries
- Workflow: Vera writes Markdown → commits to GitHub → Actions auto-deploys
- Each page auto-generates: URL, meta tags, sitemap entry, schema markup

### Builder Incentives Dashboard
- Landing page at /incentives (or /new-homes)
- Public-facing summary of current builder incentives on the Space Coast
- Data fed by TSoT (The Source of Truth) — separate project, not yet online
- bluegecko.homes will be a consumer of the TSoT API
- Includes incentives dashboard UI + lead capture CTA
- Design TBD — build begins when TSoT data feed is available

## Current State
- All Stella trigger buttons working (data-stella-trigger="open")
- Contact form → thank-you redirect working
- FUB lead capture working
- IDX search with 64px universal crop working
- Mobile search native width working
- SMS compliance text in place (FUB-approved carrier language)
- Privacy page live at /privacy — registered with FUB and Meta
- Footer legal bar simplified
- GitHub Actions auto-deploy working via cloudflare/wrangler-action@v3
- Open house slug: /open-house/open-house (no longer test-open-house)

## Branching & Deploy Workflow (IMPORTANT)

### Default workflow for all changes
1. Pull latest main before starting: git pull origin main
2. Create a feature branch: git checkout -b [descriptive-name]
3. Make all changes on the branch — never commit directly to main
4. Push the branch: git push origin [branch-name]
5. Tell the user the branch name
6. Wait for explicit approval before merging to main
7. Merge only when user confirms: git checkout main && git merge [branch-name] && git push origin main && git branch -d [branch-name]

### Branch preview URLs
Branch pushes do NOT auto-deploy to preview URLs with this non-standard
Worker setup. Testing happens by reviewing code changes directly.
Production is ONLY updated when changes land on main via GitHub Actions.

### Exceptions
Simple safe changes (fixing a typo, updating a phone number, adding
a new content file that can't break existing pages) may go directly
to main at user's discretion — but ask first rather than assume.

### Branch naming convention
- fix/description     — bug fixes
- feature/description — new pages or functionality
- content/description — new blog, community, builder, FAQ pages
- style/description   — CSS or visual changes
