import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { MapPoint } from "./PotholeMap";

const PotholeMap = lazy(() => import("./PotholeMap"));

export function LazyMap(props: {
  points: MapPoint[];
  openId?: string | null;
  focus?: [number, number] | null;
  onSelect?: (id: string) => void;
  placing?: { pos: [number, number]; onMove: (p: [number, number]) => void } | null;
}) {
  const fallback = <div className="h-full w-full animate-pulse bg-muted" />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <PotholeMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
export type { MapPoint };
