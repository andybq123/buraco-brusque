import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { snapToRoad } from "@/lib/snap";
import { isInsideBrusque } from "@/lib/potholes";
import { useQuery } from "@tanstack/react-query";
import { PlacePanel } from "@/components/PlacePanel";
import { Construction, Copy, Plus, Share2, ShieldCheck } from "lucide-react";
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
      { title: "De Olho na Rua — mapa dos buracos da cidade" },
      { name: "description", content: "Veja e informe buracos nas ruas de Brusque, sem cadastro." },
      { property: "og:title", content: "De Olho na Rua" },
      { property: "og:description", content: "Veja e informe buracos nas ruas de Brusque, sem cadastro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { b?: number } => {
    const n = Number(s["b"]);
    return Number.isInteger(n) && n > 0 ? { b: n } : {};
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(potholesQuery),
  component: Home,
});

function potholeLink(n: number) {
  return `${window.location.origin}/?b=${n}`;
}

async function copyLink(n: number) {
  const url = potholeLink(n);
  try {
    await navigator.clipboard.writeText(url);
    toast.success(`Link do buraco nº ${n} copiado.`);
  } catch {
    window.prompt("Copie o link:", url);
  }
}

async function shareLink(n: number, address: string | null) {
  const url = potholeLink(n);
  const text = `Buraco nº ${n}${address ? ` — ${address}` : ""} no De Olho na Rua`;
  if (navigator.share) {
    try { await navigator.share({ title: "De Olho na Rua", text, url }); } catch { /* cancelado */ }
  } else {
    copyLink(n);
  }
}

function Home() {
  useSuspenseQuery(potholesQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const busy = placing || open;
  const seq = useRef(0);
  /** Coloca o bonequinho e depois o prende na rua mais próxima. */
  const placeAt = useCallback((p: [number, number]) => {
    const n = ++seq.current;
    setPos(p);
    snapToRoad(p[0], p[1]).then((s) => {
      if (n === seq.current && isInsideBrusque(s[0], s[1])) setPos(s);
    });
  }, []);
  const { data = [] } = useQuery({
    ...potholesQuery,
    refetchInterval: busy ? false : REFRESH_MS,
    refetchOnWindowFocus: !busy,
    refetchIntervalInBackground: false,
  });
  const { b } = Route.useSearch();
  const linked = b ? data.find((p) => p.number === b) : undefined;
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const linkedFocus = useRef(false);
  useEffect(() => {
    if (linked && !linkedFocus.current) { linkedFocus.current = true; setFocus([linked.lat, linked.lng]); }
    else if (b && data.length && !linked && !linkedFocus.current) { linkedFocus.current = true; toast.error(`Buraco nº ${b} não encontrado.`); }
  }, [linked, b, data.length]);
  const abertos = data.filter((p) => p.status === "aberto").length;
  const consertados = data.length - abertos;

  return (
    <div className="app-screen relative w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <LazyMap
          focus={focus}
          openId={linked?.id ?? null}
          placing={(placing || open) && pos ? { pos, onMove: (p) => { if (!open) { setFollow(false); placeAt(p); } } } : null}
          points={data.map((p) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            status: p.status,
            danger: p.status === "aberto" && (p.hazards?.length ?? 0) > 0,
            popup: (
              <div className="text-sm">
                <strong>{p.status === "consertado" ? "Consertado" : "Buraco aberto"} · nº {p.number}</strong>
                <br />
                {p.address && (<>{p.address}<br /></>)}
                {sizeLabel(p.size) && (<>Tamanho: {sizeLabel(p.size)}<br /></>)}
                {p.hazards?.length > 0 && (<span className="font-semibold text-destructive">⚠ {p.hazards.map(hazardLabel).join(", ")}<br /></span>)}
                Informado em {formatDate(p.created_at)}
                <br />
                {p.report_count} {p.report_count === 1 ? "aviso" : "avisos"}
                {p.ouvidoria_protocol && (<><br /><span className="font-semibold">Pedido registrado na Prefeitura · protocolo {p.ouvidoria_protocol}{p.ouvidoria_sent_at ? ` · ${new Date(p.ouvidoria_sent_at).toLocaleDateString("pt-BR")}` : ""}</span></>)}
                <div className="mt-2 flex gap-1.5">
                  <button type="button" onClick={() => copyLink(p.number)} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold"><Copy className="h-3.5 w-3.5" /> Copiar link</button>
                  <button type="button" onClick={() => shareLink(p.number, p.address)} className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"><Share2 className="h-3.5 w-3.5" /> Compartilhar</button>
                </div>
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
            <h1 className="truncate text-sm sm:text-base">De Olho na Rua</h1>
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
          setPos={placeAt}
          follow={follow}
          setFollow={setFollow}
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
            setFollow(true);
            setPlacing(true);
            window.__lovableEvents?.track?.("project.report_started", {});
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
