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
  address: string | null;
  size: PotholeSize | null;
  hazards: string[];
  repaired_by?: string | null;
  resolved_by_email?: string | null;
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

export type PotholeSize = "pequeno" | "medio" | "grande";
export const SIZES: { id: PotholeSize; label: string }[] = [
  { id: "pequeno", label: "Pequeno" },
  { id: "medio", label: "Médio" },
  { id: "grande", label: "Grande" },
];
export const HAZARDS: { id: string; label: string }[] = [
  { id: "moto", label: "Risco para motos/bicicletas" },
  { id: "pneu", label: "Fundo / pode estourar pneu" },
  { id: "noite", label: "Difícil de ver à noite" },
  { id: "agua", label: "Com água / alagado" },
];
export const sizeLabel = (s: string | null | undefined) => SIZES.find((x) => x.id === s)?.label ?? null;
export const hazardLabel = (h: string) => HAZARDS.find((x) => x.id === h)?.label ?? h;

/** Mesma regra do banco ao agrupar: fica o maior tamanho e somam-se os perigos. */
export function mergeReport(
  a: { size: PotholeSize | null; hazards: string[] },
  b: { size: PotholeSize | null; hazards: string[] },
) {
  const rank = (s: PotholeSize | null) => (s ? SIZES.findIndex((x) => x.id === s) + 1 : 0);
  return {
    size: rank(b.size) > rank(a.size) ? b.size : a.size,
    hazards: [...new Set([...a.hazards, ...b.hazards])].sort(),
  };
}
