export type Coordinates = [number, number];

export interface QuoteRecord {
  id: string;
  createdAt: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  polygon: {
    type: 'Polygon';
    coordinates: Coordinates[][];
  };
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
