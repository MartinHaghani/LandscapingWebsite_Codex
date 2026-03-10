import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const baseStationSchema = z.object({
  label: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(320),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  active: z.boolean().optional()
});

const baseStationListSchema = z.array(baseStationSchema).max(200);

const demoStations = [
  {
    label: 'internal-l6a1m7-station',
    address: 'L6A1M7',
    lat: 43.844147,
    lng: -79.51962,
    active: true
  }
];

export type BaseStationConfig = z.infer<typeof baseStationSchema>;

const parseStationPayload = (raw: string) => {
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return baseStationListSchema.parse(parsed);
  }

  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { stations?: unknown }).stations)) {
    return baseStationListSchema.parse((parsed as { stations: unknown }).stations);
  }

  throw new Error('Station config must be an array or an object with a "stations" array.');
};

const readStationConfigRaw = (env: NodeJS.ProcessEnv) => {
  const configPath = env.AUTOSCAPE_BASE_STATIONS_FILE?.trim();
  if (configPath) {
    const absolute = path.resolve(configPath);
    return fs.readFileSync(absolute, 'utf8');
  }

  return env.AUTOSCAPE_BASE_STATIONS_JSON ?? '';
};

export const loadBaseStationsFromEnv = (env: NodeJS.ProcessEnv = process.env): BaseStationConfig[] => {
  const raw = readStationConfigRaw(env).trim();

  if (!raw) {
    return env.NODE_ENV === 'production' ? [] : [...demoStations];
  }

  const stations = parseStationPayload(raw);
  return stations.filter((station) => station.active !== false);
};

export const loadServedRegionsFromEnv = (env: NodeJS.ProcessEnv = process.env) => {
  const rawRegions = env.SERVICE_AREA_REGIONS?.trim();
  if (!rawRegions) {
    return ['Vaughan, Ontario'];
  }

  const regions = rawRegions
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return regions.length > 0 ? regions : ['Vaughan, Ontario'];
};
