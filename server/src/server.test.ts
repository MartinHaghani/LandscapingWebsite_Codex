import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { createServer } from './server.js';
import type { AdminIdentity, CustomerIdentity } from './lib/adminAuth.js';
import type { ApprovedQuoteEmailSender } from './lib/approvedQuoteEmail.js';
import type { BaseStationConfig } from './lib/serviceAreaConfig.js';
import type {
  CreateStripeCheckoutSessionInput,
  StripeCustomerBillingState,
  StripePaymentProvider,
  StripeWebhookEvent
} from './lib/stripePayments.js';

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
      name: userId.replace('customer-', 'Customer '),
      phone: token.includes('no-phone') ? null : '+1 416 555 0100',
      emailMarketingConsent: token.includes('marketing')
    };
  }

  if (token.startsWith('admin-')) {
    return {
      userId: token,
      email: `${token}@example.com`,
      name: token,
      phone: '+1 416 555 0109',
      emailMarketingConsent: false
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

const startServer = async (options?: {
  customerIdentityFromToken?: (token: string) => CustomerIdentity | null;
  recordAddress?: (input: { userId: string; addressText: string }) => Promise<void>;
  approvedQuoteEmailSender?: ApprovedQuoteEmailSender;
  publicUrls?: {
    appBaseUrl?: string;
    apiBaseUrl?: string;
  };
  approvedQuotePreview?: {
    mapboxAccessToken?: string;
    fetchImpl?: typeof fetch;
  };
  stripeProvider?: StripePaymentProvider;
  nowMs?: () => number;
}) => {
  const customerIdentityResolver = options?.customerIdentityFromToken ?? customerIdentityFromToken;
  const recordAddress = options?.recordAddress ?? (async () => {});
  const started = createServer({
    port: 0,
    baseStations: stations,
    servedRegions: ['Dallas Test Region'],
    nowMs: options?.nowMs ?? (() => Date.UTC(2026, 2, 3, 12, 0, 0)),
    authResolvers: {
      resolveCustomerIdentity: async (req) => {
        const token = parseToken(req);
        if (!token) {
          return null;
        }
        const identity = customerIdentityResolver(token);
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
    },
    customerProfile: {
      recordAddress
    },
    publicUrls: options?.publicUrls,
    approvedQuoteEmail: {
      sender: options?.approvedQuoteEmailSender
    },
    approvedQuotePreview: options?.approvedQuotePreview,
    payments: {
      stripeProvider: options?.stripeProvider
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

const closeRing = (ringPoints: Array<[number, number]>) => {
  if (ringPoints.length === 0) {
    return ringPoints;
  }

  const [firstLng, firstLat] = ringPoints[0] ?? [];
  const [lastLng, lastLat] = ringPoints[ringPoints.length - 1] ?? [];

  if (firstLng === lastLng && firstLat === lastLat) {
    return ringPoints;
  }

  return [...ringPoints, ringPoints[0]];
};

const createPolygonGeometry = (ringPoints: Array<[number, number]>) => ({
  type: 'Polygon' as const,
  coordinates: [closeRing(ringPoints)]
});

const createPolygonSource = (
  polygonId: string,
  ringPoints: Array<[number, number]>,
  kind: 'service' | 'obstacle' = 'service',
  rawStrokePoints: Array<[number, number]> | null = ringPoints
) => ({
  schemaVersion: 2 as const,
  activePolygonId: polygonId,
  polygons: [
    {
      id: polygonId,
      kind,
      ringPoints,
      rawStrokePoints
    }
  ]
});

const createMapboxImageFetch = (urls: string[]) =>
  (async (input: Parameters<typeof fetch>[0]) => {
    urls.push(typeof input === 'string' ? input : input.toString());
    return new Response(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
      status: 200,
      headers: {
        'content-type': 'image/jpeg'
      }
    });
  }) as typeof fetch;

const createFakeStripeProvider = (state: {
  sessions?: CreateStripeCheckoutSessionInput[];
  updatedCancelAt?: Array<{ subscriptionId: string; cancelAtUnix: number }>;
  canceledSubscriptions?: string[];
  billingPortalSessions?: Array<{ customerId: string; returnUrl: string }>;
  billingStateByCustomerId?: Record<string, StripeCustomerBillingState>;
}) => {
  const sessions = state.sessions ?? [];
  const updatedCancelAt = state.updatedCancelAt ?? [];
  const canceledSubscriptions = state.canceledSubscriptions ?? [];
  const billingPortalSessions = state.billingPortalSessions ?? [];
  const billingStateByCustomerId = state.billingStateByCustomerId ?? {};

  return {
    async createCheckoutSession(input) {
      sessions.push(input);
      const index = sessions.length;
      return {
        id: `cs_test_${index}`,
        url: `https://checkout.stripe.test/session/${index}`,
        expiresAt: Math.floor(Date.UTC(2026, 2, 3, 13, 0, 0) / 1000),
        customerId: `cus_test_${index}`,
        paymentIntentId: input.mode === 'seasonal_payment' ? `pi_test_${index}` : null,
        subscriptionId: input.mode === 'per_session_subscription' ? `sub_test_${index}` : null
      };
    },
    constructWebhookEvent(payload, signature) {
      if (signature !== 'valid-signature') {
        throw new Error('Invalid signature');
      }

      return JSON.parse(payload.toString('utf8')) as StripeWebhookEvent;
    },
    async createBillingPortalSession(customerId, returnUrl) {
      billingPortalSessions.push({ customerId, returnUrl });
      return {
        url: `https://billing.stripe.test/session/${customerId}`
      };
    },
    async getCustomerBillingState({ customerId }) {
      return billingStateByCustomerId[customerId] ?? {
        canManageCard: false,
        cardOnFile: null
      };
    },
    async updateSubscriptionCancelAt(subscriptionId, cancelAtUnix) {
      updatedCancelAt.push({ subscriptionId, cancelAtUnix });
    },
    async cancelSubscription(subscriptionId) {
      canceledSubscriptions.push(subscriptionId);
    }
  } satisfies StripePaymentProvider;
};

const extractPaymentToken = (html: string) => {
  const match = html.match(/https:\/\/client\.autoscape\.test\/pay\/([A-Za-z0-9_-]+)/);
  assert.ok(match?.[1], 'Expected approved quote email to include a secure payment token.');
  return match[1];
};

const createReviewQuoteVersion = async (
  baseUrl: string,
  idPrefix: string,
  adminRing: Array<[number, number]> = [
    [-79.5204, 43.8437],
    [-79.519, 43.8437],
    [-79.519, 43.8445],
    [-79.5204, 43.8445]
  ],
  draftOverrides: Record<string, unknown> = {}
) => {
  const reviewRing: Array<[number, number]> = [
    [-79.5203, 43.8437],
    [-79.5192, 43.8437],
    [-79.5192, 43.8446],
    [-79.5203, 43.8446]
  ];

  const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `${idPrefix}-draft`
    },
    body: JSON.stringify({
      address: '88 Review Crescent, Vaughan, ON',
      location: {
        lat: 43.844147,
        lng: -79.51962
      },
      polygon: createPolygonGeometry(reviewRing),
      polygonSource: createPolygonSource('service-1', reviewRing),
      plan: 'Precision Weekly Plan',
      quoteTotal: 210.25,
      serviceFrequency: 'weekly',
      baseTotal: 49,
      pricingVersion: 'v1',
      currency: 'CAD',
      ...draftOverrides
    })
  });
  assert.equal(draftResponse.status, 201);
  const draftBody = (await draftResponse.json()) as { quoteId: string };

  const finalizeResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `${idPrefix}-contact`,
      Authorization: 'Bearer customer-reviewer'
    },
    body: JSON.stringify({})
  });
  assert.equal(finalizeResponse.status, 200);

  const versionResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-admin'
    },
    body: JSON.stringify({
      polygonSource: createPolygonSource('service-1', adminRing),
      serviceFrequency: 'weekly',
      perSessionTotal: 199.99,
      finalTotal: 225
    })
  });
  assert.equal(versionResponse.status, 200);
  const versionBody = (await versionResponse.json()) as { version: number };

  return {
    quoteId: draftBody.quoteId,
    version: versionBody.version
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
    const inArea = (await inAreaResponse.json()) as {
      inServiceArea: boolean;
      distanceToNearestStationKm: number;
    };
    assert.equal(inArea.inServiceArea, true);
    assert.equal(typeof inArea.distanceToNearestStationKm, 'number');
    assert.ok(inArea.distanceToNearestStationKm < 0.05);

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
    const outArea = (await outAreaResponse.json()) as {
      inServiceArea: boolean;
      distanceToNearestStationKm: number;
    };
    assert.equal(outArea.inServiceArea, false);
    assert.equal(typeof outArea.distanceToNearestStationKm, 'number');
    assert.ok(outArea.distanceToNearestStationKm > 100);
  });
});

