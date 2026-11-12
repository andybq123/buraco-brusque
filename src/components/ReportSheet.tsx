import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { distanceMeters, GROUP_RADIUS_M, HAZARDS, isInsideBrusque, SIZES, type PotholeSize } from "@/lib/potholes";
import { cn } from "@/lib/utils";
import { isAcceptedImage, preparePhoto } from "@/lib/photo";

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const LAST_KEY = "bb_last_report";
const COOLDOWN_MS = 10 * 60 * 1000;

export function ReportSheet({
  open,
  onOpenChange,
  position,
  address,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: [number, number] | null;
  address: string | null;
  onDone: (pos: [number, number]) => void;
}) {
  const geo = position ? { lat: position[0], lng: position[1] } : null;
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [size, setSize] = useState<PotholeSize | null>(null);
  const [hazards, setHazards] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPhoto(null);
      setPreview(null);
      setSize(null);
      setHazards([]);
    }
  }, [open]);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const outside = geo ? !isInsideBrusque(geo.lat, geo.lng) : false;

  const send = async () => {
    if (!geo) return;
    try {
      const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as
        | { lat: number; lng: number; t: number }
        | null;
      if (
        last &&
        Date.now() - last.t < COOLDOWN_MS &&
        distanceMeters(last.lat, last.lng, geo.lat, geo.lng) <= GROUP_RADIUS_M
      ) {
        toast.info("Você já informou este buraco há pouco. Obrigado!");
        onOpenChange(false);
        return;
      }
    } catch {
      /* ignora */
    }
    setSending(true);
    try {
      let photoName: string | null = null;
      if (photo) {
        const blob = await preparePhoto(photo);
        if (blob) {
          photoName = `${uuid()}.jpg`;
          const { error } = await supabase.storage
            .from("fotos")
            .upload(photoName, blob, { contentType: blob.type || "image/jpeg" });
          if (error) photoName = null;
        }
        if (!photoName) toast.warning("Não deu para enviar a foto, mas o buraco será registrado.");
      }
      const { data, error } = await supabase.rpc(
        "report_pothole",
        { _lat: geo.lat, _lng: geo.lng, ...(photoName ? { _photo: photoName } : {}), ...(address ? { _address: address } : {}), ...(size ? { _size: size } : {}), ...(hazards.length ? { _hazards: hazards } : {}) },
      );
      if (error) throw error;
      try { localStorage.setItem(LAST_KEY, JSON.stringify({ lat: geo.lat, lng: geo.lng, t: Date.now() })); } catch { /* modo privado */ }
      const grouped = (data as { grouped?: boolean } | null)?.grouped;
      toast.success(
        grouped
          ? "Esse buraco já estava no mapa — somamos o seu aviso. Obrigado!"
          : "Buraco informado! Obrigado por ajudar Brusque.",
      );
      onDone([geo.lat, geo.lng]);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg.includes("fora_de_brusque")
          ? "Esse local fica fora de Brusque."
          : "Não foi possível enviar agora. Tente novamente.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="safe-bottom-sheet max-h-[90dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Informar buraco</SheetTitle>
          <SheetDescription>Confira o local. Os detalhes e a foto são opcionais.</SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-4 px-4">
          <div className="flex items-start gap-3 rounded-2xl bg-muted p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">{address ?? "Ponto marcado no mapa"}</div>
              {outside && <div className="text-destructive">Esse ponto fica fora de Brusque.</div>}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Tamanho</div>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={size === s.id}
                  onClick={() => setSize(size === s.id ? null : s.id)}
                  className={cn(
                    "flex h-16 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl border-2 text-sm font-semibold",
                    size === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                  )}
                >
                  <span className="rounded-full bg-current opacity-70" style={{ width: 10 + i * 8, height: 6 + i * 3 }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Perigos</div>
            <div className="flex flex-wrap gap-2">
              {HAZARDS.map((h) => {
                const on = hazards.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setHazards(on ? hazards.filter((x) => x !== h.id) : [...hazards, h.id])}
                    className={cn(
                      "min-h-11 touch-manipulation rounded-full border-2 px-4 py-2 text-sm font-semibold",
                      on ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-background",
                    )}
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && !isAcceptedImage(f)) {
                toast.error("Envie apenas imagens (foto).");
                e.target.value = "";
                return;
              }
              setPhoto(f);
            }}
          />
          {preview ? (
            <div className="relative grid h-48 place-items-center overflow-hidden rounded-2xl bg-muted text-sm text-muted-foreground">
              <span>Foto anexada</span>
              <img
                src={preview}
                alt="Foto do buraco"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2 rounded-full"
                onClick={() => {
                  setPhoto(null);
                  setPreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                aria-label="Remover foto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="h-14 w-full rounded-2xl text-base" onClick={() => fileRef.current?.click()}>
              <Camera className="mr-2 h-5 w-5" /> Anexar foto (opcional)
            </Button>
          )}

          <Button
            className="h-16 w-full rounded-2xl text-lg font-bold shadow-pop"
            disabled={!geo || outside || sending}
            onClick={send}
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
