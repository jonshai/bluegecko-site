export interface SmsPayload {
  event: string;
  name?: string;
  email?: string;
  phone?: string;
  property_address?: string;
  utm_source?: string;
}

const eventLabels: Record<string, string> = {
  open_house_rsvp: 'Open House RSVP',
  seller_inquiry: 'Seller Inquiry',
  buyer_inquiry: 'Buyer Inquiry',
  site_contact: 'Site Contact',
};

export async function sendLeadSms(payload: SmsPayload): Promise<void> {
  const accountSid = import.meta.env.TWILIO_ACCOUNT_SID as string | undefined;
  const authToken = import.meta.env.TWILIO_AUTH_TOKEN as string | undefined;
  const fromNumber = import.meta.env.TWILIO_FROM_NUMBER as string | undefined;
  const toWilliam = import.meta.env.TWILIO_TO_WILLIAM as string | undefined;
  const toLucky = import.meta.env.TWILIO_TO_LUCKY as string | undefined;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[send-lead-sms] Twilio credentials not configured — skipping');
    return;
  }

  const recipients = [toWilliam, toLucky].filter(Boolean) as string[];
  if (recipients.length === 0) {
    console.warn('[send-lead-sms] No recipient numbers configured — skipping');
    return;
  }

  const label = eventLabels[payload.event] ?? payload.event;
  const who = payload.name || 'Unknown';
  const contact = [payload.email, payload.phone].filter(Boolean).join(' | ') || 'No contact info';
  const source = payload.utm_source || 'Web';
  const property = payload.property_address ? `\nProperty: ${payload.property_address}` : '';

  const body = `New BG Lead: ${label}\n${who} | ${contact}\nSource: ${source}${property}`;

  const credentials = btoa(`${accountSid}:${authToken}`);

  for (const to of recipients) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ From: fromNumber, To: to, Body: body }),
        }
      );
      if (!res.ok) {
        console.error('[send-lead-sms] Twilio error:', res.status, await res.text());
      }
    } catch (e) {
      console.error('[send-lead-sms] SMS send failed:', e);
    }
  }
}

