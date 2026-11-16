/**
 * Camadas de mapa disponíveis no app.
 * Módulo sem Leaflet: pode ser importado por qualquer tela com segurança.
 */
export type MapLayerId = "satelite" | "ruas" | "claro" | "escuro";

export interface MapLayerOption {
  id: MapLayerId;
  /** Nome curto, usado no botão. */
  label: string;
  /** Nome completo, usado na lista. */
  name: string;
  /** Explicação curta do que a camada mostra. */
  hint: string;
  /** Amostra de cores (CSS background). */
  swatch: string;
}

const STORE_KEY = "de-olho-na-rua:map-layer";

export function mapboxToken(): string | undefined {
  return import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as string | undefined;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export const MAP_LAYERS: MapLayerOption[] = [
  {
    id: "satelite",
    label: "Satélite",
    name: "Satélite",
    hint: "Foto de satélite com nomes de ruas",
    swatch: "linear-gradient(135deg,#2f4a2a,#8a7a52)",
  },
  {
    id: "ruas",
    label: "Ruas",
    name: "Ruas",
    hint: "Mapa colorido, tudo desenhado",
    swatch: "linear-gradient(135deg,#fbe9c8,#9fd3a0,#7fb2e5)",
  },
  {
    id: "claro",
    label: "Claro",
    name: "Claro",
    hint: "Cinza claro, só o essencial",
    swatch: "linear-gradient(135deg,#f4f4f2,#c6c6c2)",
  },
  {
    id: "escuro",
    label: "Escuro",
    name: "Escuro",
    hint: "Fundo escuro, os pinos aparecem mais",
    swatch: "linear-gradient(135deg,#26262a,#4b4b52)",
  },
];

/** Camadas que o aparelho realmente consegue mostrar. */
export function pickLayers(opts: { token?: string; webgl: boolean }): MapLayerOption[] {
  return MAP_LAYERS.filter((l) => {
    if (l.id === "satelite") return !!opts.token;
    // Sem WebGL só dá para mostrar o mapa simples em imagens.
    if (!opts.webgl) return l.id === "ruas";
    return true;
  });
}

export function listMapLayers(): MapLayerOption[] {
  return pickLayers({ token: mapboxToken(), webgl: hasWebGL() });
}

/** Estilo vetorial gratuito correspondente à camada. */
export function openFreeMapStyle(id: MapLayerId): "liberty" | "positron" | "dark" {
  return id === "claro" ? "positron" : id === "escuro" ? "dark" : "liberty";
}

export function defaultLayerFor(token?: string): MapLayerId {
  return token ? "satelite" : "ruas";
}

export function defaultMapLayer(): MapLayerId {
  return defaultLayerFor(mapboxToken());
}

/** Camada salva pelo morador, ou a padrão quando não há nada salvo. */
export function readMapLayer(): MapLayerId {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v && MAP_LAYERS.some((l) => l.id === v)) return v as MapLayerId;
  } catch {
    /* aparelho sem armazenamento: usa o padrão */
  }
  return defaultMapLayer();
}

export function writeMapLayer(id: MapLayerId): void {
  try {
    localStorage.setItem(STORE_KEY, id);
  } catch {
    /* sem armazenamento: a escolha só vale nesta tela */
  }
}