describe('CORS policy', () => {
  it('reflects loopback frontend origins on arbitrary local dev ports', async () => {
    const { baseUrl } = await startServer();

    const loopbackResponse = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: 'http://127.0.0.1:5182'
      }
    });
    assert.equal(loopbackResponse.status, 200);
    assert.equal(loopbackResponse.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5182');

    const localhostResponse = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: 'http://localhost:5199'
      }
    });
    assert.equal(localhostResponse.status, 200);
    assert.equal(localhostResponse.headers.get('access-control-allow-origin'), 'http://localhost:5199');
  });
});

describe('/api/contact', () => {
  it('accepts marketing consent and persists it on the lead record', async () => {
    const { baseUrl } = await startServer();

    const contactResponse = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'contact-marketing-consent-1'
      },
      body: JSON.stringify({
        name: 'Marketing Optin',
        email: 'marketing-optin@example.com',
        phone: '+1 416 555 0111',
        addressText: '57 Whitburn Crescent, Maple, ON',
        message: 'Please follow up about service availability.',
        marketingConsent: true
      })
    });

    assert.equal(contactResponse.status, 201);

    const leadsResponse = await fetch(`${baseUrl}/api/admin/leads?consentMarketing=true`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(leadsResponse.status, 200);
    const leadsBody = (await leadsResponse.json()) as {
      items: Array<{ primaryEmail: string | null; consentMarketing: boolean }>;
    };
    const lead = leadsBody.items.find((item) => item.primaryEmail === 'marketing-optin@example.com');

    assert.ok(lead);
    assert.equal(lead.consentMarketing, true);
  });
});

