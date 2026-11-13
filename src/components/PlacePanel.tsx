import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Navigation, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRUSQUE_CENTER, distanceMeters, isInsideBrusque } from "@/lib/potholes";
import { reverseGeocode, searchStreet, type StreetHit } from "@/lib/geocode";

/** Painel de marcação: GPS → endereço; sem GPS, busca pela rua ou arrasta o bonequinho. */
export function PlacePanel({
  pos,
  setPos,
  follow,
  setFollow,
  address,
  setAddress,
  onCancel,
  onConfirm,
}: {
  pos: [number, number] | null;
  setPos: (p: [number, number]) => void;
  follow: boolean;
  setFollow: (v: boolean) => void;
  address: string | null;
  setAddress: (a: string | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StreetHit[]>([]);
  const [searching, setSearching] = useState(false);
  const typedRef = useRef(false);

  const lastFix = useRef<[number, number] | null>(null);
  const followRef = useRef(follow);
  followRef.current = follow;

  // Seguir a pessoa enquanto ela anda (até ela arrastar o bonequinho)
  useEffect(() => {
    if (!follow || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!followRef.current) return;
        const ll: [number, number] = [p.coords.latitude, p.coords.longitude];
        if (!isInsideBrusque(ll[0], ll[1])) return;
        if (p.coords.accuracy > 60) return;
        const last = lastFix.current;
        if (last && distanceMeters(last[0], last[1], ll[0], ll[1]) < 8) return;
        lastFix.current = ll;
        setPos(ll);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [follow, setPos]);

  const locate = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Seu aparelho não informa a localização.");
      setShowSearch(true);
      if (!pos) setPos(BRUSQUE_CENTER);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const ll: [number, number] = [p.coords.latitude, p.coords.longitude];
        if (!isInsideBrusque(ll[0], ll[1])) {
          setGeoError("Sua localização parece fora de Brusque. Procure a rua ou arraste o bonequinho.");
          setShowSearch(true);
          if (!pos) setPos(BRUSQUE_CENTER);
          return;
        }
        lastFix.current = ll;
        setPos(ll);
        setFollow(true);
      },
      (e) => {
        setLocating(false);
        setGeoError(
          e.code === 1
            ? "Sem permissão de localização. Digite a rua ou arraste o bonequinho."
            : "Não encontramos sua localização. Digite a rua ou arraste o bonequinho.",
        );
        setShowSearch(true);
        if (!pos) setPos(BRUSQUE_CENTER);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  };

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // endereço do ponto atual
  useEffect(() => {
    if (!pos) return;
    if (typedRef.current) {
      typedRef.current = false;
      return;
    }
    const ac = new AbortController();
    setLooking(true);
    const t = setTimeout(async () => {
      const a = await reverseGeocode(pos[0], pos[1], ac.signal);
      if (!ac.signal.aborted) {
        setAddress(a);
        setLooking(false);
      }
    }, 600);
    return () => {
      ac.abort();
      clearTimeout(t);
    };
  }, [pos, setAddress]);

  // busca por rua
  useEffect(() => {
    if (q.trim().length < 3) {
      setHits([]);
      return;
    }
    const ac = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchStreet(q, ac.signal);
      if (!ac.signal.aborted) {
        setHits(r);
        setSearching(false);
      }
    }, 700);
    return () => {
      ac.abort();
      clearTimeout(t);
    };
  }, [q]);

  const outside = pos ? !isInsideBrusque(pos[0], pos[1]) : false;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 safe-bottom">
      <div className="w-full max-w-md space-y-3 rounded-3xl bg-card p-4 text-card-foreground shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">Arraste o bonequinho até o buraco — ele se prende na rua.</p>
          <button aria-label="Cancelar" onClick={onCancel} className="-m-1 rounded-full p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-muted p-3 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            {locating ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Pegando sua localização…</span>
            ) : looking ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Buscando endereço…</span>
            ) : (
              <span className="font-semibold">{address ?? "Endereço não encontrado — o ponto no mapa vale."}</span>
            )}
            {geoError && <div className="mt-1 text-destructive">{geoError}</div>}
            {outside && <div className="mt-1 text-destructive">Esse ponto fica fora de Brusque.</div>}
          </div>
        </div>

        {follow && !locating && !geoError && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-primary/15 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 font-semibold"><Navigation className="h-4 w-4" /> Seguindo você enquanto anda</span>
            <button className="text-xs font-semibold underline" onClick={() => setFollow(false)}>Parar</button>
          </div>
        )}

        {showSearch ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome da rua (ex.: Rua Azambuja)"
              className="h-12 rounded-2xl pl-9"
              enterKeyHint="search"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />}
            {hits.length > 0 && (
              <ul className="absolute inset-x-0 bottom-full mb-2 max-h-56 overflow-y-auto rounded-2xl border bg-popover p-1 text-popover-foreground shadow-lg">
                {hits.map((h) => (
                  <li key={`${h.lat},${h.lng}`}>
                    <button
                      className="w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        typedRef.current = true;
                        setAddress(h.label);
                        setFollow(false);
                        setPos([h.lat, h.lng]);
                        setHits([]);
                        setQ("");
                      }}
                    >
                      {h.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={locate} disabled={locating}>
              <Crosshair className="mr-1 h-4 w-4" /> Minha localização
            </Button>
            <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={() => setShowSearch(true)}>
              <Search className="mr-1 h-4 w-4" /> Digitar rua
            </Button>
          </div>
        )}

        <Button className="h-14 w-full rounded-2xl text-lg font-bold" disabled={!pos || outside || locating} onClick={onConfirm}>
          Confirmar local
        </Button>
      </div>
    </div>
  );
}
