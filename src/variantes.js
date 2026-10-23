// Versões leves das fotos (R-10): regras puras compartilhadas pelo servidor, pelo site e pelos testes.
// Nome da variante = chave sem extensão + "-<largura>.<jpg|webp>" (ig/kari/123.jpg → ig/kari/123-480.jpg).
// Nunca ampliar: só as larguras padrão menores que a original, mais a própria original.
import variantesIniciais from '../public/img/variantes.json' with { type: 'json' };

export const LARGURAS_PADRAO = [480, 960, 1600];
const MAX_LADO = 10000;

// O painel reduz a original a 1600 px no lado maior, então o teto da lista é 1600.
export function largurasDasVariantes(larguraOriginal) {
  const w = Number(larguraOriginal);
  if (!Number.isInteger(w) || w < 1) return [];
  const teto = Math.min(w, LARGURAS_PADRAO[LARGURAS_PADRAO.length - 1]);
  return [...LARGURAS_PADRAO.filter(x => x < teto), teto];
}

export const chaveDaVariante = (chave, largura, ext) => `${String(chave).replace(/\.[a-z0-9]+$/i, '')}-${largura}.${ext}`;

// Campo do multipart: "480.jpg", "1600.webp"… Devolve null para qualquer outro nome.
export function nomeDaVariante(nome) {
  const m = /^(\d{1,5})\.(jpg|webp)$/.exec(String(nome ?? ''));
  if (!m) return null;
  const largura = Number(m[1]);
  if (largura < 1 || largura > MAX_LADO) return null;
  return { largura, ext: m[2] };
}

// Fotos iniciais (public/img): as variantes vêm de variantes.json, gerado por scripts/gerar-variantes.sh.
export function variantesDaFotoInicial(fotoUrl) {
  const m = /^\/img\/([^/]+)\.jpg$/.exec(String(fotoUrl ?? ''));
  const v = m && variantesIniciais[m[1]];
  return v ? { larguras: v.larguras, webp: Boolean(v.webp), largura: v.largura, altura: v.altura } : null;
}
