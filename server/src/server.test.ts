import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createServer } from './server.js';
import type { BaseStationConfig } from './lib/serviceAreaConfig.js';

const stations: BaseStationConfig[] = [
  {
    label: 'internal-station-contract-test',
    address: 'internal-only',
    lat: 32.8201,
    lng: -96.8102,
    active: true
  }
];

const startedServers: Array<ReturnType<typeof createServer>['server']> = [];

const startServer = async () => {
  const started = createServer({
    port: 0,
    baseStations: stations,
    servedRegions: ['Dallas Test Region'],
    nowMs: () => Date.UTC(2026, 2, 3, 12, 0, 0)
  });

  await new Promise<void>((resolve) => {
    started.server.listen(0, resolve);
  });

  startedServers.push(started.server);
  const address = started.server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`
  };
};

afterEach(async () => {
  const pending = startedServers.splice(0, startedServers.length);
  await Promise.all(
    pending.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

describe('/api/service-area', () => {
  it('returns hardened geojson contract and supports ETag', async () => {
    const { baseUrl } = await startServer();

    const first = await fetch(`${baseUrl}/api/service-area`);
    assert.equal(first.status, 200);

    const etag = first.headers.get('etag');
    assert.ok(etag);

    const bodyText = await first.text();
    assert.equal(bodyText.includes('internal-station-contract-test'), false);
    assert.equal(bodyText.includes('"lat":32.8201'), false);
    assert.equal(bodyText.includes('"lng":-96.8102'), false);

    const payload = JSON.parse(bodyText) as {
      type: string;
      features: unknown[];
      metadata?: { approximate?: boolean; disclaimer?: string; servedRegions?: string[] };
    };

    assert.equal(payload.type, 'FeatureCollection');
    assert.ok(payload.features.length > 0);
    assert.equal(payload.metadata?.approximate, true);
    assert.ok((payload.metadata?.disclaimer ?? '').length > 0);
    assert.deepEqual(payload.metadata?.servedRegions, ['Dallas Test Region']);

    const second = await fetch(`${baseUrl}/api/service-area`, {
      headers: {
        'If-None-Match': etag
      }
    });

    assert.equal(second.status, 304);
  });

  it('checks point inclusion without exposing station coordinates', async () => {
    const { baseUrl } = await startServer();

    const inAreaResponse = await fetch(`${baseUrl}/api/service-area/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lat: 32.8201,
        lng: -96.8102
      })
    });

    assert.equal(inAreaResponse.status, 200);
    const inArea = (await inAreaResponse.json()) as { inServiceArea: boolean };
    assert.equal(inArea.inServiceArea, true);

    const outAreaResponse = await fetch(`${baseUrl}/api/service-area/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lat: 40.7128,
        lng: -74.006
      })
    });

    assert.equal(outAreaResponse.status, 200);
    const outArea = (await outAreaResponse.json()) as { inServiceArea: boolean };
    assert.equal(outArea.inServiceArea, false);
  });
});

describe('quote draft + contact finalize flow', () => {
  it('creates draft quote with idempotent replay and finalizes contact', async () => {
    const { baseUrl } = await startServer();

    const draftPayload = {
      address: '123 Green Lane, Vaughan, ON',
      location: {
        lat: 43.844147,
        lng: -79.51962
      },
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [-79.5204, 43.8436],
            [-79.5191, 43.8436],
            [-79.5191, 43.8447],
            [-79.5204, 43.8447],
            [-79.5204, 43.8436]
          ]
        ]
      },
      plan: 'Premium Weekly',
      quoteTotal: 245.55,
      serviceFrequency: 'biweekly',
      baseTotal: 120,
      pricingVersion: 'v1',
      currency: 'CAD'
    };

    const firstDraft = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-draft-1'
      },
      body: JSON.stringify(draftPayload)
    });

    assert.equal(firstDraft.status, 201);
    const firstDraftBody = (await firstDraft.json()) as {
      quoteId: string;
      status: string;
      contactPending: boolean;
      replayed: boolean;
    };
    assert.equal(firstDraftBody.status, 'draft');
    assert.equal(firstDraftBody.contactPending, true);
    assert.equal(firstDraftBody.replayed, false);
    assert.ok(firstDraftBody.quoteId.length > 4);

    const replayDraft = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-draft-1'
      },
      body: JSON.stringify(draftPayload)
    });

    assert.equal(replayDraft.status, 201);
    const replayBody = (await replayDraft.json()) as { quoteId: string; replayed: boolean };
    assert.equal(replayBody.quoteId, firstDraftBody.quoteId);
    assert.equal(replayBody.replayed, true);

    const conflictDraft = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-draft-1'
      },
      body: JSON.stringify({
        ...draftPayload,
        quoteTotal: 999
      })
    });

    assert.equal(conflictDraft.status, 409);

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${firstDraftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-contact-1'
      },
      body: JSON.stringify({
        name: 'Martin H',
        email: 'martin@example.com',
        phone: '+1 416 555 1212',
        message: 'Please call before arrival.'
      })
    });

    assert.equal(finalizeResponse.status, 200);
    const finalizeBody = (await finalizeResponse.json()) as {
      ok: boolean;
      status: string;
      replayed: boolean;
    };
    assert.equal(finalizeBody.ok, true);
    assert.equal(finalizeBody.status, 'submitted');
    assert.equal(finalizeBody.replayed, false);

    const quoteResponse = await fetch(`${baseUrl}/api/quote/${firstDraftBody.quoteId}`);
    assert.equal(quoteResponse.status, 200);
    const quote = (await quoteResponse.json()) as {
      id: string;
      status: string;
      contactPending: boolean;
      submittedAt: string | null;
      serviceFrequency: string;
      sessionsMin: number;
      sessionsMax: number;
      perSessionTotal: number;
      seasonalTotalMin: number;
      seasonalTotalMax: number;
    };

    assert.equal(quote.id, firstDraftBody.quoteId);
    assert.equal(quote.status, 'submitted');
    assert.equal(quote.contactPending, false);
    assert.equal(quote.serviceFrequency, 'biweekly');
    assert.equal(quote.sessionsMin, 13);
    assert.equal(quote.sessionsMax, 15);
    assert.equal(quote.perSessionTotal, 245.55);
    assert.equal(quote.seasonalTotalMin, 3192.15);
    assert.equal(quote.seasonalTotalMax, 3683.25);
    assert.ok(typeof quote.submittedAt === 'string' && quote.submittedAt.length > 0);
  });
});

describe('/api/service-area/request', () => {
  it('stores out-of-area request idempotently', async () => {
    const { baseUrl } = await startServer();

    const payload = {
      addressText: '999 Example Road, Toronto, ON',
      lat: 43.7,
      lng: -79.4,
      source: 'out_of_area_page',
      isInServiceAreaAtCapture: false
    };

    const first = await fetch(`${baseUrl}/api/service-area/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'service-area-request-1'
      },
      body: JSON.stringify(payload)
    });

    assert.equal(first.status, 201);
    const firstBody = (await first.json()) as { ok: boolean; id: string; replayed: boolean };
    assert.equal(firstBody.ok, true);
    assert.equal(firstBody.replayed, false);

    const replay = await fetch(`${baseUrl}/api/service-area/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'service-area-request-1'
      },
      body: JSON.stringify(payload)
    });

    assert.equal(replay.status, 201);
    const replayBody = (await replay.json()) as { id: string; replayed: boolean };
    assert.equal(replayBody.id, firstBody.id);
    assert.equal(replayBody.replayed, true);
  });
});

describe('/api/admin/service-area-requests/map', () => {
  it('returns request points and hotspots with role-aware masking', async () => {
    const { baseUrl } = await startServer();

    const payload = {
      addressText: '101 Expansion Blvd, Vaughan, ON',
      lat: 43.844147,
      lng: -79.51962,
      source: 'out_of_area_page',
      isInServiceAreaAtCapture: false
    };

    const create = await fetch(`${baseUrl}/api/service-area/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'service-area-request-map-1'
      },
      body: JSON.stringify(payload)
    });
    assert.equal(create.status, 201);

    const adminMap = await fetch(`${baseUrl}/api/admin/service-area-requests/map`, {
      headers: {
        'X-Admin-Role': 'ADMIN',
        'X-Admin-User-Id': 'admin-map'
      }
    });

    assert.equal(adminMap.status, 200);
    const adminBody = (await adminMap.json()) as {
      points: Array<{ addressText: string }>;
      hotspots: Array<{ count: number }>;
    };
    assert.ok(adminBody.points.length >= 1);
    assert.ok(adminBody.hotspots.length >= 1);
    assert.equal(adminBody.points[0]?.addressText.includes('Expansion Blvd'), true);

    const marketingMap = await fetch(`${baseUrl}/api/admin/service-area-requests/map`, {
      headers: {
        'X-Admin-Role': 'MARKETING',
        'X-Admin-User-Id': 'marketing-map'
      }
    });

    assert.equal(marketingMap.status, 200);
    const marketingBody = (await marketingMap.json()) as {
      points: Array<{ addressText: string }>;
    };
    assert.equal(marketingBody.points[0]?.addressText.includes('***'), true);
  });
});
