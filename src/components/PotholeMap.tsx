import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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

function colorFor(status: string) {
  const css = getComputedStyle(document.documentElement);
  if (status === "consertado") return css.getPropertyValue("--success").trim();
  if (status === "removido") return css.getPropertyValue("--muted-foreground").trim();
  return css.getPropertyValue("--hole").trim();
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
    <MapContainer center={BRUSQUE_CENTER} zoom={13} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo target={focus ?? null} />
      {points.map((p) => {
        const c = colorFor(p.status);
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.status === "aberto" ? 9 : 7}
            pathOptions={{ color: "white", weight: 2, fillColor: c, fillOpacity: 0.95 }}
            eventHandlers={onSelect ? { click: () => onSelect(p.id) } : {}}
          >
            {p.popup && <Popup>{p.popup}</Popup>}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
