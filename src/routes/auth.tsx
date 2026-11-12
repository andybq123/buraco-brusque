import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Buraco Brusque" },
      { name: "description", content: "Acesso do responsável pela área ao painel do Buraco Brusque." },
      { property: "og:title", content: "Entrar — Buraco Brusque" },
      { property: "og:description", content: "Acesso do responsável pela área." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/admin" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Enviamos um e-mail de confirmação. Abra o link para ativar o acesso.");
        setMode("entrar");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      toast.error(
        m.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : m.includes("Email not confirmed")
            ? "Confirme seu e-mail antes de entrar."
            : m || "Não foi possível continuar.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-secondary text-secondary-foreground">
      <div className="hazard-stripe h-2" />
      <div className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-10">
        <Link to="/" className="flex items-center gap-1 text-sm text-secondary-foreground/70">
          <ArrowLeft className="h-4 w-4" /> Voltar ao mapa
        </Link>
        <div>
          <h1 className="text-3xl">Área do responsável</h1>
          <p className="mt-1 text-secondary-foreground/70">
            {mode === "entrar" ? "Entre para gerenciar os buracos." : "Crie seu acesso com o e-mail autorizado."}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-card p-6 text-card-foreground">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="h-12 w-full rounded-xl text-base font-bold" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "entrar" ? "Entrar" : "Criar acesso"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground underline"
            onClick={() => setMode(mode === "entrar" ? "criar" : "entrar")}
          >
            {mode === "entrar" ? "Primeiro acesso? Criar senha" : "Já tenho acesso"}
          </button>
        </form>
      </div>
    </div>
  );
}
