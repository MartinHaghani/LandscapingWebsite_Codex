export type Coordinates = [number, number];
export type PolygonGeometry = {
  type: 'Polygon';
  coordinates: Coordinates[][];
};

export type MultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates: Coordinates[][][];
};

export type QuoteGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface QuoteRecord {
  id: string;
  createdAt: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  polygon: QuoteGeometry;
  metrics: {
    areaM2: number;
    perimeterM: number;
  };
  plan: string;
  quoteTotal: number;
}

export interface ContactRecord {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  message: string;
}
