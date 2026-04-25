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

### Cloudflare Pages Setup
- Output directory: dist/client (NOT dist/)
- Worker entry: dist/client/_worker.js (copied by inject-scripts.mjs)
- Server chunks: dist/client/chunks/ (copied by inject-scripts.mjs)
- Environment variables: set as Secrets in Cloudflare Pages dashboard
  FUB_API_KEY — set as Secret, not in .env (gitignored)
- wrangler.jsonc: do NOT add "main" field — breaks deployment
- checkOrigin: false in astro.config.mjs (required for form POST)

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

## Git / Deploy Workflow
- CC pushes directly to remote — GitHub Desktop requires Pull after
  CC commits or local changes will conflict
- GitHub → Cloudflare auto-deploy confirmed working on push to main
- Deploy: git add -A && git commit -m "description" && git push origin main
- Verify: curl -s 'https://bluegecko.homes' | grep "stella-loader"

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

## Planned Features (not yet built)

### Content Collections
- /communities/[slug] — community spotlights (Vera writes, photo + article)
- /builders/[slug]    — builder spotlights (same workflow)
- /blog/[slug]        — market updates, open house recaps, neighborhood guides
- /faq/[slug]         — Q&A pages targeting AEO queries
- Workflow: Vera writes Markdown → commits to GitHub → Cloudflare auto-deploys
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
- SMS compliance text in place
- Privacy page live at /privacy
- Footer legal bar simplified
