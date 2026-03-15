import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { createServer } from './server.js';
import type { AdminIdentity, CustomerIdentity } from './lib/adminAuth.js';
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

const parseToken = (req: http.IncomingMessage) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const customerIdentityFromToken = (token: string): CustomerIdentity | null => {
  if (token.startsWith('customer-')) {
    const userId = token;
    return {
      userId,
      email: `${userId}@example.com`,
      name: userId.replace('customer-', 'Customer ')
    };
  }

  if (token.startsWith('admin-')) {
    return {
      userId: token,
      email: `${token}@example.com`,
      name: token
    };
  }

  return null;
};

const adminIdentityFromToken = (token: string): AdminIdentity | null => {
  if (token === 'admin-owner') {
    return { userId: token, role: 'OWNER', orgId: 'org_test_admin' };
  }
  if (token === 'admin-admin') {
    return { userId: token, role: 'ADMIN', orgId: 'org_test_admin' };
  }
  if (token === 'admin-reviewer') {
    return { userId: token, role: 'REVIEWER', orgId: 'org_test_admin' };
  }
  if (token === 'admin-marketing') {
    return { userId: token, role: 'MARKETING', orgId: 'org_test_admin' };
  }

  return null;
};

const startServer = async () => {
  const started = createServer({
    port: 0,
    baseStations: stations,
    servedRegions: ['Dallas Test Region'],
    nowMs: () => Date.UTC(2026, 2, 3, 12, 0, 0),
    authResolvers: {
      resolveCustomerIdentity: async (req) => {
        const token = parseToken(req);
        if (!token) {
          return null;
        }
        const identity = customerIdentityFromToken(token);
        if (!identity) {
          throw new Error('AUTH_REQUIRED');
        }

        return identity;
      },
      resolveAdminIdentity: async (req) => {
        const token = parseToken(req);
        if (!token) {
          return null;
        }
        const identity = adminIdentityFromToken(token);
        if (!identity) {
          throw new Error('AUTH_FORBIDDEN');
        }

        return identity;
      }
    }
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

    const claimResponse = await fetch(`${baseUrl}/api/quote/${firstDraftBody.quoteId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer customer-martin'
      }
    });
    assert.equal(claimResponse.status, 200);

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${firstDraftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-contact-1',
        Authorization: 'Bearer customer-martin'
      },
      body: JSON.stringify({
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
    assert.equal(finalizeBody.status, 'in_review');
    assert.equal(finalizeBody.replayed, false);

    const quoteResponse = await fetch(`${baseUrl}/api/quote/${firstDraftBody.quoteId}`, {
      headers: {
        Authorization: 'Bearer customer-martin'
      }
    });
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
    assert.equal(quote.status, 'in_review');
    assert.equal(quote.contactPending, false);
    assert.equal(quote.serviceFrequency, 'biweekly');
    assert.equal(quote.sessionsMin, 13);
    assert.equal(quote.sessionsMax, 15);
    assert.equal(quote.perSessionTotal, 245.55);
    assert.equal(quote.seasonalTotalMin, 3192.15);
    assert.equal(quote.seasonalTotalMax, 3683.25);
    assert.ok(typeof quote.submittedAt === 'string' && quote.submittedAt.length > 0);
  });

  it('enforces quote ownership for claim, contact finalize, and lookup', async () => {
    const { baseUrl } = await startServer();

    const draft = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-ownership-draft-1'
      },
      body: JSON.stringify({
        address: '18 Secure Lane, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [-79.5202, 43.8438],
              [-79.5193, 43.8438],
              [-79.5193, 43.8445],
              [-79.5202, 43.8445],
              [-79.5202, 43.8438]
            ]
          ]
        },
        plan: 'Starter',
        quoteTotal: 180,
        serviceFrequency: 'weekly'
      })
    });
    assert.equal(draft.status, 201);
    const draftBody = (await draft.json()) as { quoteId: string };

    const unauthFinalize = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-ownership-contact-1'
      },
      body: JSON.stringify({
        phone: '+1 416 555 0101'
      })
    });
    assert.equal(unauthFinalize.status, 401);

    const firstClaim = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer customer-owner'
      }
    });
    assert.equal(firstClaim.status, 200);

    const secondUserClaim = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer customer-other'
      }
    });
    assert.equal(secondUserClaim.status, 409);

    const ownerQuote = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}`, {
      headers: {
        Authorization: 'Bearer customer-owner'
      }
    });
    assert.equal(ownerQuote.status, 200);

    const accountQuotes = await fetch(`${baseUrl}/api/account/quotes`, {
      headers: {
        Authorization: 'Bearer customer-owner'
      }
    });
    assert.equal(accountQuotes.status, 200);
    const accountQuotesBody = (await accountQuotes.json()) as { items: Array<{ id: string }> };
    assert.equal(accountQuotesBody.items.some((item) => item.id === draftBody.quoteId), true);

    const otherQuote = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}`, {
      headers: {
        Authorization: 'Bearer customer-other'
      }
    });
    assert.equal(otherQuote.status, 403);
  });
});

describe('admin quote editor workflow', () => {
  it('returns derived polygon source fallback when draft source payload is missing', async () => {
    const { baseUrl } = await startServer();

    const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-draft-fallback-1'
      },
      body: JSON.stringify({
        address: '100 Legacy Path, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [-79.5201, 43.8439],
              [-79.5194, 43.8439],
              [-79.5194, 43.8444],
              [-79.5201, 43.8444],
              [-79.5201, 43.8439]
            ]
          ]
        },
        plan: 'Starter Autonomy Plan',
        quoteTotal: 175,
        serviceFrequency: 'weekly',
        baseTotal: 49,
        pricingVersion: 'v1',
        currency: 'CAD'
      })
    });
    assert.equal(draftResponse.status, 201);
    const draftBody = (await draftResponse.json()) as { quoteId: string };

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-contact-fallback-1',
        Authorization: 'Bearer customer-legacy'
      },
      body: JSON.stringify({
        phone: '+1 416 555 0022'
      })
    });
    assert.equal(finalizeResponse.status, 200);

    const editorResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(editorResponse.status, 200);
    const editorBody = (await editorResponse.json()) as {
      polygonSourceFallback: boolean;
      polygonSource: { polygons: Array<{ kind: string; points: unknown[] }> };
    };
    assert.equal(editorBody.polygonSourceFallback, true);
    assert.equal(editorBody.polygonSource.polygons.length > 0, true);
    assert.equal(editorBody.polygonSource.polygons[0]?.kind, 'service');
  });

  it('repairs lat/lng-swapped polygon source payloads for editor rendering', async () => {
    const { baseUrl } = await startServer();

    const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-draft-swapped-1'
      },
      body: JSON.stringify({
        address: '145 Repair Lane, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [-79.5201, 43.8439],
              [-79.5194, 43.8439],
              [-79.5194, 43.8444],
              [-79.5201, 43.8444],
              [-79.5201, 43.8439]
            ]
          ]
        },
        polygonSource: {
          schemaVersion: 1,
          activePolygonId: 'service-1',
          polygons: [
            {
              id: 'service-1',
              kind: 'service',
              points: [
                [43.8439, -79.5201],
                [43.8439, -79.5194],
                [43.8444, -79.5194],
                [43.8444, -79.5201]
              ]
            }
          ]
        },
        plan: 'Starter Autonomy Plan',
        quoteTotal: 175,
        serviceFrequency: 'weekly',
        baseTotal: 49,
        pricingVersion: 'v1',
        currency: 'CAD'
      })
    });
    assert.equal(draftResponse.status, 201);
    const draftBody = (await draftResponse.json()) as { quoteId: string };

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-contact-swapped-1',
        Authorization: 'Bearer customer-swapped'
      },
      body: JSON.stringify({
        phone: '+1 416 555 1145'
      })
    });
    assert.equal(finalizeResponse.status, 200);

    const editorResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(editorResponse.status, 200);
    const editorBody = (await editorResponse.json()) as {
      polygonSourceFallback: boolean;
      polygonSource: { polygons: Array<{ points: Array<[number, number]> }> };
    };
    assert.equal(editorBody.polygonSourceFallback, true);
    assert.equal(editorBody.polygonSource.polygons.length > 0, true);
    const firstPoint = editorBody.polygonSource.polygons[0]?.points[0];
    assert.ok(firstPoint);
    assert.equal(firstPoint[0] < -70 && firstPoint[0] > -90, true);
    assert.equal(firstPoint[1] > 40 && firstPoint[1] < 50, true);
  });

  it('repairs lat/lng-swapped quote geometry using stored quote location anchor', async () => {
    const { baseUrl } = await startServer();

    const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-draft-swapped-geometry-1'
      },
      body: JSON.stringify({
        address: '222 Geometry Repair Ave, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [43.8439, -79.5201],
              [43.8439, -79.5194],
              [43.8444, -79.5194],
              [43.8444, -79.5201],
              [43.8439, -79.5201]
            ]
          ]
        },
        polygonSource: {
          schemaVersion: 1,
          activePolygonId: 'service-1',
          polygons: [
            {
              id: 'service-1',
              kind: 'service',
              points: [
                [43.8439, -79.5201],
                [43.8439, -79.5194],
                [43.8444, -79.5194],
                [43.8444, -79.5201]
              ]
            }
          ]
        },
        plan: 'Starter Autonomy Plan',
        quoteTotal: 176,
        serviceFrequency: 'weekly',
        baseTotal: 49,
        pricingVersion: 'v1',
        currency: 'CAD'
      })
    });
    assert.equal(draftResponse.status, 201);
    const draftBody = (await draftResponse.json()) as { quoteId: string };

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-contact-swapped-geometry-1',
        Authorization: 'Bearer customer-swapped-geometry'
      },
      body: JSON.stringify({
        phone: '+1 416 555 2288'
      })
    });
    assert.equal(finalizeResponse.status, 200);

    const editorResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(editorResponse.status, 200);
    const editorBody = (await editorResponse.json()) as {
      polygonSourceFallback: boolean;
      polygonSource: { polygons: Array<{ points: Array<[number, number]> }> };
    };
    assert.equal(editorBody.polygonSourceFallback, true);
    assert.equal(editorBody.polygonSource.polygons.length > 0, true);
    const firstPoint = editorBody.polygonSource.polygons[0]?.points[0];
    assert.ok(firstPoint);
    assert.equal(firstPoint[0] < -70 && firstPoint[0] > -90, true);
    assert.equal(firstPoint[1] > 40 && firstPoint[1] < 50, true);
  });

  it('supports versioned admin edits and submit to verified awaiting payment', async () => {
    const { baseUrl } = await startServer();

    const draftPayload = {
      address: '88 Review Crescent, Vaughan, ON',
      location: {
        lat: 43.844147,
        lng: -79.51962
      },
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [-79.5203, 43.8437],
            [-79.5192, 43.8437],
            [-79.5192, 43.8446],
            [-79.5203, 43.8446],
            [-79.5203, 43.8437]
          ]
        ]
      },
      polygonSource: {
        schemaVersion: 1,
        activePolygonId: 'service-1',
        polygons: [
          {
            id: 'service-1',
            kind: 'service',
            points: [
              [-79.5203, 43.8437],
              [-79.5192, 43.8437],
              [-79.5192, 43.8446],
              [-79.5203, 43.8446]
            ]
          }
        ]
      },
      plan: 'Precision Weekly Plan',
      quoteTotal: 210.25,
      serviceFrequency: 'weekly',
      baseTotal: 49,
      pricingVersion: 'v1',
      currency: 'CAD'
    };

    const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-draft-1'
      },
      body: JSON.stringify(draftPayload)
    });
    assert.equal(draftResponse.status, 201);
    const draftBody = (await draftResponse.json()) as { quoteId: string };

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-contact-1',
        Authorization: 'Bearer customer-reviewer'
      },
      body: JSON.stringify({
        phone: '+1 416 555 7777'
      })
    });
    assert.equal(finalizeResponse.status, 200);

    const editorResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(editorResponse.status, 200);
    const editorBody = (await editorResponse.json()) as {
      status: string;
      customerStatus: string;
      polygonSource: { schemaVersion: number };
      versions: Array<{ versionNumber: number; actorType: string }>;
    };
    assert.equal(editorBody.status, 'in_review');
    assert.equal(editorBody.customerStatus, 'pending');
    assert.equal(editorBody.polygonSource.schemaVersion, 1);
    assert.equal(editorBody.versions[0]?.versionNumber, 1);
    assert.equal(editorBody.versions[0]?.actorType, 'client');

    const versionResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-admin'
      },
      body: JSON.stringify({
        polygonSource: {
          schemaVersion: 1,
          activePolygonId: 'service-1',
          polygons: [
            {
              id: 'service-1',
              kind: 'service',
              points: [
                [-79.5204, 43.8437],
                [-79.5191, 43.8437],
                [-79.5191, 43.8447],
                [-79.5204, 43.8447]
              ]
            }
          ]
        },
        serviceFrequency: 'biweekly',
        perSessionTotal: 199.99,
        finalTotal: 225
      })
    });
    assert.equal(versionResponse.status, 200);
    const versionBody = (await versionResponse.json()) as {
      status: string;
      customerStatus: string;
      version: number;
    };
    assert.equal(versionBody.status, 'in_review');
    assert.equal(versionBody.customerStatus, 'updated');
    assert.equal(versionBody.version, 2);

    const submitResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions/${versionBody.version}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-reviewer'
        }
      }
    );
    assert.equal(submitResponse.status, 200);
    const submitBody = (await submitResponse.json()) as {
      status: string;
      customerStatus: string;
      selectedVersion: number;
    };
    assert.equal(submitBody.status, 'verified');
    assert.equal(submitBody.customerStatus, 'awaiting_payment');
    assert.equal(submitBody.selectedVersion, 2);

    const updatedQuote = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}`, {
      headers: {
        Authorization: 'Bearer customer-reviewer'
      }
    });
    assert.equal(updatedQuote.status, 200);
    const updatedQuoteBody = (await updatedQuote.json()) as { status: string };
    assert.equal(updatedQuoteBody.status, 'verified');

    const finalEditorResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(finalEditorResponse.status, 200);
    const finalEditorBody = (await finalEditorResponse.json()) as {
      status: string;
      customerStatus: string;
      versions: Array<{ actorType: string }>;
    };
    assert.equal(finalEditorBody.status, 'verified');
    assert.equal(finalEditorBody.customerStatus, 'awaiting_payment');
    assert.equal(finalEditorBody.versions.some((item) => item.actorType === 'admin'), true);
  });

  it('blocks marketing from mutating quote endpoints', async () => {
    const { baseUrl } = await startServer();

    const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-draft-2'
      },
      body: JSON.stringify({
        address: '77 Guardrail Street, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [-79.5202, 43.8438],
              [-79.5193, 43.8438],
              [-79.5193, 43.8445],
              [-79.5202, 43.8445],
              [-79.5202, 43.8438]
            ]
          ]
        },
        polygonSource: {
          schemaVersion: 1,
          activePolygonId: 'service-1',
          polygons: [
            {
              id: 'service-1',
              kind: 'service',
              points: [
                [-79.5202, 43.8438],
                [-79.5193, 43.8438],
                [-79.5193, 43.8445],
                [-79.5202, 43.8445]
              ]
            }
          ]
        },
        plan: 'Starter Autonomy Plan',
        quoteTotal: 180,
        serviceFrequency: 'weekly',
        baseTotal: 49,
        pricingVersion: 'v1',
        currency: 'CAD'
      })
    });
    assert.equal(draftResponse.status, 201);
    const draftBody = (await draftResponse.json()) as { quoteId: string };

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-editor-contact-2',
        Authorization: 'Bearer customer-marketing'
      },
      body: JSON.stringify({
        phone: '+1 416 555 9999'
      })
    });
    assert.equal(finalizeResponse.status, 200);

    const versionCreate = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-marketing'
      },
      body: JSON.stringify({
        polygonSource: {
          schemaVersion: 1,
          activePolygonId: 'service-1',
          polygons: [
            {
              id: 'service-1',
              kind: 'service',
              points: [
                [-79.5202, 43.8438],
                [-79.5193, 43.8438],
                [-79.5193, 43.8445],
                [-79.5202, 43.8445]
              ]
            }
          ]
        },
        serviceFrequency: 'weekly',
        perSessionTotal: 180,
        finalTotal: 180
      })
    });
    assert.equal(versionCreate.status, 403);

    const statusUpdate = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-marketing'
      },
      body: JSON.stringify({
        status: 'verified'
      })
    });
    assert.equal(statusUpdate.status, 403);
  });

  it('returns 404 for missing quote editor without breaking subsequent requests', async () => {
    const { baseUrl } = await startServer();

    const missingEditor = await fetch(`${baseUrl}/api/admin/quotes/Q-DOES-NOT-EXIST/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(missingEditor.status, 404);
    const missingBody = (await missingEditor.json()) as { error: string };
    assert.equal(missingBody.error, 'Quote not found.');

    const healthAfter = await fetch(`${baseUrl}/api/admin/health`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(healthAfter.status, 200);
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
        Authorization: 'Bearer admin-admin'
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
        Authorization: 'Bearer admin-marketing'
      }
    });

    assert.equal(marketingMap.status, 200);
    const marketingBody = (await marketingMap.json()) as {
      points: Array<{ addressText: string }>;
    };
    assert.equal(marketingBody.points[0]?.addressText.includes('***'), true);
  });
});

describe('admin authentication mode', () => {
  it('rejects legacy header-only auth and accepts bearer token auth', async () => {
    const { baseUrl } = await startServer();

    const legacy = await fetch(`${baseUrl}/api/admin/health`, {
      headers: {
        'X-Admin-Role': 'ADMIN',
        'X-Admin-User-Id': 'legacy-admin'
      }
    });
    assert.equal(legacy.status, 401);

    const bearer = await fetch(`${baseUrl}/api/admin/health`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(bearer.status, 200);
  });
});
