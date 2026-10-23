// /lalaia (ajustes da Kari, 23/10/2026): a loja da LALAIÁ numa página própria, para o link da bio do
// @lalaia.acessorios cair direto nas peças. Abre com os produtos; depois cupom, como encomendar e quem faz.
// Mesmos dados da home (montarDados) e mesmo CSS (public/site.css).
import { esc, montarDados } from './site.js';
import { criarImg, ICONE_WA } from './template.js';
import { metaBase, jsonLdLalaia } from './seo.js';
import { abrirHtml, marcaLeque } from './marca.js';

const SIZES_PRODUTO = '(max-width: 640px) 50vw, 240px';

export function renderizarLalaia(entrada) {
  const d = montarDados(entrada);
  const l = d.lalaia;
  const img = criarImg(esc);
  const wa = esc(l.wa);
  const titulo = `${l.nome} · feitos à mão, sob encomenda`;
  const descricao = `${l.tagline} ${l.detalhes.join('. ')}.`;

  // A primeira foto do primeiro produto é o maior elemento da primeira tela (LCP): carrega com prioridade, sem lazy.
  const produtos = l.produtos.map((p, i) => {
    const fotos = p.fotos.slice(0, 4);
    return `
        <li class="produto">
          <div class="produto-fotos${fotos.length === 1 ? ' uma' : ''}">
            ${fotos.map((f, j) => img(f, p.titulo, { sizes: SIZES_PRODUTO, hero: i === 0 && j === 0 })).join('\n            ')}
          </div>
          <div class="produto-corpo">
            <p class="rotulo">${esc(p.rotulo)}</p>
            <h3>${esc(p.titulo)}</h3>
            ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}
            ${p.preco_texto ? `<p class="preco"><strong>${esc(p.preco_texto)}</strong></p>` : ''}
            ${p.disponibilidade_texto ? `<p class="disponibilidade">${esc(p.disponibilidade_texto)}</p>` : ''}
            <a href="${esc(p.wa)}">${esc(p.cta)} →</a>
          </div>
        </li>`;
  }).join('');

  // Como encomendar (R-03): 3 passos fixos; as condições que a Kari preencheu entram abaixo, as vazias somem.
  const passos = l.como_encomendar.map(p => `
          <li class="passo"><div><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p></div></li>`).join('');
  const condicoes = l.condicoes.length ? `
        <dl class="condicoes">${l.condicoes.map(c => `
          <div><dt>${esc(c.rotulo)}</dt><dd>${esc(c.texto)}</dd></div>`).join('')}
        </dl>` : '';

  return `<!doctype html>
${abrirHtml()}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
${metaBase({ base: d.base, caminho: '/lalaia', titulo, descricao: l.tagline, imagem: '/og-lalaia.jpg', imagemAlt: `Peças da ${l.nome}` })}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" as="font" type="font/woff2" href="/fontes/familjen-grotesk-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fontes/fragment-mono-latin.woff2" crossorigin>
<link rel="stylesheet" href="/fontes.css">
<link rel="stylesheet" href="/site.css">
${jsonLdLalaia(d, { base: d.base })}
</head>
<body class="com-barra pagina-lalaia">

<header class="topo">
  <div class="wrap">
    <a class="marca" href="/lalaia">${marcaLeque()}LALAIÁ</a>
    <a class="topo-link" href="/">por ${esc(d.marca.assinatura)}</a>
    <a class="btn topo-cta" href="${wa}">Encomendar pelo WhatsApp</a>
  </div>
</header>

<main>
  <section class="lalaia-abre" id="lalaia" aria-labelledby="titulo-lalaia">
    <div class="wrap">
      <p class="rotulo">${l.detalhes.map(esc).join(' · ')}</p>
      <h1 id="titulo-lalaia">${esc(l.nome)}</h1>
      <p class="lalaia-tagline">${esc(l.tagline)}</p>
      <h2 class="visualmente-oculto">Peças</h2>
      <ul class="produtos">${produtos}
      </ul>${l.cupom ? `
      <p class="cupom" id="cupom"><strong>Primeira encomenda?</strong> Diga o código <code>${esc(l.cupom.codigo)}</code> no WhatsApp e ganhe ${esc(l.cupom.desconto)}%.</p>` : ''}
    </div>
  </section>

  <section class="secao secao-cinza" id="como-encomendar" aria-labelledby="titulo-como-encomendar">
    <div class="wrap">
      <div class="secao-cab">
        <h2 id="titulo-como-encomendar">Como encomendar</h2>
        <p>Tudo pelo WhatsApp, peça por peça.</p>
      </div>
      <ol class="passos">${passos}
      </ol>${condicoes}
      <div class="lalaia-cta"><a class="btn" href="${wa}">${ICONE_WA} ${esc(l.cta)}</a></div>
    </div>
  </section>

  <section class="secao lalaia-kari" aria-labelledby="titulo-quem-faz">
    <div class="wrap">
      <p class="rotulo">Quem faz</p>
      <h2 id="titulo-quem-faz">${esc(d.marca.nome)}</h2>
      <p>A LALAIÁ é a marca de acessórios da ${esc(d.marca.apelido)}, ${esc(d.marca.profissao.toLowerCase().replace(' · ', ' e '))} em ${esc(d.marca.cidade)}.</p>
      <a class="btn btn-linha" href="/">Conheça o trabalho da ${esc(d.marca.apelido)}</a>
    </div>
  </section>
</main>

<footer class="rodape rodape-curto">
  <div class="faixa-destaque" aria-hidden="true"></div>
  <div class="wrap">
    <div class="redes">
      <a href="${esc(d.marca.instagram.lalaia)}">@lalaia.acessorios</a>
      <a href="/">Site da ${esc(d.marca.assinatura)}</a>
      <a href="/privacidade">Privacidade</a>${d.marca.gbp_url ? `
      <a href="${esc(d.marca.gbp_url)}" rel="noopener">Avaliações no Google</a>` : ''}
    </div>
    <p class="rodape-fim">${esc(l.nome)} · feitos à mão em ${esc(d.marca.cidade)}</p>
  </div>
</footer>

<div class="barra-wa"><a class="btn" href="${wa}">Encomendar pelo WhatsApp</a></div>
${d.analytics}
</body>
</html>`;
}
