import type { APIRoute } from 'astro';
import { sendLeadEmail } from '../../lib/send-lead-email';
import { logLeadToSheet } from '../../lib/log-lead-sheet';
import { sendLeadSms } from '../../lib/send-lead-sms';

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

  if (url.pathname.includes('/open-house')) return 'Open House';

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

async function parseRequestData(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return { form };
  }
  const raw = await request.text();
  const form = new FormData();
  if (raw) {
    const params = new URLSearchParams(raw);
    for (const [key, value] of params.entries()) {
      form.append(key, value);
    }
  }
  return { form };
}

export const POST: APIRoute = async ({ request }) => {
  const { form: data } = await parseRequestData(request);
  const name = data.get('name')?.toString() || '';
  const email = data.get('email')?.toString() || '';
  const phone = data.get('phone')?.toString() || '';
  const message = data.get('message')?.toString() || '';
  const slug = data.get('slug')?.toString() || '';
  const formType = data.get('formType')?.toString() || 'general-inquiry';
  const redirectTo = data.get('redirectTo')?.toString() || '/thank-you';

  const url = new URL(request.url);
  const referrer = request.headers.get('referer');
  const utm_source = detectSource(url, referrer);

  const payload = {
    event: formType === 'open-house' ? 'open_house_rsvp'
      : formType === 'seller' ? 'seller_inquiry'
      : formType === 'buyer' ? 'buyer_inquiry'
      : 'site_contact',
    property_address: data.get('property_address')?.toString() || '',
    slug: slug || undefined,
    utm_source: utm_source || undefined,
    name: name || undefined,
    email: email || undefined,
    phone: phone || undefined,
    notes: message || undefined,
    timestamp: new Date().toISOString(),
  };

  const results = await Promise.allSettled([
    sendLeadEmail(payload),
    logLeadToSheet(payload),
    sendLeadSms(payload),
  ]);

  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => (r as PromiseRejectedResult).reason?.message || String((r as PromiseRejectedResult).reason));

  if (errors.length > 0) {
    return new Response(JSON.stringify({ success: false, errors }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, redirect: redirectTo }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
