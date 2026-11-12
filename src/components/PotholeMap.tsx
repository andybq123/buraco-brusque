import { MapContainer, CircleMarker, Popup, useMap } from "react-leaflet";
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
import { useEffect, type ReactNode } from "react";
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

function css(v: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

function colorFor(status: string) {
  if (status === "consertado") return css("--success");
  if (status === "removido") return css("--muted-foreground");
  return css("--primary");
}

export default function PotholeMap({
  points,
  focus,
  onSelect,
}: {
  points: MapPoint[];
  focus?: [number, number] | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <MapContainer center={BRUSQUE_CENTER} zoom={14} className="h-full w-full" scrollWheelZoom zoomControl={false} tapTolerance={20} maxZoom={19}>
      <BaseLayer />
      <FlyTo target={focus ?? null} />
      {points.map((p) => {
        const c = colorFor(p.status);
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.status === "aberto" ? 12 : 10}
            pathOptions={{ color: css("--secondary"), weight: 4, fillColor: c, fillOpacity: 1 }}
            eventHandlers={onSelect ? { click: () => onSelect(p.id) } : {}}
          >
            {p.popup && <Popup>{p.popup}</Popup>}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
