import { MapContainer, Marker, Polygon, Popup, useMap, useMapEvents } from "react-leaflet";
import { BRUSQUE_POLYGON } from "@/lib/brusque-boundary";
import bonequinho from "@/assets/mascote.webp";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import L from "leaflet";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";

setWorkerUrl(workerUrl);

/** Mapa base vetorial gratuito (OpenFreeMap, estilo "liberty"). */
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function BaseLayer() {
  const map = useMap();
  useEffect(() => {
    const mbToken = import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as string | undefined;
    if (mbToken) {
      // Mapbox satélite com nomes de ruas
      const tiles = L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${mbToken}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          attribution:
            '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      return () => {
        map.removeLayer(tiles);
      };
    }
    const layer = maplibreGL({
      style: "https://tiles.openfreemap.org/styles/liberty",
      attributionControl: false,
    } as never);
    layer.addTo(map);
    map.attributionControl?.addAttribution(
      '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    );
    return () => {
      map.removeLayer(layer);
    };
  }, [map]);
  return null;
}
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { BRUSQUE_BOUNDS, BRUSQUE_CENTER, isInsideBrusque } from "@/lib/potholes";

const WORLD: [number, number][] = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
const MAX_BOUNDS = L.latLngBounds([BRUSQUE_BOUNDS.minLat - 0.03, BRUSQUE_BOUNDS.minLng - 0.04], [BRUSQUE_BOUNDS.maxLat + 0.03, BRUSQUE_BOUNDS.maxLng + 0.04]);

/** Escurece tudo fora de Brusque e desenha a divisa. */
function CityMask() {
  return (
    <>
      <Polygon positions={[WORLD, BRUSQUE_POLYGON]} interactive={false} pathOptions={{ stroke: false, fillColor: "#0b0b0b", fillOpacity: 0.72 }} />
      <Polygon positions={BRUSQUE_POLYGON} interactive={false} pathOptions={{ color: "#ffd60a", weight: 3, dashArray: "8 6", fill: false }} />
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
function potholeIcon(status: string, danger = false) {
  const key = `${status}-${danger}`;
  let ic = iconCache.get(key);
  if (!ic) {
    ic = L.divIcon({
      className: "",
      html: status === "consertado"
        ? `<div class="pothole-pin pothole-pin--consertado"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>`
        : `<div class="pothole-pin pothole-pin--${status}${danger ? " pothole-pin--perigo" : ""}"><img src="/favicon.png" alt="" />${danger ? '<span class="pothole-pin-alert">!</span>' : ""}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -16],
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
  return (
    <MapContainer center={BRUSQUE_CENTER} zoom={14} className="h-full w-full" scrollWheelZoom zoomControl={false} tapTolerance={20} maxZoom={19} minZoom={12} maxBounds={MAX_BOUNDS} maxBoundsViscosity={1}>
      <BaseLayer />
      <CityMask />
      <FlyTo target={focus ?? null} />
      {points.map((p) => (
        <Marker
          key={p.id}
          ref={(m) => { if (m && openId === p.id && opened.current !== p.id) { opened.current = p.id; setTimeout(() => m.openPopup(), 900); } }}
          position={[p.lat, p.lng]}
          icon={potholeIcon(p.status, p.danger)}
          opacity={placing ? 0.6 : 1}
          eventHandlers={onSelect ? { click: () => onSelect(p.id) } : {}}
        >
          {p.popup && !placing && <Popup>{p.popup}</Popup>}
        </Marker>
      ))}
      {placing && <Placer pos={placing.pos} onMove={placing.onMove} />}
    </MapContainer>
  );
}
