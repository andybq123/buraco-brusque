/** Ferramentas leves de geometria para desenhar o mapa (sem Leaflet). */
type LL = readonly [number, number];

/** Douglas-Peucker: remove pontos que quase não mudam o desenho. */
export function simplifyRing<T extends LL>(pts: readonly T[], tol: number): T[] {
  if (pts.length < 4) return [...pts];
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ay, ax] = pts[a]!, [by, bx] = pts[b]!;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [y, x] = pts[i]!;
      const d = Math.abs(dy * x - dx * y + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (idx > 0 && max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Junta pontos que caem na mesma célula de uma grade de `cell` graus. */
export function groupPoints<T extends { lat: number; lng: number }>(points: readonly T[], cell: number) {
  const cells = new Map<string, T[]>();
  for (const p of points) {
    const k = `${Math.floor(p.lat / cell)}:${Math.floor(p.lng / cell)}`;
    const arr = cells.get(k);
    if (arr) arr.push(p); else cells.set(k, [p]);
  }
  return [...cells.values()].map((items) => ({
    items,
    lat: items.reduce((s, p) => s + p.lat, 0) / items.length,
    lng: items.reduce((s, p) => s + p.lng, 0) / items.length,
  }));
}
