import type { AdPlatformDailyMetricInput, DataStore } from './dataStore.js';

const googleAdsApiVersion = 'v22';
const oauthTokenUrl = 'https://oauth2.googleapis.com/token';
const googleAdsApiBaseUrl = 'https://googleads.googleapis.com';

export interface GoogleAdsImportConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string;
}

export interface GoogleAdsImportOptions {
  dateFrom: string;
  dateTo: string;
  fetchImpl?: typeof fetch;
}

interface GoogleAdsSearchStreamResponseChunk {
  results?: GoogleAdsSearchResult[];
  requestId?: string;
}

interface GoogleAdsSearchResult {
  campaign?: {
    id?: string | number;
    name?: string;
  };
  adGroup?: {
    id?: string | number;
    name?: string;
  };
  adGroupAd?: {
    ad?: {
      id?: string | number;
      name?: string;
    };
  };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    costMicros?: string | number;
    conversions?: string | number;
    conversionsValue?: string | number;
  };
  segments?: {
    date?: string;
    device?: string;
    adNetworkType?: string;
  };
}

const requireValue = (value: string | undefined, name: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} is required for Google Ads spend import.`);
  }

  return trimmed;
};

export const loadGoogleAdsImportConfigFromEnv = (env: NodeJS.ProcessEnv = process.env): GoogleAdsImportConfig => ({
  developerToken: requireValue(env.GOOGLE_ADS_DEVELOPER_TOKEN, 'GOOGLE_ADS_DEVELOPER_TOKEN'),
  clientId: requireValue(env.GOOGLE_ADS_CLIENT_ID, 'GOOGLE_ADS_CLIENT_ID'),
  clientSecret: requireValue(env.GOOGLE_ADS_CLIENT_SECRET, 'GOOGLE_ADS_CLIENT_SECRET'),
  refreshToken: requireValue(env.GOOGLE_ADS_REFRESH_TOKEN, 'GOOGLE_ADS_REFRESH_TOKEN'),
  customerId: requireValue(env.GOOGLE_ADS_CUSTOMER_ID, 'GOOGLE_ADS_CUSTOMER_ID'),
  loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || undefined
});

const normalizeCustomerId = (value: string) => value.replace(/\D/g, '');

const toNumber = (value: string | number | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBigInt = (value: string | number | undefined) => BigInt(Math.round(toNumber(value)));

const toMicrosFromCurrency = (value: string | number | undefined) => BigInt(Math.round(toNumber(value) * 1_000_000));

export const getGoogleAdsAccessToken = async (
  config: GoogleAdsImportConfig,
  fetchImpl: typeof fetch = fetch
) => {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetchImpl(oauthTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error ?? 'Unable to fetch Google Ads OAuth access token.');
  }

  return payload.access_token;
};

export const buildGoogleAdsSpendQuery = (dateFrom: string, dateTo: string) => `
SELECT
  segments.date,
  segments.device,
  segments.ad_network_type,
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group_ad.ad.id,
  ad_group_ad.ad.name,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM ad_group_ad
WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
ORDER BY segments.date ASC
`;

export const fetchGoogleAdsSpendRows = async (
  config: GoogleAdsImportConfig,
  options: GoogleAdsImportOptions
) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAdsAccessToken(config, fetchImpl);
  const customerId = normalizeCustomerId(config.customerId);
  const loginCustomerId = config.loginCustomerId ? normalizeCustomerId(config.loginCustomerId) : undefined;
  const requestIds: string[] = [];

  const response = await fetchImpl(
    `${googleAdsApiBaseUrl}/${googleAdsApiVersion}/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'developer-token': config.developerToken,
        ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {})
      },
      body: JSON.stringify({
        query: buildGoogleAdsSpendQuery(options.dateFrom, options.dateTo)
      })
    }
  );

  const payload = (await response.json().catch(() => [])) as
    | GoogleAdsSearchStreamResponseChunk[]
    | { error?: { message?: string } };

  if (!response.ok || !Array.isArray(payload)) {
    const message = Array.isArray(payload) ? undefined : payload.error?.message;
    throw new Error(message ?? 'Google Ads searchStream request failed.');
  }

  const rows: AdPlatformDailyMetricInput[] = [];

  payload.forEach((chunk) => {
    if (chunk.requestId) {
      requestIds.push(chunk.requestId);
    }

    (chunk.results ?? []).forEach((result) => {
      const date = result.segments?.date;
      if (!date) {
        return;
      }

      rows.push({
        platform: 'google_ads',
        accountId: customerId,
        date,
        campaignId: result.campaign?.id === undefined ? null : String(result.campaign.id),
        campaignName: result.campaign?.name ?? null,
        adGroupId: result.adGroup?.id === undefined ? null : String(result.adGroup.id),
        adGroupName: result.adGroup?.name ?? null,
        adId: result.adGroupAd?.ad?.id === undefined ? null : String(result.adGroupAd.ad.id),
        adName: result.adGroupAd?.ad?.name ?? null,
        device: result.segments?.device ?? null,
        network: result.segments?.adNetworkType ?? null,
        impressions: Math.round(toNumber(result.metrics?.impressions)),
        clicks: Math.round(toNumber(result.metrics?.clicks)),
        costMicros: toBigInt(result.metrics?.costMicros),
        conversions: toNumber(result.metrics?.conversions),
        conversionValueMicros: toMicrosFromCurrency(result.metrics?.conversionsValue)
      });
    });
  });

  return {
    rows,
    requestIds
  };
};

export const importGoogleAdsSpend = async (
  dataStore: DataStore,
  config: GoogleAdsImportConfig,
  options: GoogleAdsImportOptions
) => {
  const startedAt = new Date().toISOString();

  try {
    const { rows, requestIds } = await fetchGoogleAdsSpendRows(config, options);
    const result = await dataStore.upsertAdPlatformDailyMetrics(rows);
    const finishedAt = new Date().toISOString();
    const run = await dataStore.recordAdSpendImportRun({
      provider: 'google_ads',
      status: 'succeeded',
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      rowCount: result.rowCount,
      requestIds,
      startedAt,
      finishedAt
    });

    return {
      ...run,
      importedAt: result.importedAt
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await dataStore.recordAdSpendImportRun({
      provider: 'google_ads',
      status: 'failed',
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      rowCount: 0,
      errorMessage: error instanceof Error ? error.message : 'Google Ads import failed.',
      startedAt,
      finishedAt
    });
    throw error;
  }
};

