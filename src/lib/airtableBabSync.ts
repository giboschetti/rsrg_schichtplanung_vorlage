/**
 * Trigger BAB sync (Airtable → Firebase) via a trusted HTTPS endpoint that runs
 * `bab_sync_firebase.py`. Expects POST JSON `{ kwFrom?, kwTo? }` and header
 * `X-BAB-Sync-Secret` matching server configuration.
 */

/** Firestore project id for AS25 Entflechtung Wankdorf */
export const AS25_WANKDORF_PROJECT_ID = 'wy6V7o0FedgcJq0uwRVA';

export interface AirtableBabSyncOptions {
  kwFrom?: number;
  kwTo?: number;
}

export type AirtableBabSyncResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

/** Builds JSON body: omit unset KW bounds (full-project sync). */
export function bodyForAirtableBabSync(options?: AirtableBabSyncOptions): Record<string, number> {
  const body: Record<string, number> = {};
  if (options?.kwFrom != null) body.kwFrom = options.kwFrom;
  if (options?.kwTo != null) body.kwTo = options.kwTo;
  return body;
}

/**
 * POST to BAB sync URL. Caller supplies URL/secret (tests inject mocks).
 * Successful responses: 2xx with optional JSON `{ message?: string }`.
 */
export async function airtableBabSyncPost(
  url: string,
  secret: string,
  options?: AirtableBabSyncOptions,
  fetchFn: typeof fetch = fetch,
): Promise<AirtableBabSyncResult> {
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAB-Sync-Secret': secret,
      },
      body: JSON.stringify(bodyForAirtableBabSync(options)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Netzwerkfehler: ${msg}` };
  }

  let data: unknown = null;
  const ct = res.headers.get('Content-Type') ?? '';
  if (ct.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      /* ignore malformed JSON */
    }
  }

  const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const serverMsg =
    typeof obj.message === 'string'
      ? obj.message
      : typeof obj.error === 'string'
        ? obj.error
        : null;

  if (!res.ok) {
    return {
      ok: false,
      message: serverMsg ?? `HTTP ${res.status}`,
    };
  }

  return { ok: true, message: serverMsg ?? undefined };
}

/** Reads Vite env and runs sync; fails fast if URL or secret missing. */
export async function requestAirtableBabSync(
  options?: AirtableBabSyncOptions,
): Promise<AirtableBabSyncResult> {
  const url = import.meta.env.VITE_BAB_SYNC_URL?.trim();
  const secret = import.meta.env.VITE_BAB_SYNC_SECRET?.trim();
  if (!url || !secret) {
    return {
      ok: false,
      message:
        'BAB-Sync ist nicht konfiguriert (VITE_BAB_SYNC_URL und VITE_BAB_SYNC_SECRET).',
    };
  }
  return airtableBabSyncPost(url, secret, options, fetch);
}
