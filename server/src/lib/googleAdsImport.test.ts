import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDataStore } from './dataStore.js';
import { fetchGoogleAdsSpendRows, importGoogleAdsSpend, type GoogleAdsImportConfig } from './googleAdsImport.js';

const config: GoogleAdsImportConfig = {
  developerToken: 'developer-token',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  refreshToken: 'refresh-token',
  customerId: '123-456-7890',
  loginCustomerId: '999-888-7777'
};

const createMockFetch = () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });

    if (url.includes('oauth2.googleapis.com')) {
      return new Response(JSON.stringify({ access_token: 'access-token' }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });
    }

    return new Response(
      JSON.stringify([
        {
          requestId: 'google-request-1',
          results: [
            {
              campaign: { id: '123', name: 'Search Campaign' },
              adGroup: { id: '456', name: 'Lawn Quotes' },
              adGroupAd: { ad: { id: '789', name: 'Instant Quote Ad' } },
              segments: { date: '2026-05-02', device: 'DESKTOP', adNetworkType: 'SEARCH' },
              metrics: {
                impressions: '1000',
                clicks: '75',
                costMicros: '123450000',
                conversions: 4.5,
                conversionsValue: 320
              }
            }
          ]
        }
      ]),
      {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      }
    );
  }) as typeof fetch;

  return { calls, fetchImpl };
};

describe('Google Ads spend import', () => {
  it('maps searchStream metrics into first-party ad metric rows', async () => {
    const { calls, fetchImpl } = createMockFetch();

    const result = await fetchGoogleAdsSpendRows(config, {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-02',
      fetchImpl
    });

    assert.equal(result.requestIds[0], 'google-request-1');
    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.rows[0], {
      platform: 'google_ads',
      accountId: '1234567890',
      date: '2026-05-02',
      campaignId: '123',
      campaignName: 'Search Campaign',
      adGroupId: '456',
      adGroupName: 'Lawn Quotes',
      adId: '789',
      adName: 'Instant Quote Ad',
      device: 'DESKTOP',
      network: 'SEARCH',
      impressions: 1000,
      clicks: 75,
      costMicros: 123450000n,
      conversions: 4.5,
      conversionValueMicros: 320000000n
    });
    assert.equal(calls[1].init?.headers && (calls[1].init.headers as Record<string, string>)['login-customer-id'], '9998887777');
  });

  it('records a successful import run after upserting spend rows', async () => {
    const { fetchImpl } = createMockFetch();
    const dataStore = createDataStore([]);
    await dataStore.initialize();

    const run = await importGoogleAdsSpend(dataStore, config, {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-02',
      fetchImpl
    });

    assert.equal(run.status, 'succeeded');
    assert.equal(run.rowCount, 1);

    const health = await dataStore.getAnalyticsHealth();
    assert.equal(health.latestGoogleAdsImport?.status, 'succeeded');
    assert.equal(health.latestGoogleAdsImport?.rowCount, 1);
  });
});

