// Site público: variante D1 "Leque" (design/variantes/d1-leque.html), gerada a partir do banco.
// O CSS está em public/site.css. Todo texto dinâmico passa por esc().

import { metaBase, jsonLd } from './seo.js';
import { chaveDaVariante } from './variantes.js';
import { abrirHtml, marcaLeque } from './marca.js';

// `sizes` por posição (ENG-09): cartões ocupam a largura toda no celular e ~480 px no desktop; hero/sobre até 640 px.
const SIZES_CARTAO = '(max-width: 640px) 100vw, 480px';
const SIZES_GRANDE = '(max-width: 640px) 100vw, 640px';
const SIZES_MINIATURA = '(max-width: 640px) 40vw, 160px';
const SIZES_LAMINA = '(max-width: 959px) 118px, 158px';
const SIZES_VITRINE = '(max-width: 640px) 33vw, 320px';

export const ICONE_WA = '<svg class="icone-wa" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.2-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 2.2.9 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';

// Foto com versões leves (R-10): <picture> com WebP e srcset nas larguras que existem; sem elas, <img> simples.
// Toda foto fora do hero é lazy e, quando o tamanho é conhecido, leva width/height (sem pulo de layout).
// Exportada para a página da LALAIÁ (src/lalaia.js) usar a mesma regra.
export const criarImg = esc => (f, alt, { sizes = SIZES_CARTAO, hero = false } = {}) => {
  if (!f) return '';
  const texto = esc(alt ?? f.titulo);
  const dims = Number.isInteger(f.largura) && Number.isInteger(f.altura) ? ` width="${f.largura}" height="${f.altura}"` : '';
  const carga = hero ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"';
  const larguras = f.variantes?.larguras || [];
  if (!larguras.length) return `<img src="${esc(f.foto_url)}" alt="${texto}"${dims}${carga}>`;
  const lista = ext => larguras.map(w => `${esc(chaveDaVariante(f.foto_url, w, ext))} ${w}w`).join(', ');
  const webp = f.variantes.webp ? `<source type="image/webp" srcset="${lista('webp')}" sizes="${sizes}">` : '';
  return `<picture>${webp}<img src="${esc(f.foto_url)}" srcset="${lista('jpg')}" sizes="${sizes}" alt="${texto}"${dims}${carga}></picture>`;
};

