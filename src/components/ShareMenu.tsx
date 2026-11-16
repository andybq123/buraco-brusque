import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";

type Props = {
  number: number;
  address: string | null;
  kind: string;
};

/** Tipo do aviso em palavras, para a mensagem compartilhada. */
function kindLabel(kind: string) {
  return kind === "iluminacao" ? "Iluminação pública" : "Buraco";
}

/** Artigo que acompanha o tipo: "do buraco", "da iluminação". */
function kindArticle(kind: string) {
  return kind === "iluminacao" ? "da" : "do";
}

/**
 * Botão "Compartilhar" que abre atalhos: copiar link, WhatsApp, e-mail e
 * as opções nativas do aparelho (quando existirem).
 */
export function ShareMenu({ number, address, kind }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Fecha o menu ao tocar fora dele.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const url = `${window.location.origin}/?b=${number}`;
  const label = kindLabel(kind);
  const text = `${label} nº ${number}${address ? ` — ${address}` : ""} no De Olho na Rua`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Link ${kindArticle(kind)} ${label.toLowerCase()} nº ${number} copiado.`);
    } catch {
      window.prompt("Copie o link:", url);
    }
    setOpen(false);
  }

  async function native() {
    try {
      await navigator.share({ title: "De Olho na Rua", text, url });
    } catch {
      /* pessoa cancelou */
    }
    setOpen(false);
  }

  const item =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold hover:bg-accent";

  return (
    <div ref={box} className="relative mt-2" onClick={(e) => e.stopPropagation()}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
        >
          <Share2 className="h-3.5 w-3.5" /> Compartilhar
        </button>
      )}

      {open && (
        <div className="rounded-lg border bg-background p-1 shadow-lg">
          <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
            <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Compartilhar · nº {number}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-1 text-xs font-bold text-muted-foreground"
            >
              fechar
            </button>
          </div>

          <button type="button" onClick={copy} className={item}>
            <Copy className="h-3.5 w-3.5" /> Copiar link
          </button>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={item}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Enviar no WhatsApp
          </a>

          <a
            href={`mailto:?subject=${encodeURIComponent(`${label} nº ${number} no De Olho na Rua`)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}
            onClick={() => setOpen(false)}
            className={item}
          >
            <Mail className="h-3.5 w-3.5" /> Enviar por e-mail
          </a>

          {typeof navigator !== "undefined" && "share" in navigator && (
            <button type="button" onClick={native} className={item}>
              <MoreHorizontal className="h-3.5 w-3.5" /> Mais opções do aparelho
            </button>
          )}
        </div>
      )}
    </div>
  );
}
