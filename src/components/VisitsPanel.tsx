import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import type { VisitPoint } from "./VisitsMap";

const VisitsMap = lazy(() => import("./VisitsMap"));
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Stats = {
  total: number;
  today: number;
  online: number;
  cities: { city: string; region: string | null; count: number }[];
  points: VisitPoint[];
  mobile: number;
  hosts: { host: string; count: number }[];
  daily: { day: string; host: string; count: number }[];
};

export function VisitsPanel() {
  const [days, setDays] = useState("30");
  const q = useQuery({
    queryKey: ["visit-stats", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("visit_stats", { _days: Number(days) });
      if (error) throw error;
      return data as unknown as Stats;
    },
    refetchInterval: 15_000,
  });
  const s = q.data;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const byDay = new Map<string, number>();
  s?.daily.forEach((d) => byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.count));
  const dayList = [...byDay.entries()];
  const max = Math.max(1, ...dayList.map(([, c]) => c));
  const pct = (n: number) => (s && s.total ? Math.round((n / s.total) * 100) : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Acessos ao sistema</h2>
        <Tabs value={days} onValueChange={setDays}>
          <TabsList>
            <TabsTrigger value="7">7 dias</TabsTrigger>
            <TabsTrigger value="30">30 dias</TabsTrigger>
            <TabsTrigger value="90">90 dias</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {q.error && <p className="text-sm text-destructive">Não foi possível carregar os acessos.</p>}
      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Online agora</p>
              <p className="mt-1 text-2xl font-bold">{s.online}</p>
            </div>
            <Card label="Hoje" value={s.today} />
            <Card label={`Últimos ${days} dias`} value={s.total} />
            <Card label="Pelo celular" value={`${pct(s.mobile)}%`} />
            <Card label="Domínios" value={s.hosts.length} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <section className="overflow-hidden rounded-lg border bg-card">
              <h3 className="p-4 pb-2 text-sm font-semibold">De onde vêm os acessos <span className="font-normal text-muted-foreground">(verde = online agora)</span></h3>
              <div className="h-80">
                {mounted && <Suspense fallback={null}><VisitsMap points={s.points} /></Suspense>}
              </div>
            </section>
            <section className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Por cidade</h3>
              {s.cities.length === 0 && <p className="text-sm text-muted-foreground">Nenhum acesso ainda.</p>}
              <ul className="space-y-1.5 text-sm">
                {s.cities.map((c) => (
                  <li key={`${c.city}-${c.region}`} className="flex justify-between gap-2">
                    <span className="truncate">{c.city}{c.region ? <span className="text-muted-foreground"> · {c.region}</span> : null}</span>
                    <span className="font-medium">{c.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <section className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Por domínio</h3>
            {s.hosts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum acesso ainda.</p>}
            <div className="space-y-2">
              {s.hosts.map((h) => (
                <div key={h.host}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{h.host}</span><span>{h.count} · {pct(h.count)}%</span></div>
                  <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${pct(h.count)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Acessos por dia</h3>
            {dayList.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados no período.</p> : (
              <div className="flex h-40 items-end gap-1">
                {dayList.map(([day, c]) => (
                  <div key={day} className="flex flex-1 flex-col items-center gap-1" title={`${day.split("-").reverse().join("/")}: ${c}`}>
                    <span className="text-[10px] text-muted-foreground">{c}</span>
                    <div className="w-full rounded-t bg-primary" style={{ height: `${(c / max) * 100}%`, minHeight: 2 }} />
                  </div>
                ))}
              </div>
            )}
          </section>
          <p className="text-xs text-muted-foreground">Cada visita conta uma vez por aba aberta. A cidade é aproximada pela conexão; não guardamos IP nem dados pessoais.</p>
        </>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