export function template(d, esc) {
  const wa = esc(d.whatsapp.geral); // botões gerais (topo, hero, rodapé, barra fixa); serviço tem o próprio link
  const img = criarImg(esc);

  // Leque da abertura (ajustes da Kari): uma lâmina por serviço com foto, aberta em volta da foto dela, sempre
  // simétrico. Número par: metade de cada lado, de 20 em 20 graus (4 → −40, −20, 20, 40). Ímpar: uma em pé atrás
  // da foto e as outras abertas até ±40 graus (3 → −40, 0, 40; pré-QA C22). As de dentro ficam na frente e abrem primeiro.
  const comFoto = d.servicos.filter(s => s.foto_leque);
  const n = comFoto.length, metade = n / 2;
  const angulo = i => (n % 2 === 0
    ? (i < metade ? -20 * (metade - i) : 20 * (i - metade + 1))
    : (n === 1 ? 0 : Math.round((i - (n - 1) / 2) * (80 / (n - 1)))));
  const leque = comFoto.map((s, i) => {
    const a = angulo(i), passo = Math.abs(a) / 20;
    return `
          <a class="lamina${a > 0 ? ' dir' : ''}" href="#${esc(s.id)}" style="--a:${a}deg;--z:${4 - Math.ceil(passo)};--atraso:${(0.05 + 0.07 * Math.max(passo - 1, 0)).toFixed(2)}s"><span class="lamina-nome" aria-hidden="true">${esc(s.curto)}</span>${img(s.foto_leque, '', { sizes: SIZES_LAMINA })}<span class="visualmente-oculto">${esc(s.titulo)}</span></a>`;
  }).join('');

  const legenda = d.servicos.map(s => `
        <li><a href="#${esc(s.id)}">${esc(s.legenda)}</a></li>`).join('');

  const servicos = d.servicos.map(s => {
    const [principal, ...outras] = s.fotos;
    return `
        <li class="servico" id="${esc(s.id)}" data-grupo="${esc(s.grupo)}">
          ${s.ancoras.map(a => `<span class="ancora" id="${esc(a)}"></span>`).join('')}
          <figure class="servico-foto">
            ${img(principal, principal?.titulo || s.titulo)}
          </figure>
          <div class="servico-corpo">
            <span class="grupo-tag">${esc(s.grupo_nome)}</span>
            <h3>${esc(s.titulo)}</h3>
            <p class="servico-resumo">${esc(s.resumo)}</p>
            ${s.para_quem ? `<p class="para-quem"><strong>Para quem</strong>${esc(s.para_quem)}</p>` : ''}
            ${outras.length ? `<ul class="servico-mais" aria-label="Mais fotos">${outras.map(f => `<li>${img(f, undefined, { sizes: SIZES_MINIATURA })}</li>`).join('')}</ul>` : ''}
            ${s.como_funciona?.length ? `<details class="como"><summary>Como funciona</summary>
              <ol>${s.como_funciona.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
            </details>` : ''}
            ${s.citacao ? `<blockquote class="citacao">${esc(s.citacao)}</blockquote>` : ''}
            ${s.preco ? `<p class="preco"><span class="rotulo">${esc(s.preco.rotulo)}</span>${s.preco.valor ? ` <strong>${esc(s.preco.valor)}</strong>` : ''}</p>` : ''}
            <a class="btn" href="${esc(s.wa)}">${esc(s.cta)}</a>
          </div>
        </li>`;
  }).join('');

  const passos = d.como_trabalhar.map(p => `
        <li class="passo"><div><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p></div></li>`).join('');

  // LALAIÁ na home (ajustes da Kari): bloco curto que leva à /lalaia; a loja inteira (produtos, cupom, como
  // encomendar) mora lá, para o link da bio do @lalaia.acessorios cair direto nas peças.
  const vitrine = d.lalaia.produtos.slice(0, 3).map(p => `
        <li><a href="/lalaia">${img(p.fotos[0], p.titulo, { sizes: SIZES_VITRINE })}</a></li>`).join('');

  const agenda = d.ensino_realizado.map(e => `
        <li><p class="rotulo">${esc(e.tipo)}<br>${esc(e.quando)}</p><h3>${esc(e.titulo)}</h3><p>${esc(e.onde)}</p></li>`).join('');

  const fotoSobre = d.sobre.fotos[0];

  // Perguntas frequentes (R-06): só publicadas, por grupo, em <details> (sem JS, teclado); some sem pergunta.
  const faq = d.faq.length ? `
  <section class="secao" id="faq" aria-labelledby="titulo-faq">
    <div class="wrap">
      <div class="secao-cab">
        <h2 id="titulo-faq">Perguntas frequentes</h2>
        <p>O que mais me perguntam antes de chamar.</p>
      </div>
      <div class="faq-grupos">${d.faq.map(g => `
        <div class="faq-grupo">
          <h3 id="faq-${esc(g.id)}">${esc(g.titulo)}</h3>${g.perguntas.map(p => `
          <details class="como faq-item"><summary>${esc(p.pergunta)}</summary><p>${esc(p.resposta)}</p></details>`).join('')}
        </div>`).join('')}
      </div>
    </div>
  </section>
` : '';

  // Antes e depois (R-05): dentro da área de serviços, logo após a grade; só existe com par. As duas fotos lado a lado
  // em qualquer largura (a comparação é o conteúdo), rótulos sobrepostos e legenda abaixo.
  const fotoPar = (p, lado, rotulo) => `<figure class="par-foto"><img src="${esc(p[`${lado}_url`])}" alt="${esc(`${rotulo}: ${p.legenda || p.servico_nome}`)}" width="${esc(p[`largura_${lado}`])}" height="${esc(p[`altura_${lado}`])}" loading="lazy" decoding="async"><figcaption>${rotulo}</figcaption></figure>`;
  const antesDepois = d.antes_depois.length ? `
      <div class="antes-depois" id="antes-depois" aria-labelledby="titulo-antes-depois">
        <div class="secao-cab">
          <h3 id="titulo-antes-depois">Antes e depois</h3>
          <p>Vitrines, looks e armários que passaram pela minha mão.</p>
        </div>
        <ul class="pares">${d.antes_depois.map(p => `
          <li class="par">
            <div class="par-fotos">
              ${fotoPar(p, 'antes', 'Antes')}
              ${fotoPar(p, 'depois', 'Depois')}
            </div>
            <p class="par-legenda">${p.legenda ? `${esc(p.legenda)} ` : ''}<span class="rotulo">${esc(p.servico_nome)}</span></p>
          </li>`).join('')}
        </ul>
      </div>` : '';

  // O que dizem (R-04): só existe no HTML quando há depoimento. Lista vertical, foto redonda ou inicial na cor de destaque.
  const depoimentos = d.depoimentos.length ? `
  <section class="secao depoimentos-secao" id="depoimentos" aria-labelledby="titulo-depoimentos">
    <div class="wrap">
      <div class="secao-cab">
        <h2 id="titulo-depoimentos">O que dizem</h2>
        <p>Quem já passou por aqui.</p>
      </div>
      <ul class="depoimentos">${d.depoimentos.map(p => `
        <li class="depoimento">
          ${p.foto_url
            ? `<img class="depoimento-foto" src="${esc(p.foto_url)}" alt="" width="${esc(p.largura)}" height="${esc(p.altura)}" loading="lazy" decoding="async">`
            : `<span class="depoimento-inicial" aria-hidden="true">${esc(p.inicial)}</span>`}
          <blockquote class="citacao">${esc(p.texto)}</blockquote>
          <p class="depoimento-autor"><strong>${esc(p.nome)}</strong>${p.de_onde ? `, ${esc(p.de_onde)}` : ''}${p.servico_nome ? `<span class="rotulo">${esc(p.servico_nome)}</span>` : ''}</p>
        </li>`).join('')}
      </ul>
    </div>
  </section>` : '';

  return `<!doctype html>
${abrirHtml()}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.marca.assinatura)} · Styling &amp; VM</title>
<meta name="description" content="${esc(d.hero.subtitulo)} Acessórios LALAIÁ feitos à mão.">
${metaBase({ base: d.base, caminho: '/', titulo: `${d.marca.assinatura} · ${d.marca.profissao}`, descricao: `${d.hero.titulo} ${d.hero.subtitulo}` })}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" as="font" type="font/woff2" href="/fontes/familjen-grotesk-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fontes/fragment-mono-latin.woff2" crossorigin>
<link rel="stylesheet" href="/fontes.css">
<link rel="stylesheet" href="/site.css">
${jsonLd(d, { base: d.base, whatsappNumero: d.whatsapp.numero })}
</head>
<body class="com-barra">

<header class="topo">
  <div class="wrap">
    <a class="marca" href="#">${marcaLeque()}${esc(d.marca.assinatura)}</a>
    <nav class="nav" aria-label="Seções">
      <ul>
        <li><a href="#servicos">Serviços</a></li>
        <li><a href="#como-trabalhar">Como funciona</a></li>
        <li><a href="#sobre">Sobre</a></li>
        <li><a href="/lalaia">LALAIÁ</a></li>
        <li><a href="#cursos">Cursos</a></li>${d.faq.length ? `
        <li><a href="#faq">Dúvidas</a></li>` : ''}
      </ul>
    </nav>
    <a class="btn topo-cta" href="${wa}">Chamar no WhatsApp</a>
  </div>
</header>

<main>
  <section class="hero">
    <div class="wrap hero-grade">
      <div class="hero-texto">
        <p class="rotulo">${esc(d.marca.profissao)} · ${esc(d.marca.cidade)}</p>
        <h1>${esc(d.hero.titulo)}</h1>
        <p class="hero-sub">${esc(d.hero.subtitulo)}</p>
        <div class="hero-acoes">
          <a class="btn" href="${wa}">${ICONE_WA} Chamar no WhatsApp</a>
          <a class="btn btn-linha" href="#servicos">Ver serviços</a>
        </div>
        <p class="hero-quiz"><a href="/quiz">Não sabe por onde começar? Faça o quiz</a></p>
      </div>

      <div class="leque-area">
        <div class="leque" role="group" aria-label="Serviços da Kari">${leque}
          <figure class="leque-foto">
            ${img(d.hero.foto_item, 'Kari sorrindo, segurando um cabide com uma peça de babados vermelhos, num fundo pink', { sizes: SIZES_GRANDE, hero: true })}
            <figcaption>${esc(d.hero.credito_foto)}</figcaption>
          </figure>
          <span class="pino" aria-hidden="true"></span>
        </div>
      </div>

      <ul class="legenda" aria-label="Serviços">${legenda}
      </ul>
    </div>
  </section>

  <section class="secao secao-cinza servicos" id="servicos" aria-labelledby="titulo-servicos">
    <div class="wrap">
      <div class="secao-cab">
        <h2 id="titulo-servicos">Serviços</h2>
        <p>Me chame no WhatsApp pelo botão do serviço que você quer.</p>
      </div>

      <ul class="grade-servicos">${servicos}
      </ul>${antesDepois}
    </div>
  </section>

  <section class="secao" id="como-trabalhar" aria-labelledby="titulo-como">
    <div class="wrap">
      <div class="secao-cab">
        <h2 id="titulo-como">Como trabalhar comigo</h2>
        <p>Todo serviço começa do mesmo jeito: uma conversa.</p>
      </div>
      <ol class="passos">${passos}
      </ol>
    </div>
  </section>
${depoimentos}
  <section class="secao secao-cinza" id="sobre" aria-labelledby="titulo-sobre">
    <div class="wrap sobre-grade">
      <figure class="sobre-foto" style="margin:0">${img(fotoSobre, 'Kari', { sizes: SIZES_GRANDE })}</figure>
      <div class="sobre-texto">
        <p class="rotulo">Sobre</p>
        <h2 id="titulo-sobre">Oi, eu sou a ${esc(d.marca.apelido)}!</h2>
        <p>${esc(d.sobre.texto.replace(/^Oi, eu sou a Kari! /, ''))}</p>
        <ul class="chips"><li>${esc(d.marca.formacao)}</li><li>${esc(d.marca.cidade)}</li></ul>
        <p class="frase">nós somos a moda. <span>as pessoas.</span></p>
      </div>
    </div>
  </section>

  <section class="secao" id="lalaia" aria-labelledby="titulo-lalaia">
    <div class="wrap">
      <div class="lalaia-cab">
        <div>
          <p class="rotulo">Produtos</p>
          <h2 id="titulo-lalaia">${esc(d.lalaia.nome)}</h2>
        </div>
        <p>${esc(d.lalaia.tagline)}</p>
      </div>${vitrine ? `
      <ul class="lalaia-vitrine">${vitrine}
      </ul>` : ''}
      <div class="lalaia-cta"><a class="btn" href="/lalaia">Ver as peças da LALAIÁ</a></div>
    </div>
  </section>

  <section class="secao secao-cinza" id="cursos" aria-labelledby="titulo-cursos">
    <div class="wrap">
      <div class="secao-cab">
        <h2 id="titulo-cursos">Já passou por aqui</h2>
        <p>Cursos, oficinas e palestras que eu dei.</p>
      </div>
      <ul class="agenda">${agenda}
      </ul>
    </div>
  </section>
${faq}</main>

<footer class="rodape" id="contato">
  <div class="faixa-destaque" aria-hidden="true"></div>
  <div class="wrap">
    <h2>Vamos conversar?</h2>
    <a class="btn" href="${wa}">Chamar no WhatsApp</a>
    <div class="redes">
      <a href="${esc(d.marca.instagram.kari)}">@karienegavaw</a>
      <a href="${esc(d.marca.instagram.lalaia)}">@lalaia.acessorios</a>
      <a href="/quiz">Quiz: qual é o seu momento de estilo?</a>
      <a href="/privacidade">Privacidade</a>${d.marca.gbp_url ? `
      <a href="${esc(d.marca.gbp_url)}" rel="noopener">Avaliações no Google</a>` : ''}
    </div>
    <p class="rodape-fim">${esc(d.marca.nome)} · Styling &amp; Visual Merchandising · ${esc(d.marca.cidade)}<br>Foto do topo: ${esc(d.hero.credito_foto.replace(/^Foto: /, ''))}</p>
  </div>
</footer>

<div class="barra-wa"><a class="btn" href="${wa}">Chamar no WhatsApp</a></div>
${d.analytics}
</body>
</html>`;
}
