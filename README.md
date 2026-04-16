# Blue Gecko Website
### William & Jennifer "Lucky" Whipple · Coldwell Banker Realty · Space Coast, FL

---

## Deploy to Netlify (first time)

1. Go to **netlify.com/drop**
2. Drag this entire `bluegecko/` folder into the drop zone
3. Netlify gives you a URL instantly (e.g. `sunny-gecko-abc123.netlify.app`)
4. Share that URL — it's your live prototype

To update after changes:
- Sign up for a free Netlify account and claim your site
- Drag the updated folder again, or connect to GitHub for auto-deploy

To connect `bluegecko.homes`:
- Netlify Dashboard → Site Settings → Domain Management → Add custom domain

---

## File structure

```
bluegecko/
├── index.html          Homepage
├── open-house.html     Open house landing page (duplicate + edit for each)
├── contact.html        Contact / general lead capture
├── style.css           Shared design system — edit colors/fonts here
├── bg.js               Shared nav, footer, FUB form handler
├── assets/
│   ├── team.jpg        William & Lucky together (hero photo)
│   ├── william.jpg     William solo
│   └── lucky.jpg       Lucky solo
└── README.md           This file
```

---

## TODO before go-live

### Required
- [ ] Add your FL license numbers in `index.html`, `open-house.html`, `contact.html`
      (search for `FL License #XXXXXXX`)
- [ ] Add FUB API key — in each page's `<script>` block, replace `YOUR_FUB_API_KEY`
      Get it from: FUB Admin → Settings → API → Create new key
- [ ] Add Web3Forms key as backup email capture — free at web3forms.com
      Replace `YOUR_WEB3FORMS_KEY` in each form's script block
- [ ] Replace IDX search URL in `index.html`
      Search for `YOUR-MOXI-IDX-URL` and replace with your Moxi IDX search endpoint
- [ ] Add Facebook Pixel — uncomment the pixel block in each page's `<head>`
      Replace `YOUR_PIXEL_ID` with your pixel ID from Meta Business Manager

### Nice to have
- [ ] Add real property photos to open house cards on homepage
      Replace `oh-thumb-placeholder` divs with `<img>` tags
- [ ] Add property exterior photo to `open-house.html` hero
      Uncomment the `<img class="oh-hero-img">` line and replace src
- [ ] Duplicate `open-house.html` for each new open house — update address, date, price, details
- [ ] Add Google Analytics (GA4) — paste your `<script>` tag in each `<head>`

---

## FUB integration notes

The form handler in `bg.js` posts to the FUB People API (`/v1/people`).
Each lead is created with:
- Name, email, phone
- Source tag (e.g. "Open House RSVP", "Website Contact Form")
- A note with page context, interest, and TCPA consent timestamp

FUB API docs: https://followupboss.com/api
Your FUB API key: FUB Admin → Settings → API

**Action plans**: After the API key is in, set up FUB action plans for each source tag
so leads are automatically assigned and follow-up sequences start.

---

## Adding new campaign pages

To create a new landing page (webinar, buyer seminar, market report, etc.):
1. Duplicate `open-house.html` or `contact.html`
2. Update the `<title>`, `<meta description>`, and `<og:*>` tags
3. Edit the hero, form fields, and success message
4. Update the `bgSubmitForm()` call with a new `source` value
5. Add to nav in `bg.js` if it should appear in main navigation

Each page gets its own URL, its own FB/IG ad campaign, and its own FUB source tag
for tracking which campaigns are generating leads.

---

## Platform portability

This site is plain HTML + CSS + JS. No framework, no build step.
To move to any other host:
- **Cloudflare Pages**: same drag-and-drop, or connect GitHub
- **GitHub Pages**: push the folder to a repo, enable Pages in Settings
- **Traditional host**: FTP the folder to `public_html`
- **Vercel**: `vercel deploy` from the folder

The FUB API calls are client-side and work from any host.

---

## Design system quick reference

Edit `style.css` to change site-wide styles.
Key variables at the top of the file:

```css
--navy:      #1B3A5C   /* Primary dark color */
--teal:      #2BBFAB   /* Primary action color */
--teal-dark: #0D8A7A   /* Hover states */
--sand:      #F7F3EC   /* Page background */
--warm-white:#FDFAF6   /* Card/section background */
```

Colors come from the Blue Gecko logo.
CB blue `#003399` is used only for the Coldwell Banker badge in the footer.
