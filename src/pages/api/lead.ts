import type { APIRoute } from 'astro';
export const prerender = false;

function detectSource(url: URL, referrer: string | null) {
  const utm_source = url.searchParams.get('utm_source');
  const utm_medium = url.searchParams.get('utm_medium');

  if (utm_source) {
    const s = utm_source.toLowerCase();

    if (s.includes('instagram')) return 'IG Ad';
    if (s.includes('facebook')) return 'FB Ad';
    if (s.includes('google') && utm_medium === 'cpc') return 'Google Paid';
    if (s.includes('google')) return 'Google Organic';
  }

  if (url.pathname.includes('/open-house')) {
    return 'Open House';
  }

  if (referrer) {
    const r = referrer.toLowerCase();

    if (r.includes('google')) return 'Google Organic';
    if (r.includes('instagram')) return 'IG Ad';
    if (r.includes('facebook')) return 'FB Ad';
    if (r.includes('realtor')) return 'Referral';
    if (r.includes('claude') || r.includes('openai')) return 'Referral';
  }

  return 'BG Web';
}

function buildTags(url: URL, referrer: string | null, slug?: string, formType?: string) {
  const tags: string[] = [];

  const utm_source = url.searchParams.get('utm_source');
  const utm_medium = url.searchParams.get('utm_medium');
  const utm_campaign = url.searchParams.get('utm_campaign');

  if (utm_source) tags.push(`src:${utm_source}`);
  if (utm_medium) tags.push(`med:${utm_medium}`);
  if (utm_campaign) tags.push(`camp:${utm_campaign}`);

  if (url.pathname.includes('/open-house')) {
    tags.push('page:open-house');
  }

  if (slug) {
    tags.push(`slug:${slug}`);
  }

  if (formType) {
    tags.push(`form:${formType}`);
  }

  if (referrer) {
    try {
      const refHost = new URL(referrer).hostname;
      tags.push(`ref:${refHost}`);
    } catch {}
  }

  return tags;
}

async function parseRequestData(request: Request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return { form, raw: '' };
  }

  const raw = await request.text();
  const form = new FormData();
  if (raw) {
    const params = new URLSearchParams(raw);
    for (const [key, value] of params.entries()) {
      form.append(key, value);
    }
  }
  return { form, raw };
}

export const POST: APIRoute = async ({ request }) => {
  const { form: data, raw } = await parseRequestData(request);
  const name = data.get('name')?.toString() || '';
  const email = data.get('email')?.toString() || '';
  const phone = data.get('phone')?.toString() || '';
  const message = data.get('message')?.toString() || '';
  const slug = data.get('slug')?.toString() || '';
  const sourceOverride = data.get('sourceOverride')?.toString() || '';
  const formType = data.get('formType')?.toString() || 'general-inquiry';
  const redirectTo = data.get('redirectTo')?.toString() || '/thank-you';
  const contentType = request.headers.get('content-type') || 'none';

  const url = new URL(request.url);
  const referrer = request.headers.get('referer');

  const source = sourceOverride || detectSource(url, referrer);
  const tags = buildTags(url, referrer, slug, formType);

  const eventType = formType === 'open-house'
    ? 'Visited Open House'
    : formType === 'seller'
      ? 'Seller Inquiry'
      : formType === 'buyer'
        ? 'Buyer Inquiry'
        : 'General Inquiry';

  const contactName = name || email || phone || 'Website Lead';

  const emails = email
    ? [{ value: email, type: 'work' }]
    : [];

  const phones = phone
    ? [{ value: phone, type: 'mobile' }]
    : [];

  const note = `
New lead from Blue Gecko

Name: ${name}
Email: ${email}
Phone: ${phone}
Form Type: ${formType}

Message:
${message}

Source: ${source}
URL: ${url.toString()}
Referrer: ${referrer || 'none'}
Tags: ${tags.join(', ')}
Content-Type: ${contentType}
Raw Body: ${raw || 'none'}
  `;

  const fubRes = await fetch('https://api.followupboss.com/v1/events', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${import.meta.env.FUB_API_KEY}:`),
      'Content-Type': 'application/json',
      'X-System': import.meta.env.FUB_SYSTEM || 'BlueGeckoSite',
      'X-System-Key': 'bluegecko-web',
    },
    body: JSON.stringify({
      source,
      system: import.meta.env.FUB_SYSTEM || 'BlueGeckoSite',
      type: eventType,
      message: message || 'Website inquiry submitted from Blue Gecko.',
      description: note,
      person: {
        name: contactName,
        emails,
        phones,
        tags,
        background: note,
      },
    }),
  });

  if (!fubRes.ok) {
    console.error('FUB ERROR', await fubRes.text());
  }

  return new Response(JSON.stringify({ success: true, redirect: redirectTo }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};