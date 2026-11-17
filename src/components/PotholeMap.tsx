import { MapContainer, Marker, Polygon, Popup, useMap, useMapEvents } from "react-leaflet";
import { BRUSQUE_POLYGON } from "@/lib/brusque-boundary";
import bonequinho from "@/assets/mascote.webp";
import pinoPoste from "@/assets/pino-poste.png";
import pinoBuraco from "@/assets/pino-buraco.png";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import L from "leaflet";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { Check, Layers } from "lucide-react";
import {
  hasWebGL,
  listMapLayers,
  mapboxToken,
  openFreeMapStyle,
  readMapLayer,
  writeMapLayer,
  type MapLayerId,
} from "@/lib/map-layers";

setWorkerUrl(workerUrl);

const MAPBOX_ATTR =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OFM_ATTR =
  '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Mapa base: satélite do Mapbox quando há chave; senão estilos gratuitos (OpenFreeMap / OSM). */
function BaseLayer({ layer }: { layer: MapLayerId }) {
  const map = useMap();
  useEffect(() => {
    const mbToken = mapboxToken();
    if (layer === "satelite" && mbToken) {
      // Mapbox satélite com nomes de ruas
      const tiles = L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${mbToken}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          attribution: MAPBOX_ATTR,
        },
      ).addTo(map);
      return () => {
        map.removeLayer(tiles);
      };
    }
    if (!hasWebGL()) {
      // Aparelhos antigos sem WebGL: mapa em imagens comuns
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: OSM_ATTR,
      }).addTo(map);
      return () => {
        map.removeLayer(tiles);
      };
    }
    const gl = maplibreGL({
      style: `https://tiles.openfreemap.org/styles/${openFreeMapStyle(layer)}`,
      attributionControl: false,
    } as never);
    gl.addTo(map);
    map.attributionControl?.addAttribution(OFM_ATTR);
    return () => {
      map.removeLayer(gl);
    };
  }, [map, layer]);
  return null;
}
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BRUSQUE_BOUNDS, BRUSQUE_CENTER, isInsideBrusque } from "@/lib/potholes";

const WORLD: [number, number][] = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
const MAX_BOUNDS = L.latLngBounds([BRUSQUE_BOUNDS.minLat - 0.03, BRUSQUE_BOUNDS.minLng - 0.04], [BRUSQUE_BOUNDS.maxLat + 0.03, BRUSQUE_BOUNDS.maxLng + 0.04]);

/** Escurece tudo fora de Brusque e desenha a divisa. */
function CityMask() {
  return (
    <>
      <Polygon positions={[WORLD, BRUSQUE_POLYGON]} interactive={false} pathOptions={{ stroke: false, fillColor: "#0b0b0b", fillOpacity: 0.18 }} />
      <Polygon positions={BRUSQUE_POLYGON} interactive={false} pathOptions={{ color: "#ffd60a", weight: 2.5, opacity: 0.9, dashArray: "6 6", fill: false }} />
    </>
  );
}
import { toast } from "sonner";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  status: string;
  danger?: boolean;
  kind?: string | undefined;
  protocol?: boolean;
  popup?: ReactNode;
}

function FlyTo({ target }: { target?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 17);
  }, [target, map]);
  return null;
}

const iconCache = new Map<string, L.DivIcon>();
function potholeIcon(status: string, danger = false, kind = "buraco", protocol = false) {
  const key = `${status}-${danger}-${kind}-${protocol}`;
  let ic = iconCache.get(key);
  if (!ic) {
    const protocolBadge = protocol ? '<span class="pothole-pin-protocol" title="Protocolado na Ouvidoria"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10m14 11V10M3 10h18L12 3 3 10zM9 10v11m6-11v11"/></svg></span>' : "";
    ic = L.divIcon({
      className: "",
      html: status === "consertado"
        ? `<div class="pothole-pin pothole-pin--consertado"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${protocolBadge}</div>`
        : `<div class="report-pin${kind === "iluminacao" ? " report-pin--luz" : ""}${status === "removido" ? " report-pin--removido" : ""}"><img src="${kind === "iluminacao" ? pinoPoste : pinoBuraco}" alt="${kind === "iluminacao" ? "Iluminação com problema" : "Buraco na rua"}" draggable="false" />${danger ? '<span class="pothole-pin-alert">!</span>' : ""}${protocolBadge}</div>`,
      iconSize: status === "consertado" ? [36, 36] : [40, 54],
      iconAnchor: status === "consertado" ? [18, 18] : [20, 54],
      popupAnchor: status === "consertado" ? [0, -16] : [0, -50],
    });
    iconCache.set(key, ic);
  }
  return ic;
}

const buddyIcon = () =>
  L.divIcon({
    className: "",
    html: `<div class="buddy"><div class="buddy-shadow"></div><img src="${bonequinho}" alt="Marcador" draggable="false" /></div>`,
    iconSize: [64, 94],
    iconAnchor: [32, 90],
  });

