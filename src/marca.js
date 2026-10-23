// Marca numa cor só (ajustes da Kari, 23/10/2026): "cor é uma coisa muito sazonal". A cor de destaque mora
// em conteudo.json (marca.cor_destaque) e chega a cada página como --destaque no <html>; o CSS não guarda
// essa cor. Trocar a cor da estação é mudar esse valor (docs/OPERACAO.md, "Trocar a cor da estação").
import conteudo from '../conteudo.json' with { type: 'json' };

const HEX = /^#[0-9A-Fa-f]{6}$/;
const RESERVA = '#141218'; // valor inválido no conteudo.json não quebra a página: cai na tinta

export const corDestaque = () => (HEX.test(conteudo.marca.cor_destaque || '') ? conteudo.marca.cor_destaque : RESERVA);

export const abrirHtml = () => `<html lang="pt-BR" style="--destaque:${corDestaque()}">`;

// Três lâminas abertas em leque, na cor de destaque (CSS em .marca-leque).
export const marcaLeque = () => '<span class="marca-leque" aria-hidden="true"><i></i><i></i><i></i></span>';

// /favicon.svg: o mesmo leque de três lâminas, gerado com a cor atual.
export function favicon() {
  const cor = corDestaque();
  const lamina = giro => `<rect x="13.5" y="5" width="5" height="21" rx="1.5" fill="${cor}" transform="rotate(${giro} 16 26)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#fff"/>${[-24, 0, 24].map(lamina).join('')}</svg>`;
}
