import { describe, expect, it } from "vitest";
import { mergeReport, distanceMeters, GROUP_RADIUS_M, isInsideBrusque } from "@/lib/potholes";

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
    expect(isInsideBrusque(-27.0858, -48.9811)).toBe(false); // Guabiruba (dentro do retângulo, fora do município)
  });
  it("ao agrupar fica o maior tamanho e somam-se os perigos", () => {
    const r = mergeReport({ size: "grande", hazards: ["moto"] }, { size: "pequeno", hazards: ["agua", "moto"] });
    expect(r.size).toBe("grande");
    expect(r.hazards).toEqual(["agua", "moto"]);
    expect(mergeReport({ size: null, hazards: [] }, { size: "medio", hazards: [] }).size).toBe("medio");
  });
});

import { buildOuvidoriaReport } from "@/lib/ouvidoria";
describe("ouvidoria", () => {
  const base = { number: 12, address: "Rua A, 10", lat: -27.1, lng: -48.9, size: null, hazards: [] as string[], report_count: 1, created_at: "2026-11-02T12:00:00Z" };
  it("assunto Buraco, finalidade Solicitação e relato padrão", () => {
    const r = buildOuvidoriaReport(base);
    expect(r.assunto).toBe("Buraco");
    expect(r.finalidade).toBe("Solicitação");
    expect(r.relato.startsWith("Munícipe solicita reparo em buraco na via.")).toBe(true);
    expect(r.prioridade).toBe("Baixa");
  });
  it("buraco com perigo vira prioridade alta e cita tamanho e riscos", () => {
    const r = buildOuvidoriaReport({ ...base, size: "grande", hazards: ["moto"], report_count: 4 });
    expect(r.prioridade).toBe("Alta");
    expect(r.relato).toContain("Tamanho: grande");
    expect(r.relato).toContain("risco para motos");
    expect(r.relato).toContain("4 moradores");
  });
});
