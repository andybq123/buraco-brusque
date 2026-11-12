/** Preparo de foto: só imagens, converte HEIC do iPhone e salva pequena (baixa qualidade). */
export const PHOTO_MAX_SIDE = 960;
export const PHOTO_QUALITY = 0.5;
const FALLBACK_MAX_BYTES = 1.5 * 1024 * 1024;

export function isHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function isAcceptedImage(file: File) {
  return file.type.startsWith("image/") || isHeic(file);
}

async function decode(blob: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* tenta pelo <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function heicToJpeg(file: File): Promise<Blob | null> {
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: PHOTO_QUALITY });
    return (Array.isArray(out) ? out[0] : out) ?? null;
  } catch {
    return null;
  }
}

async function shrink(blob: Blob): Promise<Blob> {
  const img = await decode(blob);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("foto"))), "image/jpeg", PHOTO_QUALITY));
}

/** Devolve a foto pronta para envio, ou null se não der (o buraco é enviado mesmo assim). */
export async function preparePhoto(file: File): Promise<Blob | null> {
  if (!isAcceptedImage(file)) return null;
  try {
    return await shrink(file); // Safari já abre HEIC direto
  } catch {
    /* segue */
  }
  if (isHeic(file)) {
    const jpg = await heicToJpeg(file);
    if (jpg) {
      try {
        return await shrink(jpg);
      } catch {
        return jpg.size <= FALLBACK_MAX_BYTES ? jpg : null;
      }
    }
    return null;
  }
  if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= FALLBACK_MAX_BYTES) return file;
  return null;
}
