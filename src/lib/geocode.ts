/** Endereços via OpenStreetMap (Nominatim). Só no navegador. */
const BASE = "https://nominatim.openstreetmap.org";
// Caixa de Brusque: oeste, norte, leste, sul
const VIEWBOX = "-49.10,-26.95,-48.75,-27.25";

type NomAddr = { road?: string; pedestrian?: string; house_number?: string; suburb?: string; neighbourhood?: string; city_district?: string };

function format(a: NomAddr | undefined, fallback?: string) {
  if (!a) return fallback ?? null;
  const rua = a.road ?? a.pedestrian;
  const bairro = a.suburb ?? a.neighbourhood ?? a.city_district;
  const parts = [rua ? (a.house_number ? `${rua}, ${a.house_number}` : rua) : null, bairro].filter(Boolean);
  return parts.length ? parts.join(" — ") : (fallback ?? null);
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=pt-BR&lat=${lat}&lon=${lng}`, { signal: signal ?? null });
    if (!r.ok) return null;
    const j = (await r.json()) as { address?: NomAddr; display_name?: string };
    return format(j.address, j.display_name?.split(",").slice(0, 2).join(","));
  } catch {
    return null;
  }
}

export type StreetHit = { label: string; lat: number; lng: number };

export async function searchStreet(q: string, signal?: AbortSignal): Promise<StreetHit[]> {
  const term = q.trim();
  if (term.length < 3) return [];
  try {
    const r = await fetch(
      `${BASE}/search?format=jsonv2&addressdetails=1&limit=6&bounded=1&countrycodes=br&accept-language=pt-BR&viewbox=${VIEWBOX}&q=${encodeURIComponent(term + ", Brusque")}`,
      { signal: signal ?? null },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { lat: string; lon: string; address?: NomAddr; display_name: string }[];
    return j.map((h) => ({
      label: format(h.address, h.display_name.split(",").slice(0, 2).join(",")) ?? h.display_name,
      lat: Number(h.lat),
      lng: Number(h.lon),
    }));
  } catch {
    return [];
  }
}
