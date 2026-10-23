// Casca das páginas de leitura (privacidade, 404): mesma marca e rodapé do site, uma coluna de 65–75ch.
import conteudo from '../conteudo.json' with { type: 'json' };
import { esc, linkWa, MENSAGENS_WA } from './site.js';
import { metaBase } from './seo.js';
import { beaconAnalytics } from './analytics.js';
import { abrirHtml, marcaLeque } from './marca.js';

export function casca({ titulo, descricao, corpo, noindex = false, whatsappNumero, base = '', caminho = '/', analyticsToken = '' }) {
  const waGeral = esc(linkWa(whatsappNumero, MENSAGENS_WA.geral));
  return `<!doctype html>
${abrirHtml()}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · ${esc(conteudo.marca.assinatura)}</title>
<meta name="description" content="${esc(descricao)}">${noindex ? '\n<meta name="robots" content="noindex">' : `\n${metaBase({ base, caminho, titulo: `${titulo} · ${conteudo.marca.assinatura}`, descricao })}`}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" as="font" type="font/woff2" href="/fontes/familjen-grotesk-latin.woff2" crossorigin>
<link rel="stylesheet" href="/fontes.css">
<link rel="stylesheet" href="/site.css">
</head>
<body class="pagina-leitura">

<header class="topo">
  <div class="wrap">
    <a class="marca" href="/">${marcaLeque()}${esc(conteudo.marca.assinatura)}</a>
    <a class="btn topo-cta" href="${waGeral}">Chamar no WhatsApp</a>
  </div>
</header>

<main class="leitura">
  <div class="wrap leitura-wrap">
${corpo}
  </div>
</main>

<footer class="rodape rodape-curto">
  <div class="faixa-destaque" aria-hidden="true"></div>
  <div class="wrap">
    <p class="rodape-fim">${esc(conteudo.marca.nome)} · ${esc(conteudo.marca.profissao)} · ${esc(conteudo.marca.cidade)} · <a href="/">Voltar ao site</a> · <a href="/privacidade">Privacidade</a></p>
  </div>
</footer>
${beaconAnalytics(analyticsToken)}
</body>
</html>`;
}

// Qualquer rota que não existe (fora da API e das fotos): status 404, mesma casca, sem indexar.
export function naoEncontrada({ whatsappNumero, base = '' } = {}) {
  const wa = esc(linkWa(whatsappNumero, MENSAGENS_WA.geral));
  return casca({
    titulo: 'Essa página não existe',
    descricao: 'Endereço não encontrado no site da Kari Gava.',
    noindex: true,
    whatsappNumero,
    base,
    corpo: `    <p class="rotulo">Erro 404</p>
    <h1>Essa página não existe</h1>
    <p>O endereço pode ter mudado ou ter sido digitado errado. O site inteiro cabe numa página só: é mais fácil começar por ela.</p>
    <div class="leitura-acoes">
      <a class="btn" href="/">Ir para o site</a>
      <a class="btn btn-linha" href="${wa}">Chamar no WhatsApp</a>
    </div>`,
  });
}
