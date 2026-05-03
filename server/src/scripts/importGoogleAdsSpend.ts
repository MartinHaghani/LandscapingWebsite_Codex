import dotenv from 'dotenv';
import { createDataStore } from '../lib/dataStore.js';
import { importGoogleAdsSpend, loadGoogleAdsImportConfigFromEnv } from '../lib/googleAdsImport.js';
import { loadBaseStationsFromEnv } from '../lib/serviceAreaConfig.js';

dotenv.config();

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const parseArg = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const trailingDays = Number(parseArg('days') ?? '30');
const dateTo = parseArg('to') ?? toIsoDate(new Date());
const dateFrom =
  parseArg('from') ??
  (() => {
    const end = new Date(`${dateTo}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() - Math.max(1, trailingDays) + 1);
    return toIsoDate(end);
  })();

const dataStore = createDataStore(loadBaseStationsFromEnv());
await dataStore.initialize();

const result = await importGoogleAdsSpend(dataStore, loadGoogleAdsImportConfigFromEnv(), {
  dateFrom,
  dateTo
});

console.log(
  JSON.stringify(
    {
      ok: true,
      provider: result.provider,
      status: result.status,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      rowCount: result.rowCount,
      importedAt: result.importedAt
    },
    null,
    2
  )
);

