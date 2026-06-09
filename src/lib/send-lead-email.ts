import { getGmailToken } from './google-auth';

export interface LeadPayload {
  event: string;
  property_address: string;
  slug?: string;
  utm_source?: string;
  outbound_label?: string;
  fub_contact_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  timestamp: string;
}

function toBase64Url(str: string): string {
  // btoa works in Cloudflare Workers runtime
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildEmailBody(payload: LeadPayload): string {
  const lines: string[] = [];
  if (payload.event) lines.push(`Event: ${payload.event}`);
  if (payload.property_address) lines.push(`Property: ${payload.property_address}`);
  if (payload.slug) lines.push(`Slug: ${payload.slug}`);
  if (payload.name) lines.push(`Name: ${payload.name}`);
  if (payload.email) lines.push(`Email: ${payload.email}`);
  if (payload.phone) lines.push(`Phone: ${payload.phone}`);
  if (payload.utm_source) lines.push(`UTM Source: ${payload.utm_source}`);
  if (payload.outbound_label) lines.push(`Outbound Label: ${payload.outbound_label}`);
  if (payload.fub_contact_id) lines.push(`FUB Contact ID: ${payload.fub_contact_id}`);
  if (payload.notes) lines.push(`Notes: ${payload.notes}`);
  lines.push(`Timestamp: ${payload.timestamp}`);
  return lines.join('\n');
}

export async function sendLeadEmail(payload: LeadPayload): Promise<void> {
  const toWilliam = import.meta.env.NOTIFICATION_EMAIL_WILLIAM as string | undefined;
  const toLucky = import.meta.env.NOTIFICATION_EMAIL_LUCKY as string | undefined;

  const recipients = [toWilliam, toLucky].filter(Boolean) as string[];
  if (recipients.length === 0) {
    console.warn('[send-lead-email] No notification email addresses configured — skipping');
    return;
  }

  let token: string;
  try {
    token = await getGmailToken();
  } catch (e) {
    console.error('[send-lead-email] Failed to get Gmail token:', e);
    return;
  }

  let subject: string;
  if (payload.event === 'prospect_visit') {
    // Automatic page-load ping from a prospecting page — not a form submission.
    const who = payload.name || 'Unknown';
    const part = payload.notes || 'BG Web - P0';
    subject = `Prospect visit: ${who} — ${part}`;
  } else {
    const eventLabels: Record<string, string> = {
      open_house_rsvp: 'Open House RSVP',
      seller_inquiry: 'Seller Inquiry',
      buyer_inquiry: 'Buyer Inquiry',
      site_contact: 'Site Contact',
    };
    const eventLabel = eventLabels[payload.event] ?? payload.event;
    const who = payload.name || payload.email || 'Unknown';
    const source = payload.utm_source || 'Web';
    subject = `New Lead: ${eventLabel} - ${who} (${source})`;
  }
  const body = buildEmailBody(payload);
  const toHeader = recipients.join(', ');

  const message = [
    `From: Blue Gecko <wmswhipple@gmail.com>`,
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    body,
  ].join('\r\n');

  const raw = toBase64Url(message);

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      console.error('[send-lead-email] Gmail API error:', res.status, await res.text());
    }
  } catch (e) {
    console.error('[send-lead-email] Gmail send failed:', e);
  }
}
