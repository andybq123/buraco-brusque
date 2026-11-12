import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Construction, ShieldCheck } from "lucide-react";
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
    <div className="flex h-[100dvh] flex-col bg-background">
      <div className="hazard-stripe h-2" />
      <header className="flex items-center justify-between gap-3 bg-secondary px-4 py-3 text-secondary-foreground">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
          <h1 className="text-xl leading-none">Buraco Brusque</h1>
        </div>
        <Link to="/auth" className="text-secondary-foreground/70" aria-label="Área do responsável">
          <ShieldCheck className="h-5 w-5" />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-2 bg-secondary px-4 pb-3">
        <div className="rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
          <div className="font-display text-3xl leading-tight">{abertos}</div>
          <div className="text-sm font-semibold">buracos abertos</div>
        </div>
        <div className="rounded-2xl bg-success px-4 py-2 text-success-foreground">
          <div className="font-display text-3xl leading-tight">{consertados}</div>
          <div className="text-sm font-semibold">consertados</div>
        </div>
      </div>

      <main className="relative flex-1">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            onClick={() => setOpen(true)}
            className="pointer-events-auto h-20 w-full rounded-3xl text-xl font-bold shadow-pop"
          >
            <Construction className="mr-2 !h-7 !w-7" /> Informar buraco
          </Button>
        </div>
      </main>

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
