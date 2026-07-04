export async function sendOmWebhook(ref: string, timestamp: string, userAgent: string): Promise<void> {
  const webhookUrl = import.meta.env.OM_WEBHOOK_URL as string | undefined;
  const webhookSecret = import.meta.env.OM_WEBHOOK_SECRET as string | undefined;

  if (!webhookUrl) {
    console.warn('[send-om-webhook] OM_WEBHOOK_URL not set — skipping');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(webhookSecret ? { 'X-Webhook-Secret': webhookSecret } : {}),
      },
      body: JSON.stringify({ ref, timestamp, user_agent: userAgent }),
    });
    if (!res.ok) {
      console.error('[send-om-webhook] Webhook responded with error:', res.status);
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.error('[send-om-webhook] Webhook timed out after 3s');
    } else {
      console.error('[send-om-webhook] Webhook request failed:', e);
    }
  } finally {
    clearTimeout(timeout);
  }
}
