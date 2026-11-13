/** Prende um ponto à rua mais próxima (OSRM público). Se falhar ou a rua estiver longe, devolve o ponto original. */
export const SNAP_MAX_M = 80;

export async function snapToRoad(lat: number, lng: number, signal?: AbortSignal): Promise<[number, number]> {
  try {
    const r = await fetch(
      `https://router.project-osrm.org/nearest/v1/driving/${lng.toFixed(6)},${lat.toFixed(6)}?number=1`,
      { signal: signal ?? null },
    );
    if (!r.ok) return [lat, lng];
    const j = (await r.json()) as { code?: string; waypoints?: { location: [number, number]; distance: number }[] };
    const w = j.waypoints?.[0];
    if (j.code !== "Ok" || !w || w.distance > SNAP_MAX_M) return [lat, lng];
    return [w.location[1], w.location[0]];
  } catch {
    return [lat, lng];
  }
}
