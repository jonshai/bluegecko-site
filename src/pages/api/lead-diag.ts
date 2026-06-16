import type { APIRoute } from 'astro';
import { getGmailToken, getSheetsToken } from '../../lib/google-auth';

export const prerender = false;

export const GET: APIRoute = async () => {
  // 1. Check env vars (present/missing only — no values)
  const envVars: Record<string, 'present' | 'missing'> = {};
  for (const key of [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_GMAIL_REFRESH_TOKEN',
    'GOOGLE_SHEETS_REFRESH_TOKEN',
    'GOOGLE_SHEETS_LEAD_LOG_ID',
    'NOTIFICATION_EMAIL_WILLIAM',
    'NOTIFICATION_EMAIL_LUCKY',
  ]) {
    envVars[key] = import.meta.env[key] ? 'present' : 'missing';
  }

  // 2. Test Gmail token refresh
  let gmailSuccess = false;
  let gmailError: string | null = null;
  let gmailTokenPrefix: string | null = null;
  try {
    const token = await getGmailToken();
    gmailSuccess = true;
    gmailTokenPrefix = token.slice(0, 6);
  } catch (e) {
    gmailError = e instanceof Error ? e.message : String(e);
  }

  // 3. Test Sheets token refresh
  let sheetsSuccess = false;
  let sheetsError: string | null = null;
  let sheetsTokenPrefix: string | null = null;
  let sheetsAppendStatus: number | null = null;
  let sheetsAppendBody: string | null = null;

  try {
    const token = await getSheetsToken();
    sheetsSuccess = true;
    sheetsTokenPrefix = token.slice(0, 6);

    // 4. Test Sheets append (only if token succeeded)
    const sheetId = import.meta.env.GOOGLE_SHEETS_LEAD_LOG_ID;
    if (sheetId) {
      const diagRow = [
        'DIAG-TEST',
        'prospect_visit',
        'Diag Test',
        '',
        '',
        'BG Web - P1',
        '123 Test St',
        'diag-test',
        'BG Web',
      ];
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [diagRow] }),
        }
      );
      sheetsAppendStatus = appendRes.status;
      const rawBody = await appendRes.text();
      sheetsAppendBody = rawBody.slice(0, 300);
    } else {
      sheetsAppendBody = 'skipped — GOOGLE_SHEETS_LEAD_LOG_ID missing';
    }
  } catch (e) {
    sheetsError = e instanceof Error ? e.message : String(e);
  }

  const report = {
    gmail: {
      success: gmailSuccess,
      tokenPrefix: gmailTokenPrefix,
      error: gmailError,
    },
    sheets: {
      success: sheetsSuccess,
      tokenPrefix: sheetsTokenPrefix,
      error: sheetsError,
      appendStatus: sheetsAppendStatus,
      appendBody: sheetsAppendBody,
    },
    env: envVars,
  };

  return new Response(JSON.stringify(report, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
