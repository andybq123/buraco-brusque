import { describe, expect, it } from "vitest";
import {
  MAP_LAYERS,
  defaultLayerFor,
  defaultMapLayer,
  openFreeMapStyle,
  pickLayers,
  readMapLayer,
  writeMapLayer,
} from "@/lib/map-layers";

describe("camadas do mapa", () => {
  it("só oferece satélite quando há chave do Mapbox", () => {
    const ids = (token?: string) => pickLayers({ token, webgl: true }).map((l) => l.id);
    expect(ids("pk.abc")).toContain("satelite");
    expect(ids(undefined)).not.toContain("satelite");
    expect(ids("pk.abc")).toEqual(["satelite", "ruas", "claro", "escuro"]);
  });

  it("aparelho sem WebGL recebe só o mapa simples", () => {
    expect(pickLayers({ token: "pk.abc", webgl: false }).map((l) => l.id)).toEqual(["satelite", "ruas"]);
    expect(pickLayers({ webgl: false }).map((l) => l.id)).toEqual(["ruas"]);
  });

  it("cada camada vetorial usa o estilo gratuito certo", () => {
    expect(openFreeMapStyle("ruas")).toBe("liberty");
    expect(openFreeMapStyle("claro")).toBe("positron");
    expect(openFreeMapStyle("escuro")).toBe("dark");
  });

  it("a camada padrão é satélite com chave e ruas sem chave", () => {
    expect(defaultLayerFor("pk.abc")).toBe("satelite");
    expect(defaultLayerFor(undefined)).toBe("ruas");
  });

  it("guarda a escolha do morador e ignora valor inválido", () => {
    localStorage.clear();
    writeMapLayer("claro");
    expect(readMapLayer()).toBe("claro");

    localStorage.setItem("de-olho-na-rua:map-layer", "disco-voador");
    expect(readMapLayer()).toBe(defaultMapLayer());

    localStorage.clear();
    expect(MAP_LAYERS.some((l) => l.id === readMapLayer())).toBe(true);
  });
});
