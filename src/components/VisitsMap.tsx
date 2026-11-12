import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BRUSQUE_CENTER } from "@/lib/potholes";

export type VisitPoint = { lat: number; lng: number; city: string | null; count: number; live: boolean };

export default function VisitsMap({ points }: { points: VisitPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <MapContainer center={BRUSQUE_CENTER} zoom={6} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      {points.map((p) => (
        <CircleMarker
          key={`${p.lat},${p.lng}`}
          center={[p.lat, p.lng]}
          radius={6 + Math.sqrt(p.count / max) * 16}
          pathOptions={{ color: p.live ? "#16a34a" : "#b45309", fillColor: p.live ? "#22c55e" : "#facc15", fillOpacity: 0.7, weight: 2 }}
        >
          <Tooltip>{`${p.city ?? "Local aproximado"}: ${p.count} acesso${p.count > 1 ? "s" : ""}${p.live ? " · online agora" : ""}`}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
