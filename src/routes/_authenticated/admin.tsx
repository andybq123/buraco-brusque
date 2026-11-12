import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, LogOut, MapPin, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LazyMap } from "@/components/LazyMap";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createAdmin, listAdmins, removeAdmin } from "@/lib/admin.functions";
import { formatDate, type Pothole, type PotholeStatus, hazardLabel, sizeLabel } from "@/lib/potholes";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel — Buraco Brusque" },
      { name: "description", content: "Gerencie os buracos informados em Brusque." },
      { property: "og:title", content: "Painel — Buraco Brusque" },
      { property: "og:description", content: "Gerencie os buracos informados em Brusque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const STATUS_LABEL: Record<PotholeStatus, string> = {
  aberto: "Aberto",
  consertado: "Consertado",
  removido: "Removido (falso)",
};

function AdminPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<PotholeStatus>("aberto");
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyDanger, setOnlyDanger] = useState(false);

  const role = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
  });

  const potholes = useQuery({
    queryKey: ["potholes", "admin"],
    enabled: role.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("potholes")
        .select("*")
        .order("last_reported_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as Pothole[];
    },
  });

  const allPhotos = useMemo(() => (potholes.data ?? []).flatMap((p) => p.photos), [potholes.data]);
  const photoUrls = useQuery({
    queryKey: ["photo-urls", allPhotos.join(",")],
    enabled: allPhotos.length > 0,
    queryFn: async () => {
      const { data } = await supabase.storage.from("fotos").createSignedUrls(allPhotos, 3600);
      const map: Record<string, string> = {};
      data?.forEach((d) => d.path && d.signedUrl && (map[d.path] = d.signedUrl));
      return map;
    },
  });

  const setStatus = async (id: string, status: PotholeStatus) => {
    const { error } = await supabase
      .from("potholes")
      .update({ status, resolved_at: status === "aberto" ? null : new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar.");
      return;
    }
    toast.success(status === "consertado" ? "Marcado como consertado." : status === "removido" ? "Removido do mapa." : "Reaberto.");
    qc.invalidateQueries({ queryKey: ["potholes"] });
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (role.isLoading) return <div className="p-8">Carregando…</div>;

  if (!role.data) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="text-2xl">Sem permissão</h1>
        <p className="text-muted-foreground">
          O e-mail {user.email} ainda não foi autorizado como responsável. Peça a um administrador para
          incluí-lo.
        </p>
        <Button variant="outline" onClick={signOut}>Sair</Button>
      </div>
    );
  }

  const list = (potholes.data ?? [])
    .filter((p) => p.status === filter && (!onlyDanger || p.hazards.length > 0))
    .sort((a, b) => Number(b.hazards.length > 0) - Number(a.hazards.length > 0));
  const counts = (s: PotholeStatus) => (potholes.data ?? []).filter((p) => p.status === s).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="hazard-stripe h-2" />
      <header className="safe-top flex items-center justify-between bg-secondary px-4 pb-3 text-secondary-foreground">
        <h1 className="text-xl">Painel · Buraco Brusque</h1>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground">
          <LogOut className="mr-1 h-4 w-4" /> Sair
        </Button>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_420px]">
        <div className="h-[45vh] overflow-hidden rounded-3xl border lg:sticky lg:top-4 lg:h-[calc(100dvh-7rem)]">
          <LazyMap
            focus={focus}
            onSelect={(id) => {
              setSelected(id);
              document.getElementById(`b-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            points={list.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, status: p.status, danger: p.status === "aberto" && p.hazards.length > 0 }))}
          />
        </div>

        <div className="space-y-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as PotholeStatus)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="aberto">Abertos ({counts("aberto")})</TabsTrigger>
              <TabsTrigger value="consertado">Consertados ({counts("consertado")})</TabsTrigger>
              <TabsTrigger value="removido">Removidos ({counts("removido")})</TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-destructive" checked={onlyDanger} onChange={(e) => setOnlyDanger(e.target.checked)} />
            Só perigosos
          </label>

          {list.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum buraco aqui.</p>}

          {list.map((p) => (
            <article
              key={p.id}
              id={`b-${p.id}`}
              className={`space-y-3 rounded-3xl border bg-card p-4 ${selected === p.id ? "ring-2 ring-ring" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {p.address && <div className="font-semibold">{p.address}</div>}
                  <div className={p.address ? "text-sm" : "font-semibold"}>Informado em {formatDate(p.created_at)}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.report_count} {p.report_count === 1 ? "aviso" : "avisos"} · último em {formatDate(p.last_reported_at)}
                  </div>
                  {(p.size || p.hazards.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.size && <Badge variant="outline">{sizeLabel(p.size)}</Badge>}
                      {p.hazards.map((h) => <Badge key={h} variant="destructive">{hazardLabel(h)}</Badge>)}
                    </div>
                  )}
                </div>
                <Badge variant={p.status === "aberto" ? "default" : "secondary"}>{STATUS_LABEL[p.status]}</Badge>
              </div>

              {p.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {p.photos.map((ph) =>
                    photoUrls.data?.[ph] ? (
                      <a key={ph} href={photoUrls.data[ph]} target="_blank" rel="noreferrer">
                        <img src={photoUrls.data[ph]} alt="Foto do buraco" loading="lazy" className="h-28 w-36 shrink-0 rounded-xl object-cover" />
                      </a>
                    ) : (
                      <div key={ph} className="h-28 w-36 shrink-0 animate-pulse rounded-xl bg-muted" />
                    ),
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button className="flex items-center gap-1 underline" onClick={() => { setFocus([p.lat, p.lng]); setSelected(p.id); }}>
                  <MapPin className="h-4 w-4" /> Ver no mapa
                </button>
                <a className="underline text-muted-foreground" href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                  Abrir no Google Maps
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                {p.status === "aberto" ? (
                  <>
                    <Button className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => setStatus(p.id, "consertado")}>
                      <Check className="mr-1 h-4 w-4" /> Marcar como consertado
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setStatus(p.id, "removido")}>
                      <X className="mr-1 h-4 w-4" /> Remover (falso)
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setStatus(p.id, "aberto")}>Reabrir</Button>
                )}
              </div>
            </article>
          ))}

          <AdminEmails />
        </div>
      </div>
    </div>
  );
}

function AdminEmails() {
  const qc = useQueryClient();
  const list = useServerFn(listAdmins);
  const create = useServerFn(createAdmin);
  const remove = useServerFn(removeAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["admins"], queryFn: () => list() });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { email, password } });
      toast.success(`Usuário ${email} criado. Ele já pode entrar com essa senha.`);
      setEmail("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["admins"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  };
  const del = async (em: string) => {
    if (!confirm(`Remover o usuário ${em}?`)) return;
    try {
      await remove({ data: { email: em } });
      qc.invalidateQueries({ queryKey: ["admins"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover.");
    }
  };
  return (
    <section className="space-y-3 rounded-3xl border bg-muted p-4">
      <h2 className="text-lg">Usuários do painel</h2>
      <ul className="space-y-1">
        {q.data?.map((r) => (
          <li key={r.email} className="flex items-center justify-between text-sm">
            {r.email}
            <Button size="icon" variant="ghost" onClick={() => del(r.email)} aria-label="Remover">
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-2">
        <Input type="email" required placeholder="E-mail do novo usuário" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required minLength={8} placeholder="Senha (mínimo 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>
          <UserPlus className="mr-1 h-4 w-4" /> Criar usuário
        </Button>
      </form>
    </section>
  );
}
