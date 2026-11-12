export type PotholeStatus = "aberto" | "consertado" | "removido";

export interface Pothole {
  id: string;
  lat: number;
  lng: number;
  status: PotholeStatus;
  report_count: number;
  photos: string[];
  created_at: string;
  last_reported_at: string;
  resolved_at: string | null;
}

export const BRUSQUE_CENTER: [number, number] = [-27.0977, -48.9175];

/** Limites aproximados do município de Brusque (mesmos usados no banco). */
export const BRUSQUE_BOUNDS = { minLat: -27.25, maxLat: -26.95, minLng: -49.1, maxLng: -48.75 };

export function isInsideBrusque(lat: number, lng: number) {
  return (
    lat >= BRUSQUE_BOUNDS.minLat &&
    lat <= BRUSQUE_BOUNDS.maxLat &&
    lng >= BRUSQUE_BOUNDS.minLng &&
    lng <= BRUSQUE_BOUNDS.maxLng
  );
}

/** Raio (metros) em que um novo envio é agrupado a um buraco aberto existente. */
export const GROUP_RADIUS_M = 20;

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
