import type { APIRoute } from 'astro';
import { sendLeadEmail } from '../../lib/send-lead-email';
import { logLeadToSheet } from '../../lib/log-lead-sheet';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();
  const slug = String(body.slug || '').trim();
  const property_address = String(body.property_address || '').trim();
  const utm_source = String(body.utm_source || '').trim();
  const fub_contact_id = body.fub_contact_id ? String(body.fub_contact_id).trim() : undefined;

  // Require at least one contact method
  if (!name && !email && !phone) {
    return new Response(JSON.stringify({ ok: false, error: 'Name, email, or phone required' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = {
    event: 'seller_outreach_contact',
    property_address,
    slug: slug || undefined,
    utm_source: utm_source || undefined,
    fub_contact_id,
    name: name || undefined,
    email: email || undefined,
    phone: phone || undefined,
    timestamp: new Date().toISOString(),
  };

  await Promise.allSettled([
    sendLeadEmail(payload),
    logLeadToSheet(payload),
  ]);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
