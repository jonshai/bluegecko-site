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
  const address = data.get('address')?.toString() || data.get('property_address')?.toString() || '';

  // Visit event: formType=seller with no email means an automatic page-load ping,
  // not a user-submitted form. Route to a distinct event type and return without redirect.
  const isVisitEvent = formType === 'seller' && !email;

  const url = new URL(request.url);
  const referrer = request.headers.get('referer');
  const utm_source = detectSource(url, referrer);

  const payload = {
    event: isVisitEvent ? 'prospect_visit'
      : formType === 'open-house' ? 'open_house_rsvp'
      : formType === 'seller' ? 'seller_inquiry'
      : formType === 'buyer' ? 'buyer_inquiry'
      : 'site_contact',
    property_address: address,
    slug: slug || undefined,
    // For visit events, message carries the source string (e.g. "BG Web - P1") — use it
    // directly as utm_source so it lands in the source column, not notes.
    utm_source: isVisitEvent ? (message || undefined) : (utm_source || undefined),
    name: name || undefined,
    email: email || undefined,
    phone: phone || undefined,
    notes: isVisitEvent ? undefined : (message || undefined),
    timestamp: new Date().toISOString(),
  };

  await Promise.allSettled([
    sendLeadEmail(payload),
    logLeadToSheet(payload),
    sendLeadSms(payload),
  ]);

  if (isVisitEvent) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, redirect: redirectTo }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
