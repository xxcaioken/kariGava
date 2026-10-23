// Marca numa cor só (ajustes da Kari, 23/10/2026): "cor é uma coisa muito sazonal". A cor de destaque mora
// em conteudo.json (marca.cor_destaque) e chega a cada página como --destaque no <html>; o CSS não guarda
// essa cor. Trocar a cor da estação é mudar esse valor (docs/OPERACAO.md, "Trocar a cor da estação").
import conteudo from '../conteudo.json' with { type: 'json' };

const HEX = /^#[0-9A-Fa-f]{6}$/;
const RESERVA = '#141218'; // valor inválido ou claro demais no conteudo.json não quebra a página: cai na tinta

// Contraste do texto branco sobre a cor (WCAG); botões, inicial do depoimento e cupom escrevem em branco sobre ela.
function contrasteComBranco(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

let avisou = false;
export function corDestaque(cor = conteudo.marca.cor_destaque) {
  if (HEX.test(cor || '') && contrasteComBranco(cor) >= 4.5) return cor;
  if (!avisou) { console.warn(`marca.cor_destaque "${cor}" inválida ou clara demais para texto branco (contraste < 4,5:1); usando ${RESERVA}`); avisou = true; }
  return RESERVA;
}

export const abrirHtml = () => `<html lang="pt-BR" style="--destaque:${corDestaque()}">`;

// Três lâminas abertas em leque, na cor de destaque (CSS em .marca-leque).
export const marcaLeque = () => '<span class="marca-leque" aria-hidden="true"><i></i><i></i><i></i></span>';

// /favicon.svg: o mesmo leque de três lâminas, gerado com a cor atual.
export function favicon() {
  const cor = corDestaque();
  const lamina = giro => `<rect x="13.5" y="5" width="5" height="21" rx="1.5" fill="${cor}" transform="rotate(${giro} 16 26)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#fff"/>${[-24, 0, 24].map(lamina).join('')}</svg>`;
}
