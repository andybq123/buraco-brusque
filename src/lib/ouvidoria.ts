import { hazardLabel, sizeLabel } from "./potholes";

export const OUVIDORIA_URL = "https://brusque.1doc.com.br/b.php?pg=wp/wp&passo=2&s=brusque&itd=15";

export interface OuvidoriaInput {
  number: number;
  address: string | null;
  lat: number;
  lng: number;
  size: string | null;
  hazards: string[];
  report_count: number;
  created_at: string;
}

export interface OuvidoriaData {
  assunto: string;
  finalidade: string;
  prioridade: "Alta" | "Baixa";
  endereco: string;
  referencia: string;
  relato: string;
}

/** Monta os campos do formulário da Ouvidoria a partir do buraco. */
export function buildOuvidoriaReport(p: OuvidoriaInput, origin = ""): OuvidoriaData {
  const parts = ["Munícipe solicita reparo em buraco na via."];
  const size = sizeLabel(p.size);
  if (size) parts.push(`Tamanho: ${size.toLowerCase()}.`);
  if (p.hazards.length) parts.push(`Riscos: ${p.hazards.map((h) => hazardLabel(h).toLowerCase()).join(", ")}.`);
  const since = new Date(p.created_at).toLocaleDateString("pt-BR");
  parts.push(
    p.report_count > 1 ? `Informado por ${p.report_count} moradores desde ${since}.` : `Informado em ${since}.`,
  );
  parts.push(`Coordenadas: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}.`);
  if (origin) parts.push(`Localização no mapa: ${origin}/?b=${p.number}`);
  return {
    assunto: "Buraco",
    finalidade: "Solicitação",
    prioridade: p.hazards.length > 0 ? "Alta" : "Baixa",
    endereco: p.address ?? `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`,
    referencia: `Buraco nº ${p.number} – De Olho na Rua`,
    relato: parts.join(" "),
  };
}

export function encodeOuvidoria(d: OuvidoriaData) {
  return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(d)))));
}

/** Favorito que roda na página da Ouvidoria e preenche os campos (nunca o captcha nem o envio). */
const BOOKMARKLET_SRC = `(function(){
var m=location.hash.match(/deolho=([^&]+)/);var d;
try{d=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m?m[1]:prompt('Cole o código do De Olho na Rua')||'')))));}catch(e){alert('Abra a Ouvidoria pelo botão do painel De Olho na Rua.');return;}
var $=window.jQuery;var n=function(s){return (s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim();};
function fire(el){['input','change','blur'].forEach(function(t){el.dispatchEvent(new Event(t,{bubbles:true}));});if($){try{$(el).trigger('change').trigger('chosen:updated');}catch(e){}}}
function pick(want){var w=n(want);var ss=document.querySelectorAll('select');for(var i=0;i<ss.length;i++){var o=[].slice.call(ss[i].options).find(function(o){return n(o.text).replace(/^[-\\s]+/,'')===w;})||[].slice.call(ss[i].options).find(function(o){return n(o.text).indexOf(w)>=0;});if(o){ss[i].value=o.value;fire(ss[i]);return true;}}return false;}
function setIn(match,val){var ins=document.querySelectorAll('input[type=text],input:not([type]),textarea');for(var i=0;i<ins.length;i++){var e=ins[i];var lbl=n(e.placeholder+' '+e.name+' '+e.id+' '+(e.labels&&e.labels[0]?e.labels[0].textContent:''));if(match.some(function(k){return lbl.indexOf(k)>=0;})&&e.offsetParent!==null){e.focus();e.value=val;fire(e);return true;}}return false;}
var ok=[];
if(pick(d.assunto))ok.push('Assunto');
if(pick(d.finalidade))ok.push('Finalidade');
if(pick(d.prioridade))ok.push('Prioridade');
if(setIn(['endereco completo','endereco'],d.endereco))ok.push('Endereço');
if(setIn(['referencia'],d.referencia))ok.push('Referência');
var html='<p>'+d.relato.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</p>';var desc=false;
var ed=document.querySelector('.note-editable,[contenteditable=true]');if(ed){ed.innerHTML=html;fire(ed);desc=true;}
if(window.CKEDITOR){for(var k in CKEDITOR.instances){CKEDITOR.instances[k].setData(html);desc=true;}}
var tas=document.querySelectorAll('textarea');for(var j=0;j<tas.length;j++){var t=tas[j];var l=n(t.name+' '+t.id);if(l.indexOf('desc')>=0||l.indexOf('relato')>=0||l.indexOf('texto')>=0||l.indexOf('conteudo')>=0){t.value=html;fire(t);if($&&$(t).summernote){try{$(t).summernote('code',html);}catch(e){}}desc=true;}}
if(desc)ok.push('Descrição');
alert('De Olho na Rua preencheu: '+(ok.join(', ')||'nada')+'.\\nConfira, marque \"Não sou um robô\" e clique em Registrar.');
})();`;

export const BOOKMARKLET = "javascript:" + encodeURIComponent(BOOKMARKLET_SRC.replace(/\n/g, ""));