describe('quote draft + contact finalize flow', () => {
  it('creates draft quote with idempotent replay and finalizes contact', async () => {
    const { baseUrl } = await startServer();
    const draftRing: Array<[number, number]> = [
      [-79.5204, 43.8436],
      [-79.5191, 43.8436],
      [-79.5191, 43.8447],
      [-79.5204, 43.8447]
    ];

    const draftPayload = {
      address: '123 Green Lane, Vaughan, ON',
      location: {
        lat: 43.844147,
        lng: -79.51962
      },
      polygon: createPolygonGeometry(draftRing),
      polygonSource: createPolygonSource('service-1', draftRing),
      plan: 'Premium Weekly',
      quoteTotal: 245.55,
      serviceFrequency: 'weekly',
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
      nextStepUrl?: string;
      replayed: boolean;
    };
    assert.equal(firstDraftBody.status, 'draft');
    assert.equal(firstDraftBody.contactPending, true);
    assert.equal(firstDraftBody.replayed, false);
    assert.ok(firstDraftBody.quoteId.length > 4);
    assert.equal(firstDraftBody.nextStepUrl, `/quote-confirmation/${firstDraftBody.quoteId}`);

    const replayDraft = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-draft-1'
      },
      body: JSON.stringify(draftPayload)
    });

    assert.equal(replayDraft.status, 201);
    const replayBody = (await replayDraft.json()) as { quoteId: string; replayed: boolean; nextStepUrl?: string };
    assert.equal(replayBody.quoteId, firstDraftBody.quoteId);
    assert.equal(replayBody.replayed, true);
    assert.equal(replayBody.nextStepUrl, `/quote-confirmation/${firstDraftBody.quoteId}`);

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
      billingMode: string;
      sessionsMin: number;
      sessionsMax: number;
      perSessionTotal: number;
      seasonalTotalMin: number;
      seasonalTotalMax: number;
      fullSeasonTotal: number;
      seasonalDiscountedTotal: number;
      seasonalSavingsTotal: number;
      seasonalDiscountRate: number;
    };

    assert.equal(quote.id, firstDraftBody.quoteId);
    assert.equal(quote.status, 'in_review');
    assert.equal(quote.contactPending, false);
    assert.equal(quote.serviceFrequency, 'weekly');
    assert.equal(quote.billingMode, 'seasonal');
    assert.equal(quote.sessionsMin, 20);
    assert.equal(quote.sessionsMax, 20);
    assert.notEqual(quote.perSessionTotal, draftPayload.quoteTotal);
    assert.equal(quote.seasonalTotalMin, Number((quote.perSessionTotal * 20).toFixed(2)));
    assert.equal(quote.seasonalTotalMax, quote.seasonalTotalMin);
    assert.equal(quote.fullSeasonTotal, quote.seasonalTotalMax);
    assert.equal(quote.seasonalDiscountRate, 0.2);
    assert.equal(
      quote.seasonalDiscountedTotal,
      Number((quote.fullSeasonTotal * (1 - quote.seasonalDiscountRate)).toFixed(2))
    );
    assert.equal(
      quote.seasonalSavingsTotal,
      Number((quote.fullSeasonTotal - quote.seasonalDiscountedTotal).toFixed(2))
    );
    assert.ok(typeof quote.submittedAt === 'string' && quote.submittedAt.length > 0);

    const contactsResponse = await fetch(`${baseUrl}/api/admin/contacts?limit=10`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(contactsResponse.status, 200);
    const contactsBody = (await contactsResponse.json()) as {
      items: Array<{ email: string | null; phone: string | null; addressText: string | null }>;
    };
    const quoteContact = contactsBody.items.find((item) => item.email === 'customer-martin@example.com');
    assert.ok(quoteContact);
    assert.equal(quoteContact.phone, '+1 416 555 0100');
    assert.equal(quoteContact.addressText, draftPayload.address);
  });

  it('propagates account email marketing consent when a customer finalizes a quote', async () => {
    const { baseUrl } = await startServer();
    const draftRing: Array<[number, number]> = [
      [-79.5202, 43.8438],
      [-79.5193, 43.8438],
      [-79.5193, 43.8445],
      [-79.5202, 43.8445]
    ];

    const draft = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-marketing-draft-1'
      },
      body: JSON.stringify({
        address: '42 Consent Lane, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: createPolygonGeometry(draftRing),
        polygonSource: createPolygonSource('service-1', draftRing),
        plan: 'Premium Weekly',
        quoteTotal: 180,
        serviceFrequency: 'weekly'
      })
    });
    assert.equal(draft.status, 201);
    const draftBody = (await draft.json()) as { quoteId: string };

    const finalize = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-marketing-contact-1',
        Authorization: 'Bearer customer-marketing'
      },
      body: JSON.stringify({})
    });
    assert.equal(finalize.status, 200);

    const leadsResponse = await fetch(`${baseUrl}/api/admin/leads?consentMarketing=true`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(leadsResponse.status, 200);
    const leadsBody = (await leadsResponse.json()) as {
      items: Array<{ primaryEmail: string | null; consentMarketing: boolean }>;
    };
    const lead = leadsBody.items.find((item) => item.primaryEmail === 'customer-marketing@example.com');

    assert.ok(lead);
    assert.equal(lead.consentMarketing, true);
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
        polygon: createPolygonGeometry([
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
        polygonSource: createPolygonSource('service-1', [
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
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
      body: JSON.stringify({})
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

  it('rejects quote finalization when account phone is missing', async () => {
    const { baseUrl } = await startServer({
      customerIdentityFromToken: (token) => {
        const identity = customerIdentityFromToken(token);
        if (!identity) {
          return null;
        }

        if (token === 'customer-no-phone') {
          return {
            ...identity,
            phone: null
          };
        }

        return identity;
      }
    });

    const draft = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-no-phone-draft-1'
      },
      body: JSON.stringify({
        address: '200 No Phone Road, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: createPolygonGeometry([
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
        polygonSource: createPolygonSource('service-1', [
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
        plan: 'Starter',
        quoteTotal: 180,
        serviceFrequency: 'weekly'
      })
    });
    assert.equal(draft.status, 201);
    const draftBody = (await draft.json()) as { quoteId: string };

    const claim = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer customer-no-phone'
      }
    });
    assert.equal(claim.status, 400);
    const claimBody = (await claim.json()) as { error: string };
    assert.equal(claimBody.error, 'Authenticated account profile is missing required fields.');

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-no-phone-contact-1',
        Authorization: 'Bearer customer-no-phone'
      },
      body: JSON.stringify({})
    });
    assert.equal(finalizeResponse.status, 400);
    const finalizeBody = (await finalizeResponse.json()) as { error: string };
    assert.equal(finalizeBody.error, 'Authenticated account profile is missing required fields.');

    const accountQuotes = await fetch(`${baseUrl}/api/account/quotes`, {
      headers: {
        Authorization: 'Bearer customer-no-phone'
      }
    });
    assert.equal(accountQuotes.status, 400);
  });

  it('records signed-in customer addresses on draft create and finalize', async () => {
    const recordedAddresses: Array<{ userId: string; addressText: string }> = [];
    const { baseUrl } = await startServer({
      recordAddress: async (input) => {
        recordedAddresses.push(input);
      }
    });

    const draftAddress = '900 Address Trail, Vaughan, ON';
    const draft = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-address-sync-draft-1',
        Authorization: 'Bearer customer-address-sync'
      },
      body: JSON.stringify({
        address: draftAddress,
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: createPolygonGeometry([
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
        polygonSource: createPolygonSource('service-1', [
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
        plan: 'Starter',
        quoteTotal: 180,
        serviceFrequency: 'weekly'
      })
    });
    assert.equal(draft.status, 201);
    const draftBody = (await draft.json()) as { quoteId: string };

    const finalizeResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'quote-address-sync-contact-1',
        Authorization: 'Bearer customer-address-sync'
      },
      body: JSON.stringify({})
    });
    assert.equal(finalizeResponse.status, 200);

    assert.equal(recordedAddresses.length, 2);
    assert.deepEqual(recordedAddresses, [
      { userId: 'customer-address-sync', addressText: draftAddress },
      { userId: 'customer-address-sync', addressText: draftAddress }
    ]);
  });
});