function Placer({ pos, onMove }: { pos: [number, number]; onMove: (p: [number, number]) => void }) {
  const icon = useMemo(buddyIcon, []);
  const map = useMap();
  useMapEvents({
    click: (e) => {
      if (isInsideBrusque(e.latlng.lat, e.latlng.lng)) onMove([e.latlng.lat, e.latlng.lng]);
      else toast.error("Só é possível marcar buracos dentro de Brusque.");
    },
  });
  const first = useRef(true);
  const lastOk = useRef(L.latLng(pos[0], pos[1]));
  useEffect(() => {
    if (first.current || !map.getBounds().pad(-0.2).contains(pos)) map.flyTo(pos, Math.max(map.getZoom(), 17));
    first.current = false;
  }, [pos, map]);
  return (
    <Marker
      position={pos}
      icon={icon}
      draggable
      autoPan
      zIndexOffset={1000}
      eventHandlers={{
        dragstart: (e) => {
          (e.target as L.Marker).getElement()?.classList.add("buddy-dragging");
          lastOk.current = L.latLng(pos[0], pos[1]);
        },
        drag: (e) => {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          if (isInsideBrusque(ll.lat, ll.lng)) lastOk.current = ll;
          else m.setLatLng(lastOk.current);
        },
        dragend: (e) => {
          const m = e.target as L.Marker;
          m.getElement()?.classList.remove("buddy-dragging");
          const ll = m.getLatLng();
          if (isInsideBrusque(ll.lat, ll.lng)) onMove([ll.lat, ll.lng]);
          else {
            const ok = lastOk.current;
            m.setLatLng(ok);
            onMove([ok.lat, ok.lng]);
            toast.error("Só é possível marcar buracos dentro de Brusque.");
          }
        },
      }}
    />
  );
}

/** Botão flutuante que troca a camada do mapa (satélite, ruas, claro, escuro). */
function LayerSwitcher({ layer, onChange }: { layer: MapLayerId; onChange: (id: MapLayerId) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const options = useMemo(listMapLayers, []);
  const current = options.find((o) => o.id === layer) ?? options[0];

  // Deixa o mapa ignorar toques e rolamentos que começarem no seletor.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="map-switcher">
      {open && (
        <div className="map-switcher__panel" role="menu" aria-label="Camada do mapa">
          <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground/60">
            Camada do mapa
          </p>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === layer}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                o.id === layer ? "bg-primary/20" : "hover:bg-white/10"
              }`}
            >
              <span className="h-7 w-7 shrink-0 rounded-lg border border-white/25" style={{ background: o.swatch }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold leading-tight">{o.name}</span>
                <span className="block text-[11px] leading-tight text-secondary-foreground/65">{o.hint}</span>
              </span>
              {o.id === layer && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Escolher camada do mapa"
        aria-expanded={open}
        className="map-switcher__btn"
      >
        <Layers className="h-4 w-4" />
        <span>{current?.label ?? "Mapa"}</span>
      </button>
    </div>
  );
}

export default function PotholeMap({
  points,
  focus,
  onSelect,
  placing,
  openId,
}: {
  openId?: string | null;
  points: MapPoint[];
  focus?: [number, number] | null;
  onSelect?: (id: string) => void;
  placing?: { pos: [number, number]; onMove: (p: [number, number]) => void } | null;
}) {
  const opened = useRef<string | null>(null);
  const [layer, setLayer] = useState<MapLayerId>(() => {
    const stored = readMapLayer();
    const ok = listMapLayers();
    return ok.some((o) => o.id === stored) ? stored : (ok[0]?.id ?? "ruas");
  });
  return (
    <MapContainer center={BRUSQUE_CENTER} zoom={14} className="h-full w-full" scrollWheelZoom zoomControl={false} tapTolerance={20} maxZoom={19} minZoom={12} maxBounds={MAX_BOUNDS} maxBoundsViscosity={1}>
      <BaseLayer layer={layer} />
      <CityMask />
      <FlyTo target={focus ?? null} />
      {points.map((p) => (
        <Marker
          key={p.id}
          ref={(m) => { if (m && openId === p.id && opened.current !== p.id) { opened.current = p.id; setTimeout(() => m.openPopup(), 900); } }}
          position={[p.lat, p.lng]}
          icon={potholeIcon(p.status, p.danger, p.kind, p.protocol)}
          opacity={placing ? 0.6 : 1}
          eventHandlers={onSelect ? { click: () => onSelect(p.id) } : {}}
        >
          {p.popup && !placing && <Popup>{p.popup}</Popup>}
        </Marker>
      ))}
      {placing && <Placer pos={placing.pos} onMove={placing.onMove} />}
      <LayerSwitcher
        layer={layer}
        onChange={(id) => {
          setLayer(id);
          writeMapLayer(id);
        }}
      />
    </MapContainer>
  );
}
