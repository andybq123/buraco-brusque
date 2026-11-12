import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlacePanel } from "@/components/PlacePanel";
import { Construction, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LazyMap } from "@/components/LazyMap";
import { ReportSheet } from "@/components/ReportSheet";
import { listPublicPotholes } from "@/lib/potholes.functions";
import { formatDate, hazardLabel, sizeLabel } from "@/lib/potholes";

const potholesQuery = queryOptions({
  queryKey: ["potholes", "public"],
  queryFn: () => listPublicPotholes(),
});

/** Intervalo de atualização automática do mapa (pausa enquanto alguém marca um buraco). */
const REFRESH_MS = 20_000;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Buraco Brusque — mapa dos buracos da cidade" },
      { name: "description", content: "Veja e informe buracos nas ruas de Brusque, sem cadastro." },
      { property: "og:title", content: "Buraco Brusque" },
      { property: "og:description", content: "Veja e informe buracos nas ruas de Brusque, sem cadastro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(potholesQuery),
  component: Home,
});

function Home() {
  useSuspenseQuery(potholesQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const busy = placing || open;
  const { data = [] } = useQuery({
    ...potholesQuery,
    refetchInterval: busy ? false : REFRESH_MS,
    refetchOnWindowFocus: !busy,
    refetchIntervalInBackground: false,
  });
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const abertos = data.filter((p) => p.status === "aberto").length;
  const consertados = data.length - abertos;

  return (
    <div className="app-screen relative w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <LazyMap
          focus={focus}
          placing={(placing || open) && pos ? { pos, onMove: (p) => !open && setPos(p) } : null}
          points={data.map((p) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            status: p.status,
            danger: p.status === "aberto" && (p.hazards?.length ?? 0) > 0,
            popup: (
              <div className="text-sm">
                <strong>{p.status === "consertado" ? "Consertado" : "Buraco aberto"}</strong>
                <br />
                {p.address && (<>{p.address}<br /></>)}
                {sizeLabel(p.size) && (<>Tamanho: {sizeLabel(p.size)}<br /></>)}
                {p.hazards?.length > 0 && (<span className="font-semibold text-destructive">⚠ {p.hazards.map(hazardLabel).join(", ")}<br /></span>)}
                Informado em {formatDate(p.created_at)}
                <br />
                {p.report_count} {p.report_count === 1 ? "aviso" : "avisos"}
              </div>
            ),
          }))}
        />
      </div>

      <header className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 pb-3 sm:px-4">
        <div className="pointer-events-auto flex min-w-0 max-w-max items-center gap-2 rounded-2xl bg-secondary/95 py-2 pl-2 pr-3 sm:gap-3 sm:pr-4 text-secondary-foreground shadow-lg backdrop-blur">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10 bg-primary text-primary-foreground">
            <Construction className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-sm sm:text-base">Buraco Brusque</h1>
            <p className="truncate text-[10px] sm:text-xs font-semibold tracking-wider text-primary">BRUSQUE · SC</p>
          </div>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <div className="flex h-[52px] items-center gap-2 rounded-2xl bg-secondary/95 px-3 sm:gap-3 sm:px-4 text-secondary-foreground shadow-lg backdrop-blur">
            <span className="font-display text-2xl leading-none" aria-label={`${abertos} buracos informados`}>{abertos}</span>
            <span className="hidden text-[11px] font-semibold uppercase min-[400px]:inline leading-tight tracking-wide text-secondary-foreground/80">
              Buracos
              <br />
              informados
            </span>
          </div>
          <Link
            to="/auth"
            aria-label="Área do responsável"
            className="grid h-[52px] w-11 shrink-0 place-items-center rounded-full bg-secondary/95 text-secondary-foreground shadow-lg backdrop-blur"
          >
            <ShieldCheck className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {consertados > 0 && (
        <div className="safe-top-offset absolute left-3 z-10 flex items-center gap-2 rounded-full bg-secondary/90 px-3 py-1 text-xs font-semibold text-secondary-foreground sm:left-4">
          <span className="h-3 w-3 rounded-full bg-success" /> {consertados} consertados
        </div>
      )}

      {placing ? (
        <PlacePanel
          pos={pos}
          setPos={setPos}
          address={address}
          setAddress={setAddress}
          onCancel={() => {
            setPlacing(false);
            setPos(null);
          }}
          onConfirm={() => {
            setPlacing(false);
            setOpen(true);
          }}
        />
      ) : !open && (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4 safe-bottom">
        <Button
          onClick={() => {
            setAddress(null);
            setPos(null);
            setPlacing(true);
          }}
          className="pointer-events-auto h-16 w-full max-w-md touch-manipulation rounded-2xl border-[3px] border-secondary text-lg font-bold shadow-xl"
        >
          <Plus className="!h-6 !w-6" /> Informar buraco
        </Button>
      </div>
      )}

      <ReportSheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setPos(null);
        }}
        position={pos}
        address={address}
        onDone={(pos) => {
          setFocus(pos);
          qc.invalidateQueries({ queryKey: ["potholes"] });
        }}
      />
    </div>
  );
}
