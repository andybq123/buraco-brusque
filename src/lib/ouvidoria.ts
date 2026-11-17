import { hazardLabel, sizeLabel } from "./potholes";

export interface OuvidoriaInput {
  number: number;
  address: string | null;
  lat: number;
  lng: number;
  size: string | null;
  hazards: string[];
  report_count: number;
  created_at: string;
  kind?: "buraco" | "iluminacao";
  descriptions?: string[];
}

export interface OuvidoriaData {
  assunto: string;
  finalidade: string;
  prioridade: "Alta" | "Baixa";
  endereco: string;
  referencia: string;
  relato: string;
}

/** Monta os dados da solicitação usados no e-mail à Ouvidoria. */
export function buildOuvidoriaReport(p: OuvidoriaInput, origin = ""): OuvidoriaData {
  const lighting = p.kind === "iluminacao";
  const parts = [lighting ? "Munícipe solicita reparo na iluminação pública." : "Munícipe solicita reparo em buraco na via."];
  const size = lighting ? null : sizeLabel(p.size);
  if (size) parts.push(`Tamanho: ${size.toLowerCase()}.`);
  if (p.hazards.length) parts.push(`Riscos: ${p.hazards.map((h) => hazardLabel(h).toLowerCase()).join(", ")}.`);
  const since = new Date(p.created_at).toLocaleDateString("pt-BR");
  parts.push(
    p.report_count > 1 ? `Informado por ${p.report_count} moradores desde ${since}.` : `Informado em ${since}.`,
  );
  parts.push(`Coordenadas: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}.`);
  if (origin) parts.push(`Localização no mapa: ${origin}/?b=${p.number}`);
  return {
    assunto: lighting ? "Iluminação pública" : "Buraco",
    finalidade: "Solicitação",
    prioridade: p.hazards.length > 0 ? "Alta" : "Baixa",
    endereco: p.address ?? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
    referencia: `Buraco nº ${p.number} – De Olho na Rua`,
    relato: parts.join(" "),
  };
}
