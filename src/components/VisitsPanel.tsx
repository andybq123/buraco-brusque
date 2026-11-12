import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Stats = {
  total: number;
  today: number;
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
    refetchInterval: 60_000,
  });
  const s = q.data;
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Hoje" value={s.today} />
            <Card label={`Últimos ${days} dias`} value={s.total} />
            <Card label="Pelo celular" value={`${pct(s.mobile)}%`} />
            <Card label="Domínios" value={s.hosts.length} />
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
          <p className="text-xs text-muted-foreground">Cada visita conta uma vez por aba aberta. Não guardamos IP nem dados pessoais.</p>
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
