export async function getGmailToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: import.meta.env.GOOGLE_CLIENT_ID,
      client_secret: import.meta.env.GOOGLE_CLIENT_SECRET,
      refresh_token: import.meta.env.GOOGLE_GMAIL_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    throw new Error(`[google-auth] Gmail token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error('[google-auth] Gmail token refresh response missing access_token');
  }
  return data.access_token;
}

export async function getSheetsToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: import.meta.env.GOOGLE_CLIENT_ID,
      client_secret: import.meta.env.GOOGLE_CLIENT_SECRET,
      refresh_token: import.meta.env.GOOGLE_SHEETS_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    throw new Error(`[google-auth] Sheets token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error('[google-auth] Sheets token refresh response missing access_token');
  }
  return data.access_token;
}
