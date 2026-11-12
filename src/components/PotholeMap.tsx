import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
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
import { BRUSQUE_CENTER } from "@/lib/potholes";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  status: string;
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
function potholeIcon(status: string) {
  let ic = iconCache.get(status);
  if (!ic) {
    ic = L.divIcon({
      className: "",
      html: status === "consertado"
        ? `<div class="pothole-pin pothole-pin--consertado"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>`
        : `<div class="pothole-pin pothole-pin--${status}"><img src="/favicon.png" alt="" /></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -16],
    });
    iconCache.set(status, ic);
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
  useMapEvents({ click: (e) => onMove([e.latlng.lat, e.latlng.lng]) });
  const first = useRef(true);
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
        dragstart: (e) => (e.target as L.Marker).getElement()?.classList.add("buddy-dragging"),
        dragend: (e) => {
          const m = e.target as L.Marker;
          m.getElement()?.classList.remove("buddy-dragging");
          const ll = m.getLatLng();
          onMove([ll.lat, ll.lng]);
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
}: {
  points: MapPoint[];
  focus?: [number, number] | null;
  onSelect?: (id: string) => void;
  placing?: { pos: [number, number]; onMove: (p: [number, number]) => void } | null;
}) {
  return (
    <MapContainer center={BRUSQUE_CENTER} zoom={14} className="h-full w-full" scrollWheelZoom zoomControl={false} tapTolerance={20} maxZoom={19}>
      <BaseLayer />
      <FlyTo target={focus ?? null} />
      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={potholeIcon(p.status)}
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
