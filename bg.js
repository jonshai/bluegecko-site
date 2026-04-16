/* ============================================
   Blue Gecko — Shared Components
   nav, footer, disclaimer tabs, FUB form handler
   ============================================ */

/* Inject nav into any element with id="site-nav" */
function renderNav(activePage) {
  const pages = [
    { href: 'index.html',      label: 'Search homes' },
    { href: 'open-house.html', label: 'Open houses'  },
    { href: 'about.html',      label: 'About us'     },
  ];
  const links = pages.map(p =>
    `<li><a href="${p.href}"${activePage === p.href ? ' aria-current="page"' : ''}>${p.label}</a></li>`
  ).join('');

  document.getElementById('site-nav').innerHTML = `
    <nav class="nav">
      <a href="index.html" class="nav-brand">
        <div class="nav-mark">BG</div>
        <div>
          <div class="nav-brand-name">Blue Gecko</div>
          <div class="nav-brand-sub">Coldwell Banker Realty · Space Coast</div>
        </div>
      </a>
      <ul class="nav-links">${links}</ul>
      <a href="contact.html" class="nav-cta">Say hello</a>
      <button class="nav-mobile-toggle" aria-label="Menu" onclick="toggleMobileNav(this)">
        <span></span><span></span><span></span>
      </button>
    </nav>
    <div id="mobile-nav" style="display:none;background:var(--warm-white);border-bottom:1px solid var(--border);padding:12px 18px 18px;">
      ${pages.map(p => `<a href="${p.href}" style="display:block;padding:10px 0;font-size:15px;color:var(--text-navy);border-bottom:1px solid var(--border);">${p.label}</a>`).join('')}
      <a href="contact.html" class="btn btn-primary" style="margin-top:14px;display:block;text-align:center;">Say hello</a>
    </div>
  `;
}

function toggleMobileNav(btn) {
  const nav = document.getElementById('mobile-nav');
  nav.style.display = nav.style.display === 'none' ? 'block' : 'none';
}

/* Inject footer into any element with id="site-footer" */
function renderFooter() {
  document.getElementById('site-footer').innerHTML = `
    <footer class="footer">
      <div class="footer-top">
        <div>
          <div class="footer-brand-name">Blue Gecko · Coldwell Banker Realty</div>
          <div class="footer-brand-sub">
            William &amp; Jennifer Whipple · FL Lic. #3535381 / #3535380<br>
            Palm Bay · Melbourne · Sebastian · Space Coast, FL
          </div>
        </div>
        <div class="footer-badges">
          <div class="cb-badge">COLDWELL<br>BANKER®</div>
          <div class="eho-badge">EQUAL<br>HOUSING<br>OPP.</div>
        </div>
      </div>
      <div class="footer-disclaimers">
        <div class="disc-tabs">
          <button class="disc-tab active" onclick="showDisc('tcpa',this)">Contact consent</button>
          <button class="disc-tab" onclick="showDisc('ai',this)">AI use</button>
          <button class="disc-tab" onclick="showDisc('re',this)">Real estate</button>
          <button class="disc-tab" onclick="showDisc('cb',this)">Brokerage</button>
        </div>
        <div id="disc-tcpa" class="disc-panel active">
          By sharing your contact information, you agree that William and Jennifer Whipple / Blue Gecko / Coldwell Banker Realty may reach out by phone, text, or email — including AI-assisted and automated messages — about real estate topics. Message and data rates may apply. Reply STOP to opt out of texts anytime. We never sell your information.
        </div>
        <div id="disc-ai" class="disc-panel">
          We use AI tools to help us work smarter and respond faster — including automated follow-up messages. When you interact with Blue Gecko online or receive communications from us, AI may be involved. We think you deserve to know that. A real person — William or Lucky — is always reachable if you prefer.
        </div>
        <div id="disc-re" class="disc-panel">
          William Whipple and Jennifer "Lucky" Whipple are licensed real estate agents in Florida with Coldwell Banker Realty. All property information is deemed reliable but not guaranteed and should be independently verified. Market data is for informational purposes only. © ${new Date().getFullYear()} Coldwell Banker Real Estate LLC. Coldwell Banker® is a registered trademark.
        </div>
        <div id="disc-cb" class="disc-panel">
          Blue Gecko operates as a licensed real estate team within Coldwell Banker Realty. Coldwell Banker Realty fully supports the principles of the Fair Housing Act and the Equal Opportunity Act. Each Coldwell Banker Realty office is independently owned and operated.
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Blue Gecko · Coldwell Banker Realty · William &amp; Jennifer Whipple</span>
        <span>Licensed in Florida · Each office independently owned and operated</span>
      </div>
    </footer>
  `;
}

/* Disclaimer tab switcher */
function showDisc(id, btn) {
  document.querySelectorAll('.disc-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.disc-tab').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('disc-' + id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
}

/* ============================================
   Follow Up Boss form submission handler
   Usage: bgSubmitForm(formEl, fubApiKey, redirectUrl)
   
   FUB Web API docs: https://followupboss.com/api
   Replace FUB_API_KEY with your actual key from
   FUB Admin > Settings > API
   ============================================ */
async function bgSubmitForm(formEl, opts = {}) {
  const btn = formEl.querySelector('.form-submit');
  const originalText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

  const data = Object.fromEntries(new FormData(formEl));

  /* --- FUB payload --- */
  const fubPayload = {
    source:    opts.source    || 'Blue Gecko Website',
    system:    opts.system    || 'Website',
    type:      opts.leadType  || 'Buyer',
    firstName: data.firstName || '',
    lastName:  data.lastName  || '',
    emails:    data.email ? [{ value: data.email, type: 'work' }] : [],
    phones:    data.phone ? [{ value: data.phone, type: 'mobile' }] : [],
    note:      buildNote(data, opts),
  };

  /* --- Consent record (TCPA) --- */
  fubPayload.note += `\n\n[TCPA consent recorded: ${new Date().toISOString()} — web form submission on bluegecko.homes]`;

  try {
    /* FUB People API */
    if (opts.fubApiKey) {
      const res = await fetch('https://api.followupboss.com/v1/people', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(opts.fubApiKey + ':'),
        },
        body: JSON.stringify(fubPayload),
      });
      if (!res.ok) throw new Error('FUB error: ' + res.status);
    }

    /* Fallback / backup: Web3Forms (free, no server needed) */
    if (opts.web3Key) {
      await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: opts.web3Key,
          subject:    opts.emailSubject || 'New lead — Blue Gecko',
          from_name:  'Blue Gecko Website',
          ...data,
        }),
      });
    }

    /* Show success state */
    const formContent = formEl.querySelector('.form-fields');
    const successEl   = formEl.querySelector('.form-success');
    if (formContent) formContent.style.display = 'none';
    if (successEl)   successEl.style.display = 'block';

    if (opts.redirect) {
      setTimeout(() => { window.location.href = opts.redirect; }, 1800);
    }

  } catch (err) {
    console.error('Form error:', err);
    if (btn) { btn.textContent = 'Something went wrong — please try again'; btn.disabled = false; }
  }
}

function buildNote(data, opts) {
  const parts = [];
  if (opts.pageContext)   parts.push(`Page: ${opts.pageContext}`);
  if (data.interest)      parts.push(`Interest: ${data.interest}`);
  if (data.hasAgent)      parts.push(`Has agent: ${data.hasAgent}`);
  if (data.message)       parts.push(`Message: ${data.message}`);
  if (data.propertyAddr)  parts.push(`Property: ${data.propertyAddr}`);
  return parts.join('\n');
}
