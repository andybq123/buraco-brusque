import { describe, expect, it } from "vitest";
import { groupPoints, simplifyRing } from "@/lib/simplify";
import { BRUSQUE_POLYGON } from "@/lib/brusque-boundary";

describe("mapa leve", () => {
  it("contorno de desenho tem menos pontos mas mantém início e fim", () => {
    const s = simplifyRing(BRUSQUE_POLYGON, 0.0002);
    expect(s.length).toBeLessThan(BRUSQUE_POLYGON.length);
    expect(s[0]).toEqual(BRUSQUE_POLYGON[0]);
  });
  it("agrupa pontos próximos e separa distantes", () => {
    const g = groupPoints([{ lat: -27.1001, lng: -48.9001 }, { lat: -27.1002, lng: -48.9002 }, { lat: -27.2, lng: -48.8 }], 0.01);
    expect(g.map((x) => x.items.length).sort()).toEqual([1, 2]);
  });
});
