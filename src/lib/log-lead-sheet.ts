import { getSheetsToken } from './google-auth';
import type { LeadPayload } from './send-lead-email';

const HEADER_ROW = ['Timestamp', 'Event', 'Property Address', 'Slug', 'UTM Source', 'Outbound Label', 'FUB Contact ID'];

export async function logLeadToSheet(payload: LeadPayload): Promise<void> {
  const sheetId = import.meta.env.GOOGLE_SHEETS_LEAD_LOG_ID as string | undefined;
  if (!sheetId) {
    console.warn('[log-lead-sheet] GOOGLE_SHEETS_LEAD_LOG_ID not set — skipping');
    return;
  }

  let token: string;
  try {
    token = await getSheetsToken();
  } catch (e) {
    console.error('[log-lead-sheet] Failed to get Sheets token:', e);
    return;
  }

  try {
    // Check if sheet is empty by reading A1
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const checkData = await checkRes.json() as { values?: string[][] };
    const isEmpty = !checkData.values || checkData.values.length === 0;

    if (isEmpty) {
      // Write header row first
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:G1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [HEADER_ROW] }),
        }
      );
    }

    // Append data row
    const row = [
      payload.timestamp,
      payload.event,
      payload.property_address,
      payload.slug ?? '',
      payload.utm_source ?? '',
      payload.outbound_label ?? '',
      payload.fub_contact_id ?? '',
    ];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:G1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      }
    );
    if (!appendRes.ok) {
      console.error('[log-lead-sheet] Sheets append error:', appendRes.status, await appendRes.text());
    }
  } catch (e) {
    console.error('[log-lead-sheet] Sheets logging failed:', e);
  }
}
