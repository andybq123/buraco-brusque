import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { distanceMeters, GROUP_RADIUS_M, isInsideBrusque } from "@/lib/potholes";

type Geo = { lat: number; lng: number; accuracy: number };
function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const LAST_KEY = "bb_last_report";
const COOLDOWN_MS = 10 * 60 * 1000;

/** Reduz a foto; se o aparelho não conseguir (ex.: HEIC em alguns Android), devolve null. */
async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* tenta pelo <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("foto"))), "image/jpeg", 0.8),
  );
}

export function ReportSheet({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: (pos: [number, number]) => void;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const locate = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Seu aparelho não permite pegar a localização.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      (e) => {
        setLocating(false);
        setGeoError(
          e.code === 1
            ? "Permita o acesso à localização para informar o buraco."
            : "Não conseguimos pegar sua localização. Tente de novo ao ar livre.",
        );
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 10000 },
    );
  };

  useEffect(() => {
    if (open) {
      setGeo(null);
      setPhoto(null);
      setPreview(null);
      locate();
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
        let blob: Blob | null = null;
        try {
          blob = await compressImage(photo);
        } catch {
          // aparelho não conseguiu reduzir: envia original se for JPG/PNG/WEBP e até 8 MB
          if (/^image\/(jpeg|png|webp)$/.test(photo.type) && photo.size <= 8 * 1024 * 1024) blob = photo;
        }
        if (blob) {
          const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
          photoName = `${uuid()}.${ext}`;
          const { error } = await supabase.storage
            .from("fotos")
            .upload(photoName, blob, { contentType: blob.type || "image/jpeg" });
          if (error) photoName = null;
        }
      }
      const { data, error } = await supabase.rpc(
        "report_pothole",
        photoName ? { _lat: geo.lat, _lng: geo.lng, _photo: photoName } : { _lat: geo.lat, _lng: geo.lng },
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
          <SheetDescription>Fique perto do buraco. A foto é opcional.</SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-4 px-4">
          <div className="flex items-start gap-3 rounded-2xl bg-muted p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              {locating && (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pegando sua localização…
                </span>
              )}
              {!locating && geo && !outside && (
                <span>
                  Localização encontrada <span className="text-muted-foreground">(precisão de ~{Math.round(geo.accuracy)} m)</span>
                </span>
              )}
              {!locating && outside && (
                <span className="text-destructive">Você parece estar fora de Brusque.</span>
              )}
              {!locating && geoError && <span className="text-destructive">{geoError}</span>}
              {!locating && (geoError || outside) && (
                <button className="ml-2 font-semibold underline" onClick={locate}>
                  Tentar de novo
                </button>
              )}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img src={preview} alt="Foto do buraco" className="h-48 w-full object-cover" />
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
            disabled={!geo || outside || sending || locating}
            onClick={send}
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
