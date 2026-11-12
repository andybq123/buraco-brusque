import { describe, expect, it } from "vitest";
import { distanceMeters, GROUP_RADIUS_M, isInsideBrusque } from "@/lib/potholes";

describe("regras de buracos", () => {
  it("agrupa envios num raio de 20 m", () => {
    expect(GROUP_RADIUS_M).toBe(20);
    // ~15 m ao norte -> dentro; ~30 m -> fora
    expect(distanceMeters(-27.0977, -48.9175, -27.09757, -48.9175)).toBeLessThanOrEqual(GROUP_RADIUS_M);
    expect(distanceMeters(-27.0977, -48.9175, -27.0974, -48.9175)).toBeGreaterThan(GROUP_RADIUS_M);
  });
  it("aceita só locais em Brusque", () => {
    expect(isInsideBrusque(-27.0977, -48.9175)).toBe(true);
    expect(isInsideBrusque(-26.9194, -49.0661)).toBe(false); // Blumenau
  });
});
