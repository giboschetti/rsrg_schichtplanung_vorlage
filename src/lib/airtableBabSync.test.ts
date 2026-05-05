import { describe, expect, it, vi } from 'vitest';
import {
  airtableBabSyncPost,
  AS25_WANKDORF_PROJECT_ID,
  bodyForAirtableBabSync,
} from '@/lib/airtableBabSync';

describe('bodyForAirtableBabSync', () => {
  it('is empty when no KW bounds', () => {
    expect(bodyForAirtableBabSync()).toEqual({});
    expect(bodyForAirtableBabSync({})).toEqual({});
  });

  it('includes only provided bounds', () => {
    expect(bodyForAirtableBabSync({ kwFrom: 27 })).toEqual({ kwFrom: 27 });
    expect(bodyForAirtableBabSync({ kwTo: 35 })).toEqual({ kwTo: 35 });
    expect(bodyForAirtableBabSync({ kwFrom: 27, kwTo: 30 })).toEqual({ kwFrom: 27, kwTo: 30 });
  });
});

describe('airtableBabSyncPost', () => {
  it('sends POST with JSON body and shared-secret header', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await airtableBabSyncPost(
      'https://example.test/sync',
      'my-secret',
      { kwFrom: 27, kwTo: 30 },
      fetchFn,
    );

    expect(fetchFn).toHaveBeenCalledWith(
      'https://example.test/sync',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BAB-Sync-Secret': 'my-secret',
        },
        body: JSON.stringify({ kwFrom: 27, kwTo: 30 }),
      }),
    );
    expect(result).toEqual({ ok: true, message: 'ok' });
  });

  it('returns network errors as failures', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));

    const result = await airtableBabSyncPost('https://x.test/', 's', {}, fetchFn);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('offline');
  });

  it('parses error JSON on failure status', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad scope' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await airtableBabSyncPost('https://x.test/', 's', undefined, fetchFn);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('bad scope');
  });
});

describe('AS25_WANKDORF_PROJECT_ID', () => {
  it('matches Firestore doc id for AS25 Wankdorf', () => {
    expect(AS25_WANKDORF_PROJECT_ID).toBe('wy6V7o0FedgcJq0uwRVA');
  });
});
