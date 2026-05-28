import type { APIRoute } from 'astro';
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

  const webhookUrl = import.meta.env.ORPHAN_WEBHOOK_URL as string | undefined;

  // Fire webhook (fire-and-forget)
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  // Log to Sheets
  await logLeadToSheet({
    event: String(body.event || 'outreach_event'),
    property_address: String(body.property_address || ''),
    slug: body.slug ? String(body.slug) : undefined,
    utm_source: body.utm_source ? String(body.utm_source) : undefined,
    outbound_label: body.outbound_label ? String(body.outbound_label) : undefined,
    fub_contact_id: body.fub_contact_id ? String(body.fub_contact_id) : undefined,
    timestamp: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