describe('admin quote editor workflow', () => {
  it('rejects draft payloads that omit polygon source after the freehand cutover', async () => {
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
    assert.equal(draftResponse.status, 400);
    const draftBody = (await draftResponse.json()) as { error: string };
    assert.equal(draftBody.error, 'Invalid quote payload.');
  });

  it('rejects polygon source payloads that do not match the submitted geometry', async () => {
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
        polygon: createPolygonGeometry([
          [-79.5201, 43.8439],
          [-79.5194, 43.8439],
          [-79.5194, 43.8444],
          [-79.5201, 43.8444]
        ]),
        polygonSource: createPolygonSource('service-1', [
          [43.8439, -79.5201],
          [43.8439, -79.5194],
          [43.8444, -79.5194],
          [43.8444, -79.5201]
        ]),
        plan: 'Starter Autonomy Plan',
        quoteTotal: 175,
        serviceFrequency: 'weekly',
        baseTotal: 49,
        pricingVersion: 'v1',
        currency: 'CAD'
      })
    });
    assert.equal(draftResponse.status, 400);
    const draftBody = (await draftResponse.json()) as { error: string };
    assert.equal(draftBody.error, 'Invalid quote editor payload.');
  });

  it('rejects quote geometry that is wildly inconsistent with the selected address location', async () => {
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
        polygon: createPolygonGeometry([
          [43.8439, -79.5201],
          [43.8439, -79.5194],
          [43.8444, -79.5194],
          [43.8444, -79.5201]
        ]),
        polygonSource: createPolygonSource('service-1', [
          [43.8439, -79.5201],
          [43.8439, -79.5194],
          [43.8444, -79.5194],
          [43.8444, -79.5201]
        ]),
        plan: 'Starter Autonomy Plan',
        quoteTotal: 176,
        serviceFrequency: 'weekly',
        baseTotal: 49,
        pricingVersion: 'v1',
        currency: 'CAD'
      })
    });
    assert.equal(draftResponse.status, 400);
    const draftBody = (await draftResponse.json()) as { error: string };
    assert.equal(draftBody.error, 'Invalid quote editor payload.');
  });

  it('creates admin quotes with reserved IDs, previews before auth, claims with phone, chooses billing, and starts checkout', async () => {
    const sessions: CreateStripeCheckoutSessionInput[] = [];
    const { baseUrl } = await startServer({
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      stripeProvider: createFakeStripeProvider({ sessions })
    });

    const reservationResponse = await fetch(`${baseUrl}/api/admin/quotes/reserve-id`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(reservationResponse.status, 201);
    const reservationBody = (await reservationResponse.json()) as { quoteId: string; expiresAt: string };
    assert.match(reservationBody.quoteId, /^[23456789ABCDEFGHJKMNPRSTUVWXYZ]{6}$/);
    assert.doesNotMatch(reservationBody.quoteId, /[01ILOQ]/);
    assert.ok(reservationBody.expiresAt);

    const adminRing: Array<[number, number]> = [
      [-79.5204, 43.8437],
      [-79.519, 43.8437],
      [-79.519, 43.8446],
      [-79.5204, 43.8446]
    ];

    const createResponse = await fetch(`${baseUrl}/api/admin/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-admin'
      },
      body: JSON.stringify({
        quoteId: reservationBody.quoteId,
        address: '12 Admin Claim Way, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: createPolygonGeometry(adminRing),
        polygonSource: createPolygonSource('admin-service-1', adminRing),
        billingMode: 'seasonal',
        globalDiscountRate: 0.1,
        seasonalDiscountRate: 0.25,
        priceOverrideEnabled: true,
        overrideBasePerSessionTotal: 100,
        serviceFrequency: 'weekly',
        pricingVersion: 'v1',
        currency: 'CAD'
      })
    });
    assert.equal(createResponse.status, 201);
    const createBody = (await createResponse.json()) as {
      quoteId: string;
      status: string;
      customerStatus: string;
      contactPending: boolean;
      perSessionTotal: number;
      seasonalDiscountedTotal: number;
    };
    assert.equal(createBody.quoteId, reservationBody.quoteId);
    assert.equal(createBody.status, 'verified');
    assert.equal(createBody.customerStatus, 'awaiting_payment');
    assert.equal(createBody.contactPending, false);
    assert.equal(createBody.perSessionTotal, 90);
    assert.equal(createBody.seasonalDiscountedTotal, 1350);

    const previewResponse = await fetch(`${baseUrl}/api/quote-preview/${reservationBody.quoteId}`);
    assert.equal(previewResponse.status, 200);
    const previewBody = (await previewResponse.json()) as {
      id: string;
      address: string;
      customerStatus: string;
      polygonSource: { schemaVersion: number; polygons: unknown[] } | null;
      perSessionTotal: number;
      seasonalDiscountedTotal: number;
    };
    assert.equal(previewBody.id, reservationBody.quoteId);
    assert.equal(previewBody.address, '12 Admin Claim Way, Vaughan, ON');
    assert.equal(previewBody.customerStatus, 'awaiting_payment');
    assert.equal(previewBody.polygonSource?.schemaVersion, 2);
    assert.equal(previewBody.polygonSource?.polygons.length, 1);
    assert.equal(previewBody.perSessionTotal, 90);
    assert.equal(previewBody.seasonalDiscountedTotal, 1350);

    const incompleteClaimResponse = await fetch(`${baseUrl}/api/quote/${reservationBody.quoteId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer customer-no-phone'
      }
    });
    assert.equal(incompleteClaimResponse.status, 400);

    const claimResponse = await fetch(`${baseUrl}/api/quote/${reservationBody.quoteId}/claim`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer customer-admin-quote'
      }
    });
    assert.equal(claimResponse.status, 200);
    const claimBody = (await claimResponse.json()) as { ok: boolean; claimed: boolean };
    assert.equal(claimBody.ok, true);
    assert.equal(claimBody.claimed, true);

    const billingResponse = await fetch(`${baseUrl}/api/account/quotes/${reservationBody.quoteId}/billing-mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer customer-admin-quote'
      },
      body: JSON.stringify({ billingMode: 'per_session' })
    });
    assert.equal(billingResponse.status, 200);
    const billingBody = (await billingResponse.json()) as { billingMode: string };
    assert.equal(billingBody.billingMode, 'per_session');

    const checkoutResponse = await fetch(
      `${baseUrl}/api/account/quotes/${reservationBody.quoteId}/payment/checkout`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer customer-admin-quote'
        }
      }
    );
    assert.equal(checkoutResponse.status, 200);
    const checkoutBody = (await checkoutResponse.json()) as { checkoutUrl: string; checkoutSessionId: string };
    assert.equal(checkoutBody.checkoutUrl, 'https://checkout.stripe.test/session/1');
    assert.equal(checkoutBody.checkoutSessionId, 'cs_test_1');
    assert.equal(sessions[0]?.mode, 'per_session_subscription');
    assert.equal(sessions[0]?.amountCents, 9000);
  });

  it('rejects admin quote creation with invalid self-intersecting geometry', async () => {
    const { baseUrl } = await startServer();
    const bowTieRing: Array<[number, number]> = [
      [-79.5204, 43.8437],
      [-79.519, 43.8446],
      [-79.5204, 43.8446],
      [-79.519, 43.8437]
    ];

    const createResponse = await fetch(`${baseUrl}/api/admin/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-admin'
      },
      body: JSON.stringify({
        address: '44 Invalid Geometry Rd, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: createPolygonGeometry(bowTieRing),
        polygonSource: createPolygonSource('invalid-service-1', bowTieRing),
        serviceFrequency: 'weekly',
        pricingVersion: 'v1',
        currency: 'CAD'
      })
    });
    assert.equal(createResponse.status, 400);
  });

  it('supports versioned admin edits and submit to verified awaiting payment', async () => {
    const { baseUrl } = await startServer();
    const reviewRing: Array<[number, number]> = [
      [-79.5203, 43.8437],
      [-79.5192, 43.8437],
      [-79.5192, 43.8446],
      [-79.5203, 43.8446]
    ];

    const draftPayload = {
      address: '88 Review Crescent, Vaughan, ON',
      location: {
        lat: 43.844147,
        lng: -79.51962
      },
      polygon: createPolygonGeometry(reviewRing),
      polygonSource: createPolygonSource('service-1', reviewRing),
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
      body: JSON.stringify({})
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
    assert.equal(editorBody.polygonSource.schemaVersion, 2);
    assert.equal(editorBody.versions[0]?.versionNumber, 1);
    assert.equal(editorBody.versions[0]?.actorType, 'client');

    const versionResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-admin'
      },
      body: JSON.stringify({
        polygonSource: createPolygonSource('service-1', [
          [-79.5204, 43.8437],
          [-79.5191, 43.8437],
          [-79.5191, 43.8447],
          [-79.5204, 43.8447]
        ]),
        serviceFrequency: 'weekly',
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

  it('sends an approved quote email, exposes preview/payment metadata, and supports resend', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const mapboxUrls: string[] = [];
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: `msg-${sentEmails.length}`
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch(mapboxUrls)
      }
    });

    const reviewRing: Array<[number, number]> = [
      [-79.5203, 43.8437],
      [-79.5192, 43.8437],
      [-79.5192, 43.8446],
      [-79.5203, 43.8446]
    ];

    const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'approved-email-draft-1'
      },
      body: JSON.stringify({
        address: '88 Review Crescent, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: createPolygonGeometry(reviewRing),
        polygonSource: createPolygonSource('service-1', reviewRing),
        plan: 'Precision Weekly Plan',
        quoteTotal: 210.25,
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
        'Idempotency-Key': 'approved-email-contact-1',
        Authorization: 'Bearer customer-reviewer'
      },
      body: JSON.stringify({})
    });
    assert.equal(finalizeResponse.status, 200);

    const versionResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-admin'
      },
      body: JSON.stringify({
        polygonSource: createPolygonSource('service-1', [
          [-79.5204, 43.8437],
          [-79.519, 43.8437],
          [-79.519, 43.8445],
          [-79.5204, 43.8445]
        ]),
        serviceFrequency: 'weekly',
        perSessionTotal: 199.99,
        finalTotal: 225
      })
    });
    assert.equal(versionResponse.status, 200);
    const versionBody = (await versionResponse.json()) as { version: number };

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
      approvedQuoteEmail?: { sent?: boolean };
    };
    assert.equal(submitBody.status, 'verified');
    assert.equal(submitBody.customerStatus, 'awaiting_payment');
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0]?.to, 'customer-reviewer@example.com');
    assert.equal(sentEmails[0]?.subject, 'Your Autoscape quote is ready for payment');
    assert.match(sentEmails[0]?.html ?? '', /Approved service area/);
    assert.match(sentEmails[0]?.html ?? '', /Added after review/);
    assert.match(sentEmails[0]?.html ?? '', /Removed after review/);
    assert.match(sentEmails[0]?.html ?? '', /Review and pay securely/);
    assert.doesNotMatch(sentEmails[0]?.html ?? '', /PAYMENT BUTTON - CONTINUE TO PAYMENT/);
    assert.doesNotMatch(sentEmails[0]?.html ?? '', /PAYMENT BUTTON - OPEN PAYMENT PAGE/);
    assert.match(sentEmails[0]?.text ?? '', /ready for payment/);
    assert.match(sentEmails[0]?.html ?? '', /payment page/i);
    assert.doesNotMatch(sentEmails[0]?.html ?? '', /test-mapbox-token/);
    assert.match(sentEmails[0]?.html ?? '', /https:\/\/client\.autoscape\.test\/pay\/[A-Za-z0-9_-]+/);
    assert.doesNotMatch(sentEmails[0]?.html ?? '', /dashboard\/quotes\/[^/]+\/payment/);

    const previewUrl = sentEmails[0]?.html.match(/src="([^"]*\/api\/approved-quote-preview\/[^"]+)"/)?.[1] ?? null;
    assert.ok(previewUrl);
    assert.doesNotMatch(previewUrl, /test-mapbox-token/);
    const previewResponse = await fetch(`${baseUrl}${new URL(previewUrl).pathname}`);
    assert.equal(previewResponse.status, 200);
    assert.match(previewResponse.headers.get('content-type') ?? '', /image\/jpeg/);
    const previewImage = Buffer.from(await previewResponse.arrayBuffer());
    assert.deepEqual([...previewImage], [0xff, 0xd8, 0xff, 0xd9]);
    assert.equal(mapboxUrls.length, 1);
    assert.match(mapboxUrls[0] ?? '', /mapbox\/satellite-v9/);
    assert.match(mapboxUrls[0] ?? '', /%23BFEBCF/i);
    assert.match(mapboxUrls[0] ?? '', /%23DC2626/i);
    assert.match(mapboxUrls[0] ?? '', /access_token=test-mapbox-token/);

    const customerQuoteResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}`, {
      headers: {
        Authorization: 'Bearer customer-reviewer'
      }
    });
    assert.equal(customerQuoteResponse.status, 200);
    const customerQuoteBody = (await customerQuoteResponse.json()) as {
      customerStatus: string;
      verifiedAt: string | null;
      paymentPageUrl: string | null;
      approvedQuotePreviewImageUrl: string | null;
    };
    assert.equal(customerQuoteBody.customerStatus, 'awaiting_payment');
    assert.equal(typeof customerQuoteBody.verifiedAt, 'string');
    assert.equal(
      customerQuoteBody.paymentPageUrl,
      `https://client.autoscape.test/dashboard/quotes/${draftBody.quoteId}/payment`
    );
    assert.match(
      customerQuoteBody.approvedQuotePreviewImageUrl ?? '',
      /^https:\/\/api\.autoscape\.test\/api\/approved-quote-preview\//
    );

    const editorResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(editorResponse.status, 200);
    const editorBody = (await editorResponse.json()) as {
      approvedQuoteEmail: {
        status: string;
        triggerSource: string;
        recipientEmail: string | null;
        paymentPageUrl: string | null;
        previewImageUrl: string | null;
      } | null;
    };
    assert.equal(editorBody.approvedQuoteEmail?.status, 'sent');
    assert.equal(editorBody.approvedQuoteEmail?.triggerSource, 'approval');
    assert.equal(editorBody.approvedQuoteEmail?.recipientEmail, 'customer-reviewer@example.com');
    assert.equal(
      editorBody.approvedQuoteEmail?.paymentPageUrl,
      `https://client.autoscape.test/dashboard/quotes/${draftBody.quoteId}/payment`
    );
    assert.match(editorBody.approvedQuoteEmail?.previewImageUrl ?? '', /^\/api\/approved-quote-preview\//);

    const resendResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${draftBody.quoteId}/approval-email/resend`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-admin'
        }
      }
    );
    assert.equal(resendResponse.status, 200);
    assert.equal(sentEmails.length, 2);

    const finalEditorResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(finalEditorResponse.status, 200);
    const finalEditorBody = (await finalEditorResponse.json()) as {
      approvedQuoteEmail: {
        status: string;
        triggerSource: string;
      } | null;
    };
    assert.equal(finalEditorBody.approvedQuoteEmail?.status, 'sent');
    assert.equal(finalEditorBody.approvedQuoteEmail?.triggerSource, 'manual_resend');
  });

  it('keeps quote approval successful when approved quote email map configuration is missing', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: 'msg-unexpected'
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      }
    });
    const scenario = await createReviewQuoteVersion(baseUrl, 'approved-email-missing-public-api');

    const submitResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${scenario.quoteId}/versions/${scenario.version}/submit`,
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
      approvedQuoteEmail?: { sent?: boolean; errorMessage?: string };
    };
    assert.equal(submitBody.status, 'verified');
    assert.equal(submitBody.customerStatus, 'awaiting_payment');
    assert.equal(submitBody.approvedQuoteEmail?.sent, false);
    assert.match(submitBody.approvedQuoteEmail?.errorMessage ?? '', /PUBLIC_API_BASE_URL/);
    assert.equal(sentEmails.length, 0);
  });

  it('creates a secure public seasonal checkout link and keeps older email tokens on the current payment link', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const sessions: CreateStripeCheckoutSessionInput[] = [];
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: `msg-seasonal-${sentEmails.length}`
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      },
      stripeProvider: createFakeStripeProvider({ sessions })
    });
    const scenario = await createReviewQuoteVersion(baseUrl, 'seasonal-payment');

    const submitResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${scenario.quoteId}/versions/${scenario.version}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-reviewer'
        }
      }
    );
    assert.equal(submitResponse.status, 200);
    assert.equal(sentEmails.length, 1);
    const firstToken = extractPaymentToken(sentEmails[0]?.html ?? '');

    const firstLinkResponse = await fetch(`${baseUrl}/api/payment-links/${firstToken}`);
    assert.equal(firstLinkResponse.status, 200);
    const firstLinkBody = (await firstLinkResponse.json()) as {
      quote: { id: string };
      payment: { mode: string; amountCents: number; status: string };
    };
    assert.equal(firstLinkBody.quote.id, scenario.quoteId);
    assert.equal(firstLinkBody.payment.mode, 'seasonal_payment');
    assert.equal(firstLinkBody.payment.amountCents, 319984);
    assert.equal(firstLinkBody.payment.status, 'awaiting_payment');

    const resendResponse = await fetch(`${baseUrl}/api/admin/quotes/${scenario.quoteId}/approval-email/resend`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(resendResponse.status, 200);
    assert.equal(sentEmails.length, 2);
    const secondToken = extractPaymentToken(sentEmails[1]?.html ?? '');
    assert.notEqual(secondToken, firstToken);

    const supersededResponse = await fetch(`${baseUrl}/api/payment-links/${firstToken}`);
    assert.equal(supersededResponse.status, 200);
    const supersededBody = (await supersededResponse.json()) as {
      quote: { id: string };
      payment: { status: string; amountCents: number };
    };
    assert.equal(supersededBody.quote.id, scenario.quoteId);
    assert.equal(supersededBody.payment.status, 'awaiting_payment');
    assert.equal(supersededBody.payment.amountCents, 319984);

    const checkoutResponse = await fetch(`${baseUrl}/api/payment-links/${firstToken}/checkout`, {
      method: 'POST'
    });
    assert.equal(checkoutResponse.status, 200);
    const checkoutBody = (await checkoutResponse.json()) as {
      checkoutUrl: string;
      checkoutSessionId: string;
      reused: boolean;
    };
    assert.equal(checkoutBody.checkoutUrl, 'https://checkout.stripe.test/session/1');
    assert.equal(checkoutBody.checkoutSessionId, 'cs_test_1');
    assert.equal(checkoutBody.reused, false);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.mode, 'seasonal_payment');
    assert.equal(sessions[0]?.amountCents, 319984);
    assert.equal(
      sessions[0]?.successUrl,
      `https://client.autoscape.test/payment-complete?quoteId=${scenario.quoteId}&session_id={CHECKOUT_SESSION_ID}`
    );
    assert.equal(sessions[0]?.cancelUrl, `https://client.autoscape.test/pay/${firstToken}?status=canceled`);

    const replayCheckoutResponse = await fetch(`${baseUrl}/api/payment-links/${secondToken}/checkout`, {
      method: 'POST'
    });
    assert.equal(replayCheckoutResponse.status, 200);
    const replayCheckoutBody = (await replayCheckoutResponse.json()) as { reused: boolean };
    assert.equal(replayCheckoutBody.reused, true);
    assert.equal(sessions.length, 1);

    const missingResponse = await fetch(`${baseUrl}/api/payment-links/not-a-real-token`);
    assert.equal(missingResponse.status, 404);
  });

  it('lets an authenticated customer start approved quote checkout from the dashboard route', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const sessions: CreateStripeCheckoutSessionInput[] = [];
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: `msg-dashboard-${sentEmails.length}`
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      },
      stripeProvider: createFakeStripeProvider({ sessions })
    });
    const scenario = await createReviewQuoteVersion(baseUrl, 'dashboard-payment');

    const submitResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${scenario.quoteId}/versions/${scenario.version}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-reviewer'
        }
      }
    );
    assert.equal(submitResponse.status, 200);
    assert.equal(sentEmails.length, 1);

    const checkoutResponse = await fetch(
      `${baseUrl}/api/account/quotes/${scenario.quoteId}/payment/checkout`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer customer-reviewer'
        }
      }
    );
    assert.equal(checkoutResponse.status, 200);
    const checkoutBody = (await checkoutResponse.json()) as {
      checkoutUrl: string;
      checkoutSessionId: string;
      reused: boolean;
    };
    assert.equal(checkoutBody.checkoutUrl, 'https://checkout.stripe.test/session/1');
    assert.equal(checkoutBody.checkoutSessionId, 'cs_test_1');
    assert.equal(checkoutBody.reused, false);
    assert.equal(sessions.length, 1);
    assert.equal(
      sessions[0]?.successUrl,
      `https://client.autoscape.test/payment-complete?quoteId=${scenario.quoteId}&session_id={CHECKOUT_SESSION_ID}`
    );
    assert.equal(
      sessions[0]?.cancelUrl,
      `https://client.autoscape.test/dashboard/quotes/${scenario.quoteId}/payment?status=canceled`
    );

    const accountQuoteResponse = await fetch(`${baseUrl}/api/account/quotes/${scenario.quoteId}`, {
      headers: {
        Authorization: 'Bearer customer-reviewer'
      }
    });
    assert.equal(accountQuoteResponse.status, 200);
    const accountQuote = (await accountQuoteResponse.json()) as {
      payment?: { status: string; amountCents: number } | null;
    };
    assert.equal(accountQuote.payment?.status, 'checkout_created');
    assert.equal(accountQuote.payment?.amountCents, 319984);
  });

  it('includes customer status, payment status, and payment page links in account quote lists', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: `msg-list-${sentEmails.length}`
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      },
      stripeProvider: createFakeStripeProvider({})
    });
    const scenario = await createReviewQuoteVersion(baseUrl, 'dashboard-list');

    const submitResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${scenario.quoteId}/versions/${scenario.version}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-reviewer'
        }
      }
    );
    assert.equal(submitResponse.status, 200);

    const accountQuotesResponse = await fetch(`${baseUrl}/api/account/quotes`, {
      headers: {
        Authorization: 'Bearer customer-reviewer'
      }
    });
    assert.equal(accountQuotesResponse.status, 200);
    const accountQuotesBody = (await accountQuotesResponse.json()) as {
      items: Array<{
        id: string;
        customerStatus: string;
        verifiedAt: string | null;
        paymentPageUrl: string | null;
        payment: { status: string; amountCents: number } | null;
      }>;
    };
    const quote = accountQuotesBody.items.find((item) => item.id === scenario.quoteId);
    assert.ok(quote);
    assert.equal(quote?.customerStatus, 'awaiting_payment');
    assert.equal(typeof quote?.verifiedAt, 'string');
    assert.equal(
      quote?.paymentPageUrl,
      `https://client.autoscape.test/dashboard/quotes/${scenario.quoteId}/payment`
    );
    assert.equal(quote?.payment?.status, 'awaiting_payment');
    assert.equal(quote?.payment?.amountCents, 319984);
  });

  it('returns billing metadata and opens Stripe billing portal when a saved card exists', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const sessions: CreateStripeCheckoutSessionInput[] = [];
    const billingPortalSessions: Array<{ customerId: string; returnUrl: string }> = [];
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: `msg-billing-${sentEmails.length}`
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      },
      stripeProvider: createFakeStripeProvider({
        sessions,
        billingPortalSessions,
        billingStateByCustomerId: {
          cus_test_1: {
            canManageCard: true,
            cardOnFile: {
              brand: 'visa',
              last4: '4242',
              expMonth: 4,
              expYear: 2030
            }
          }
        }
      })
    });
    const scenario = await createReviewQuoteVersion(baseUrl, 'dashboard-billing-card', undefined, {
      billingMode: 'per_session'
    });

    const submitResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${scenario.quoteId}/versions/${scenario.version}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-reviewer'
        }
      }
    );
    assert.equal(submitResponse.status, 200);

    const checkoutResponse = await fetch(
      `${baseUrl}/api/account/quotes/${scenario.quoteId}/payment/checkout`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer customer-reviewer'
        }
      }
    );
    assert.equal(checkoutResponse.status, 200);
    assert.equal(sessions.length, 1);

    const accountQuoteResponse = await fetch(`${baseUrl}/api/account/quotes/${scenario.quoteId}`, {
      headers: {
        Authorization: 'Bearer customer-reviewer'
      }
    });
    assert.equal(accountQuoteResponse.status, 200);
    const accountQuote = (await accountQuoteResponse.json()) as {
      billing: {
        canManageCard: boolean;
        cardOnFile: {
          brand: string;
          last4: string;
          expMonth: number;
          expYear: number;
        } | null;
      };
    };
    assert.equal(accountQuote.billing.canManageCard, true);
    assert.deepEqual(accountQuote.billing.cardOnFile, {
      brand: 'visa',
      last4: '4242',
      expMonth: 4,
      expYear: 2030
    });

    const billingPortalResponse = await fetch(
      `${baseUrl}/api/account/quotes/${scenario.quoteId}/billing-portal`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer customer-reviewer'
        }
      }
    );
    assert.equal(billingPortalResponse.status, 200);
    const billingPortalBody = (await billingPortalResponse.json()) as { portalUrl: string };
    assert.equal(billingPortalBody.portalUrl, 'https://billing.stripe.test/session/cus_test_1');
    assert.deepEqual(billingPortalSessions, [
      {
        customerId: 'cus_test_1',
        returnUrl: 'https://client.autoscape.test/dashboard'
      }
    ]);
  });

  it('rejects billing portal access when no Stripe customer billing context exists yet', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: `msg-no-billing-${sentEmails.length}`
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      },
      stripeProvider: createFakeStripeProvider({})
    });
    const scenario = await createReviewQuoteVersion(baseUrl, 'dashboard-billing-missing');

    const submitResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${scenario.quoteId}/versions/${scenario.version}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-reviewer'
        }
      }
    );
    assert.equal(submitResponse.status, 200);

    const billingPortalResponse = await fetch(
      `${baseUrl}/api/account/quotes/${scenario.quoteId}/billing-portal`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer customer-reviewer'
        }
      }
    );
    assert.equal(billingPortalResponse.status, 409);
    const billingPortalBody = (await billingPortalResponse.json()) as { error: string };
    assert.equal(billingPortalBody.error, 'Card management is not available for this quote yet.');
  });

  it('starts per-visit subscription billing at checkout on or after May 1', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const sessions: CreateStripeCheckoutSessionInput[] = [];
    const { baseUrl } = await startServer({
      nowMs: () => Date.UTC(2026, 4, 15, 12, 0, 0),
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: `msg-in-season-${sentEmails.length}`
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      },
      stripeProvider: createFakeStripeProvider({ sessions })
    });
    const scenario = await createReviewQuoteVersion(baseUrl, 'per-visit-in-season', undefined, {
      billingMode: 'per_session'
    });

    const submitResponse = await fetch(
      `${baseUrl}/api/admin/quotes/${scenario.quoteId}/versions/${scenario.version}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer admin-reviewer'
        }
      }
    );
    assert.equal(submitResponse.status, 200);
    const token = extractPaymentToken(sentEmails[0]?.html ?? '');

    const checkoutResponse = await fetch(`${baseUrl}/api/payment-links/${token}/checkout`, {
      method: 'POST'
    });
    assert.equal(checkoutResponse.status, 200);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.mode, 'per_session_subscription');
    assert.equal(sessions[0]?.deferredStartUnix, null);
    assert.equal(
      new Date((sessions[0]?.seasonEndUnix ?? 0) * 1000).toISOString(),
      '2026-10-01T03:59:59.000Z'
    );
  });

  it('creates per-visit subscription checkout, schedules May billing, and caps paid invoices', async () => {
    const sentEmails: Array<{ to: string; subject: string; html: string; text: string }> = [];
    const sessions: CreateStripeCheckoutSessionInput[] = [];
    const updatedCancelAt: Array<{ subscriptionId: string; cancelAtUnix: number }> = [];
    const canceledSubscriptions: string[] = [];
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send(message) {
          sentEmails.push(message);
          return {
            provider: 'resend',
            messageId: `msg-per-visit-${sentEmails.length}`
          };
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      },
      stripeProvider: createFakeStripeProvider({ sessions, updatedCancelAt, canceledSubscriptions })
    });

    const reviewRing: Array<[number, number]> = [
      [-79.5203, 43.8437],
      [-79.5192, 43.8437],
      [-79.5192, 43.8446],
      [-79.5203, 43.8446]
    ];
    const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'per-visit-payment-draft'
      },
      body: JSON.stringify({
        address: '77 Weekly Pay Road, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: createPolygonGeometry(reviewRing),
        polygonSource: createPolygonSource('service-1', reviewRing),
        plan: 'Precision Weekly Plan',
        quoteTotal: 210.25,
        serviceFrequency: 'weekly',
        billingMode: 'per_session',
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
        'Idempotency-Key': 'per-visit-payment-contact',
        Authorization: 'Bearer customer-reviewer'
      },
      body: JSON.stringify({})
    });
    assert.equal(finalizeResponse.status, 200);

    const versionResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-admin'
      },
      body: JSON.stringify({
        polygonSource: createPolygonSource('service-1', [
          [-79.5204, 43.8437],
          [-79.519, 43.8437],
          [-79.519, 43.8445],
          [-79.5204, 43.8445]
        ]),
        serviceFrequency: 'weekly',
        perSessionTotal: 199.99,
        finalTotal: 225
      })
    });
    assert.equal(versionResponse.status, 200);
    const versionBody = (await versionResponse.json()) as { version: number };

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
    const token = extractPaymentToken(sentEmails[0]?.html ?? '');

    const checkoutResponse = await fetch(`${baseUrl}/api/payment-links/${token}/checkout`, {
      method: 'POST'
    });
    assert.equal(checkoutResponse.status, 200);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.mode, 'per_session_subscription');
    assert.equal(sessions[0]?.amountCents, 19999);
    assert.equal(sessions[0]?.maxBillableVisits, 20);
    assert.equal(
      new Date((sessions[0]?.deferredStartUnix ?? 0) * 1000).toISOString(),
      '2026-05-01T04:00:00.000Z'
    );
    assert.equal(
      new Date((sessions[0]?.seasonEndUnix ?? 0) * 1000).toISOString(),
      '2026-10-01T03:59:59.000Z'
    );

    const invalidWebhook = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'invalid-signature'
      },
      body: JSON.stringify({ id: 'evt_invalid', type: 'checkout.session.completed', data: { object: {} } })
    });
    assert.equal(invalidWebhook.status, 400);

    const completedEvent = {
      id: 'evt_checkout_completed',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          customer: 'cus_test_1',
          subscription: 'sub_test_1',
          metadata: {
            paymentMode: 'per_session_subscription',
            deferredStartUnix: String(sessions[0]?.deferredStartUnix ?? '')
          }
        }
      }
    };
    const webhookResponse = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'valid-signature'
      },
      body: JSON.stringify(completedEvent)
    });
    assert.equal(webhookResponse.status, 200);
    assert.deepEqual(updatedCancelAt, [
      {
        subscriptionId: 'sub_test_1',
        cancelAtUnix: sessions[0]?.seasonEndUnix ?? 0
      }
    ]);

    const webhookReplay = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'valid-signature'
      },
      body: JSON.stringify(completedEvent)
    });
    assert.equal(webhookReplay.status, 200);
    const webhookReplayBody = (await webhookReplay.json()) as { replayed: boolean };
    assert.equal(webhookReplayBody.replayed, true);

    for (let index = 1; index <= 20; index += 1) {
      const invoiceWebhook = await fetch(`${baseUrl}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': 'valid-signature'
        },
        body: JSON.stringify({
          id: `evt_invoice_paid_${index}`,
          type: 'invoice.paid',
          data: {
            object: {
              id: `in_test_${index}`,
              subscription: 'sub_test_1'
            }
          }
        })
      });
      assert.equal(invoiceWebhook.status, 200);
    }

    assert.deepEqual(canceledSubscriptions, ['sub_test_1']);

    const duplicateInvoiceWebhook = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'valid-signature'
      },
      body: JSON.stringify({
        id: 'evt_invoice_paid_duplicate',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_test_20',
            subscription: 'sub_test_1'
          }
        }
      })
    });
    assert.equal(duplicateInvoiceWebhook.status, 200);
    assert.deepEqual(canceledSubscriptions, ['sub_test_1']);

    const finalLinkResponse = await fetch(`${baseUrl}/api/payment-links/${token}`);
    assert.equal(finalLinkResponse.status, 200);
    const finalLinkBody = (await finalLinkResponse.json()) as {
      payment: { status: string; paidInvoiceCount: number };
    };
    assert.equal(finalLinkBody.payment.status, 'paid');
    assert.equal(finalLinkBody.payment.paidInvoiceCount, 20);
  });

  it('keeps quote approval successful when approved quote email delivery fails', async () => {
    const { baseUrl } = await startServer({
      approvedQuoteEmailSender: {
        async send() {
          throw new Error('Resend test failure');
        }
      },
      publicUrls: {
        appBaseUrl: 'https://client.autoscape.test',
        apiBaseUrl: 'https://api.autoscape.test'
      },
      approvedQuotePreview: {
        mapboxAccessToken: 'test-mapbox-token',
        fetchImpl: createMapboxImageFetch([])
      }
    });

    const reviewRing: Array<[number, number]> = [
      [-79.5203, 43.8437],
      [-79.5192, 43.8437],
      [-79.5192, 43.8446],
      [-79.5203, 43.8446]
    ];

    const draftResponse = await fetch(`${baseUrl}/api/quote/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'approved-email-failure-draft-1'
      },
      body: JSON.stringify({
        address: '99 Failure Crescent, Vaughan, ON',
        location: {
          lat: 43.844147,
          lng: -79.51962
        },
        polygon: createPolygonGeometry(reviewRing),
        polygonSource: createPolygonSource('service-1', reviewRing),
        plan: 'Precision Weekly Plan',
        quoteTotal: 210.25,
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
        'Idempotency-Key': 'approved-email-failure-contact-1',
        Authorization: 'Bearer customer-reviewer'
      },
      body: JSON.stringify({})
    });
    assert.equal(finalizeResponse.status, 200);

    const versionResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-admin'
      },
      body: JSON.stringify({
        polygonSource: createPolygonSource('service-1', [
          [-79.5204, 43.8437],
          [-79.5191, 43.8437],
          [-79.5191, 43.8447],
          [-79.5204, 43.8447]
        ]),
        serviceFrequency: 'weekly',
        perSessionTotal: 199.99,
        finalTotal: 225
      })
    });
    assert.equal(versionResponse.status, 200);
    const versionBody = (await versionResponse.json()) as { version: number };

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
      approvedQuoteEmail?: { sent?: boolean; errorMessage?: string };
    };
    assert.equal(submitBody.status, 'verified');
    assert.equal(submitBody.customerStatus, 'awaiting_payment');
    assert.equal(submitBody.approvedQuoteEmail?.sent, false);
    assert.match(submitBody.approvedQuoteEmail?.errorMessage ?? '', /Resend test failure/);

    const customerQuoteResponse = await fetch(`${baseUrl}/api/quote/${draftBody.quoteId}`, {
      headers: {
        Authorization: 'Bearer customer-reviewer'
      }
    });
    assert.equal(customerQuoteResponse.status, 200);
    const customerQuoteBody = (await customerQuoteResponse.json()) as { status: string; customerStatus: string };
    assert.equal(customerQuoteBody.status, 'verified');
    assert.equal(customerQuoteBody.customerStatus, 'awaiting_payment');

    const editorResponse = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/editor`, {
      headers: {
        Authorization: 'Bearer admin-admin'
      }
    });
    assert.equal(editorResponse.status, 200);
    const editorBody = (await editorResponse.json()) as {
      approvedQuoteEmail: {
        status: string;
        triggerSource: string;
        errorMessage: string | null;
      } | null;
    };
    assert.equal(editorBody.approvedQuoteEmail?.status, 'failed');
    assert.equal(editorBody.approvedQuoteEmail?.triggerSource, 'approval');
    assert.match(editorBody.approvedQuoteEmail?.errorMessage ?? '', /Resend test failure/);
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
        polygon: createPolygonGeometry([
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
        polygonSource: createPolygonSource('service-1', [
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
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
      body: JSON.stringify({})
    });
    assert.equal(finalizeResponse.status, 200);

    const versionCreate = await fetch(`${baseUrl}/api/admin/quotes/${draftBody.quoteId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-marketing'
      },
      body: JSON.stringify({
        polygonSource: createPolygonSource('service-1', [
          [-79.5202, 43.8438],
          [-79.5193, 43.8438],
          [-79.5193, 43.8445],
          [-79.5202, 43.8445]
        ]),
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
