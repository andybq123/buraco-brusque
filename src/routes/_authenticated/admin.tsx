import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Check, CheckCircle2, Construction, ExternalLink, LogOut, MapPin, RotateCcw,
  Search, ShieldCheck, Trash2, UserPlus, Users, Wrench, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LazyMap } from "@/components/LazyMap";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createAdmin, listAdmins, purgePotholes, removeAdmin, type StaffRole } from "@/lib/admin.functions";
import { formatDate, type Pothole, type PotholeStatus, hazardLabel, sizeLabel } from "@/lib/potholes";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel — De Olho na Rua" },
      { name: "description", content: "Gerencie os buracos informados em Brusque." },
      { property: "og:title", content: "Painel — De Olho na Rua" },
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
  removido: "Removido",
};
const ROLE_LABEL: Record<StaffRole, string> = { admin: "Administrador", operador: "Usuário" };

function AdminPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const role = useQuery({
    queryKey: ["staff-role", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data ?? []).map((r) => r.role as string);
      return roles.includes("admin") ? "admin" : roles.includes("operador") ? "operador" : null;
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (role.isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>;

  if (!role.data) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="text-2xl">Sem permissão</h1>
        <p className="text-muted-foreground">
          O e-mail {user.email} não tem acesso ao painel. Peça a um administrador para incluí-lo.
        </p>
        <Button variant="outline" onClick={signOut}>Sair</Button>
      </div>
    );
  }

  const isAdmin = role.data === "admin";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="safe-top sticky top-0 z-20 border-b bg-secondary text-secondary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Construction className="h-5 w-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display text-base">De Olho na Rua</div>
              <div className="text-xs text-secondary-foreground/70">Painel de gestão</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-semibold">{user.email}</div>
              <div className="text-secondary-foreground/70">{ROLE_LABEL[role.data]}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground">
              <LogOut className="mr-1 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        <Tabs defaultValue="buracos">
          <TabsList>
            <TabsTrigger value="buracos"><MapPin className="mr-1 h-4 w-4" /> Buracos</TabsTrigger>
            {isAdmin && <TabsTrigger value="usuarios"><Users className="mr-1 h-4 w-4" /> Usuários</TabsTrigger>}
          </TabsList>
          <TabsContent value="buracos" className="mt-4">
            <Potholes isAdmin={isAdmin} email={user.email ?? ""} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="usuarios" className="mt-4">
              <StaffUsers />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className={`grid h-10 w-10 place-items-center rounded-lg ${tone}`}>{icon}</span>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function Potholes({ isAdmin, email }: { isAdmin: boolean; email: string }) {
  const qc = useQueryClient();
  const purge = useServerFn(purgePotholes);
  const [filter, setFilter] = useState<PotholeStatus>("aberto");
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyDanger, setOnlyDanger] = useState(false);
  const [search, setSearch] = useState("");
  const [repairFor, setRepairFor] = useState<Pothole | null>(null);
  const [repairedBy, setRepairedBy] = useState("");
  const [purgeIds, setPurgeIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const potholes = useQuery({
    queryKey: ["potholes", "admin"],
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

  const all = potholes.data ?? [];
  const allPhotos = useMemo(() => all.flatMap((p) => p.photos), [all]);
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

  const refresh = () => qc.invalidateQueries({ queryKey: ["potholes"] });

  const update = async (id: string, patch: Partial<Pothole>, msg: string) => {
    const { error } = await supabase.from("potholes").update(patch).eq("id", id);
    if (error) return toast.error("Não foi possível atualizar."), false;
    toast.success(msg);
    refresh();
    return true;
  };

  const confirmRepair = async () => {
    if (!repairFor || !repairedBy.trim()) return;
    setBusy(true);
    const ok = await update(
      repairFor.id,
      { status: "consertado", resolved_at: new Date().toISOString(), repaired_by: repairedBy.trim().slice(0, 200), resolved_by_email: email },
      "Marcado como consertado.",
    );
    setBusy(false);
    if (ok) setRepairFor(null);
  };

  const confirmPurge = async () => {
    if (!purgeIds) return;
    setBusy(true);
    try {
      const r = await purge({ data: { ids: purgeIds } });
      toast.success(r.deleted === 1 ? "Buraco apagado definitivamente." : `${r.deleted} buracos apagados definitivamente.`);
      refresh();
      setPurgeIds(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar.");
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const list = all
    .filter((p) => p.status === filter && (!onlyDanger || p.hazards.length > 0))
    .filter((p) => !q || (p.address ?? "").toLowerCase().includes(q) || (p.repaired_by ?? "").toLowerCase().includes(q))
    .sort((a, b) => Number(b.hazards.length > 0) - Number(a.hazards.length > 0));
  const count = (s: PotholeStatus) => all.filter((p) => p.status === s).length;
  const dangerous = all.filter((p) => p.status === "aberto" && p.hazards.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Abertos" value={count("aberto")} icon={<Construction className="h-5 w-5" />} tone="bg-primary text-primary-foreground" />
        <Stat label="Perigosos" value={dangerous} icon={<AlertTriangle className="h-5 w-5" />} tone="bg-destructive text-destructive-foreground" />
        <Stat label="Consertados" value={count("consertado")} icon={<CheckCircle2 className="h-5 w-5" />} tone="bg-success text-success-foreground" />
        <Stat label="Removidos" value={count("removido")} icon={<X className="h-5 w-5" />} tone="bg-muted text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as PotholeStatus)}>
          <TabsList>
            <TabsTrigger value="aberto">Abertos</TabsTrigger>
            <TabsTrigger value="consertado">Consertados</TabsTrigger>
            <TabsTrigger value="removido">Removidos</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por endereço ou equipe" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={onlyDanger} onCheckedChange={setOnlyDanger} /> Só perigosos
        </label>
        {isAdmin && filter === "removido" && list.length > 0 && (
          <Button variant="destructive" onClick={() => setPurgeIds(list.map((p) => p.id))}>
            <Trash2 className="mr-1 h-4 w-4" /> Apagar todos ({list.length})
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_440px]">
        <div className="h-[40vh] overflow-hidden rounded-xl border bg-card lg:sticky lg:top-20 lg:h-[calc(100dvh-8rem)]">
          <LazyMap
            focus={focus}
            onSelect={(id) => {
              setSelected(id);
              document.getElementById(`b-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            points={list.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, status: p.status, danger: p.status === "aberto" && p.hazards.length > 0 }))}
          />
        </div>

        <div className="space-y-3">
          {potholes.isLoading && <p className="py-8 text-center text-muted-foreground">Carregando…</p>}
          {!potholes.isLoading && list.length === 0 && (
            <p className="rounded-xl border bg-card py-10 text-center text-muted-foreground">Nenhum buraco aqui.</p>
          )}

          {list.map((p) => (
            <article
              key={p.id}
              id={`b-${p.id}`}
              className={`space-y-3 rounded-xl border bg-card p-4 transition ${selected === p.id ? "ring-2 ring-ring" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{p.address ?? "Endereço não informado"}</div>
                  <div className="text-xs text-muted-foreground">
                    Informado em {formatDate(p.created_at)} · {p.report_count} {p.report_count === 1 ? "aviso" : "avisos"}
                  </div>
                </div>
                <Badge variant={p.status === "aberto" ? "default" : "secondary"}>{STATUS_LABEL[p.status]}</Badge>
              </div>

              {(p.size || p.hazards.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {p.size && <Badge variant="outline">{sizeLabel(p.size)}</Badge>}
                  {p.hazards.map((h) => <Badge key={h} variant="destructive">{hazardLabel(h)}</Badge>)}
                </div>
              )}

              {p.status === "consertado" && (
                <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                  <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div><span className="font-semibold">Reparo:</span> {p.repaired_by || "não informado"}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.resolved_at && <>Em {formatDate(p.resolved_at)}</>}
                      {p.resolved_by_email && <> · registrado por {p.resolved_by_email}</>}
                    </div>
                  </div>
                </div>
              )}

              {p.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {p.photos.map((ph) =>
                    photoUrls.data?.[ph] ? (
                      <a key={ph} href={photoUrls.data[ph]} target="_blank" rel="noreferrer">
                        <img src={photoUrls.data[ph]} alt="Foto do buraco" loading="lazy" className="h-24 w-32 shrink-0 rounded-lg object-cover" />
                      </a>
                    ) : (
                      <div key={ph} className="h-24 w-32 shrink-0 animate-pulse rounded-lg bg-muted" />
                    ),
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <button className="flex items-center gap-1 font-medium hover:underline" onClick={() => { setFocus([p.lat, p.lng]); setSelected(p.id); }}>
                  <MapPin className="h-4 w-4" /> Ver no mapa
                </button>
                <a className="flex items-center gap-1 text-muted-foreground hover:underline" href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Google Maps
                </a>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                {p.status === "aberto" && (
                  <>
                    <Button size="sm" className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => { setRepairedBy(""); setRepairFor(p); }}>
                      <Check className="mr-1 h-4 w-4" /> Concluir
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => update(p.id, { status: "removido", resolved_at: new Date().toISOString() }, "Removido do mapa.")}>
                      <X className="mr-1 h-4 w-4" /> Remover (falso)
                    </Button>
                  </>
                )}
                {p.status !== "aberto" && (
                  <Button size="sm" variant="outline" onClick={() => update(p.id, { status: "aberto", resolved_at: null, repaired_by: null, resolved_by_email: null }, p.status === "removido" ? "Restaurado." : "Reaberto.")}>
                    <RotateCcw className="mr-1 h-4 w-4" /> {p.status === "removido" ? "Restaurar" : "Reabrir"}
                  </Button>
                )}
                {p.status === "removido" && isAdmin && (
                  <Button size="sm" variant="destructive" onClick={() => setPurgeIds([p.id])}>
                    <Trash2 className="mr-1 h-4 w-4" /> Apagar definitivamente
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <Dialog open={!!repairFor} onOpenChange={(v) => !v && setRepairFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir reparo</DialogTitle>
            <DialogDescription>{repairFor?.address ?? "Buraco selecionado"}. Esta informação é interna e não aparece para o público.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="repaired-by">Equipe ou pessoa que fez o reparo</Label>
            <Input id="repaired-by" autoFocus maxLength={200} placeholder="Ex.: Equipe Obras Norte — João" value={repairedBy} onChange={(e) => setRepairedBy(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepairFor(null)}>Cancelar</Button>
            <Button disabled={!repairedBy.trim() || busy} onClick={confirmRepair} className="bg-success text-success-foreground hover:bg-success/90">
              <Check className="mr-1 h-4 w-4" /> Marcar como consertado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!purgeIds} onOpenChange={(v) => !v && setPurgeIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              {purgeIds?.length === 1 ? "O buraco e as fotos dele" : `${purgeIds?.length} buracos e as fotos deles`} serão apagados sem deixar registro. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); confirmPurge(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StaffUsers() {
  const qc = useQueryClient();
  const list = useServerFn(listAdmins);
  const create = useServerFn(createAdmin);
  const remove = useServerFn(removeAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("operador");
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admins"], queryFn: () => list() });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { email, password, role } });
      toast.success(`${ROLE_LABEL[role]} ${email} criado. Já pode entrar com essa senha.`);
      setEmail("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["admins"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!toRemove) return;
    try {
      await remove({ data: { email: toRemove } });
      toast.success("Acesso removido.");
      qc.invalidateQueries({ queryKey: ["admins"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover.");
    } finally {
      setToRemove(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <h2 className="text-lg">Pessoas com acesso</h2>
          <p className="text-sm text-muted-foreground">
            Administradores fazem tudo. Usuários podem concluir, remover e restaurar buracos.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="hidden sm:table-cell">Desde</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.map((r) => (
              <TableRow key={r.email}>
                <TableCell className="font-medium">{r.email}</TableCell>
                <TableCell>
                  <Badge variant={r.role === "admin" ? "default" : "outline"}>
                    {r.role === "admin" && <ShieldCheck className="mr-1 h-3 w-3" />}
                    {ROLE_LABEL[r.role]}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(r.created_at)}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => setToRemove(r.email)} aria-label="Remover acesso">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <form onSubmit={add} className="h-fit space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-lg">Novo acesso</h2>
        <div className="space-y-1">
          <Label htmlFor="nu-email">E-mail</Label>
          <Input id="nu-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nu-pass">Senha</Label>
          <Input id="nu-pass" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Perfil</Label>
          <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="operador">Usuário — concluir, remover e restaurar</SelectItem>
              <SelectItem value="admin">Administrador — acesso total</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          <UserPlus className="mr-1 h-4 w-4" /> Criar acesso
        </Button>
      </form>

      <AlertDialog open={!!toRemove} onOpenChange={(v) => !v && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>{toRemove} não poderá mais entrar no painel.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
