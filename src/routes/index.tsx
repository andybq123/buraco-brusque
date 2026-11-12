import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Construction, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LazyMap } from "@/components/LazyMap";
import { ReportSheet } from "@/components/ReportSheet";
import { listPublicPotholes } from "@/lib/potholes.functions";
import { formatDate } from "@/lib/potholes";

const potholesQuery = queryOptions({
  queryKey: ["potholes", "public"],
  queryFn: () => listPublicPotholes(),
});

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
  const { data } = useSuspenseQuery(potholesQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const abertos = data.filter((p) => p.status === "aberto").length;
  const consertados = data.length - abertos;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <LazyMap
          focus={focus}
          points={data.map((p) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            status: p.status,
            popup: (
              <div className="text-sm">
                <strong>{p.status === "consertado" ? "Consertado" : "Buraco aberto"}</strong>
                <br />
                Informado em {formatDate(p.created_at)}
                <br />
                {p.report_count} {p.report_count === 1 ? "aviso" : "avisos"}
              </div>
            ),
          }))}
        />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-secondary/95 py-2 pl-2 pr-4 text-secondary-foreground shadow-lg backdrop-blur">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <Construction className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <h1 className="text-base">Buraco Brusque</h1>
            <p className="text-xs font-semibold tracking-wider text-primary">BRUSQUE · SC</p>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-3 rounded-2xl bg-secondary/95 px-4 py-2 text-secondary-foreground shadow-lg backdrop-blur">
            <span className="font-display text-2xl leading-none">{abertos}</span>
            <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-secondary-foreground/80">
              Buracos
              <br />
              informados
            </span>
          </div>
          <Link
            to="/auth"
            aria-label="Área do responsável"
            className="grid h-11 w-11 place-items-center rounded-full bg-secondary/95 text-secondary-foreground shadow-lg backdrop-blur"
          >
            <ShieldCheck className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {consertados > 0 && (
        <div className="absolute left-3 top-20 z-10 flex items-center gap-2 rounded-full bg-secondary/90 px-3 py-1 text-xs font-semibold text-secondary-foreground sm:left-4">
          <span className="h-3 w-3 rounded-full bg-success" /> {consertados} consertados
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Button
          onClick={() => setOpen(true)}
          className="pointer-events-auto h-14 w-full max-w-md rounded-2xl border-[3px] border-secondary text-lg font-bold shadow-xl"
        >
          <Plus className="!h-6 !w-6" /> Informar buraco
        </Button>
      </div>

      <ReportSheet
        open={open}
        onOpenChange={setOpen}
        onDone={(pos) => {
          setFocus(pos);
          qc.invalidateQueries({ queryKey: ["potholes"] });
        }}
      />
    </div>
  );
}
