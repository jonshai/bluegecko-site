import { getSheetsToken } from './google-auth';

const HEADER_ROW = ['Timestamp', 'ref', 'User Agent', 'Page', 'Source'];

export async function logOmScan(ref: string, userAgent: string, timestamp: string): Promise<void> {
  const sheetId = import.meta.env.OM_SHEET_ID as string | undefined;
  console.log('[diagnostic] OM_SHEET_ID present:', !!sheetId, 'length:', sheetId?.length ?? 0);
  if (!sheetId) {
    console.warn('[log-om-scan] OM_SHEET_ID not set — skipping');
    return;
  }

  let token: string;
  try {
    token = await getSheetsToken();
  } catch (e) {
    console.error('[log-om-scan] Failed to get Sheets token:', e);
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
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
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

    const row = [timestamp, ref, userAgent, 'bluegecko.homes/list-my-house', 'OM'];

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
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
      console.error('[log-om-scan] Sheets append error:', appendRes.status, await appendRes.text());
    }
  } catch (e) {
    console.error('[log-om-scan] Sheets logging failed:', e);
  }
}
