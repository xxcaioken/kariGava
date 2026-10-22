// Site público: variante D1 "Leque" (design/variantes/d1-leque.html), gerada a partir do banco.
// O CSS está em public/site.css. Todo texto dinâmico passa por esc().

const ICONE_WA = '<svg class="icone-wa" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.2-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 2.2.9 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';
const CORES_MARCA = ['roxo', 'vermelho', 'mostarda', 'pink', 'verde', 'grafite'];

export function template(d, esc) {
  const wa = esc(d.whatsapp);
  const listras = CORES_MARCA.map(c => `<i style="background:var(--${c})"></i>`).join('');
  const img = (f, alt, extra = '') => f
    ? `<img src="${esc(f.foto_url)}" alt="${esc(alt ?? f.titulo)}" loading="lazy" decoding="async"${extra}>`
    : '';

  const leque = d.servicos.map((s, i) => `
          <a class="amostra ${i < 3 ? 'esq' : 'dir'} a${i + 1}${s.escuro ? ' escuro' : ''}" href="#${esc(s.id)}" style="--cor:var(--${s.var})"><span class="amostra-cod">${esc(s.kg)}</span><span class="amostra-cor">${esc(s.nome)}</span><span class="amostra-servico">${esc(s.curto)}</span><span class="visualmente-oculto">${esc(s.titulo)}</span></a>`).join('');

  const legenda = d.servicos.map(s => `
        <li><a href="#${esc(s.id)}" style="--cor:var(--${s.var})"><i></i>${esc(s.legenda)}</a></li>`).join('');

  const COR_GRUPO = { voce: 'roxo', lojas: 'verde', ensino: 'grafite' };
  const filtro = d.grupos.map(g => {
    const cor = COR_GRUPO[g.id] || 'tinta';
    return `<input type="radio" name="grupo" id="f-${esc(g.id)}"><label for="f-${esc(g.id)}" style="--cor:var(--${cor})"><i></i>${esc(g.titulo)}</label>`;
  }).join('\n        ');

  const servicos = d.servicos.map(s => {
    const [principal, ...outras] = s.fotos;
    return `
        <li class="servico${s.escuro ? ' escuro' : ''}" id="${esc(s.id)}" data-grupo="${esc(s.grupo)}" style="--cor:var(--${s.var});--cor-forte:var(--${s.var}-forte)">
          <figure class="servico-foto">
            ${img(principal, principal?.titulo || s.titulo)}
            <figcaption class="servico-faixa"><span>${esc(s.kg)}</span><span>${esc(s.nome)}</span></figcaption>
          </figure>
          <div class="servico-corpo">
            <span class="grupo-tag">${esc(s.grupo_nome)}</span>
            <h3>${esc(s.titulo)}</h3>
            <p class="servico-resumo">${esc(s.resumo)}</p>
            ${s.para_quem ? `<p class="para-quem"><strong>Para quem</strong>${esc(s.para_quem)}</p>` : ''}
            ${outras.length ? `<ul class="servico-mais" aria-label="Mais fotos">${outras.map(f => `<li>${img(f)}</li>`).join('')}</ul>` : ''}
            ${s.como_funciona?.length ? `<details class="como"><summary>Como funciona</summary>
              <ol>${s.como_funciona.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
            </details>` : ''}
            ${s.citacao ? `<blockquote class="citacao">${esc(s.citacao)}</blockquote>` : ''}
            <a class="btn" href="${wa}">${esc(s.cta)}</a>
          </div>
        </li>`;
  }).join('');

  const passos = d.como_trabalhar.map(p => `
        <li class="passo"><div><h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p></div></li>`).join('');

  const produtos = d.lalaia.produtos.map(p => {
    const fotos = p.fotos.slice(0, 4);
    return `
        <li class="produto">
          <div class="produto-fotos${fotos.length === 1 ? ' uma' : ''}">
            ${fotos.map(f => img(f, p.titulo)).join('\n            ')}
          </div>
          <div class="produto-corpo">
            <p class="rotulo">${esc(p.rotulo)}</p>
            <h3>${esc(p.titulo)}</h3>
            ${p.texto ? `<p>${esc(p.texto)}</p>` : ''}
            <a href="${wa}">${esc(p.cta)} →</a>
          </div>
        </li>`;
  }).join('');

  const agenda = d.ensino_realizado.map(e => `
        <li><p class="rotulo">${esc(e.tipo)}<br>${esc(e.quando)}</p><h3>${esc(e.titulo)}</h3><p>${esc(e.onde)}</p></li>`).join('');

  const fotoSobre = d.sobre.fotos[0];

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.marca.assinatura)} · Styling &amp; VM</title>
<meta name="description" content="${esc(d.hero.subtitulo)} Acessórios LALAIÁ feitos à mão.">
<meta property="og:title" content="${esc(d.marca.assinatura)} · ${esc(d.marca.profissao)}">
<meta property="og:description" content="${esc(d.hero.titulo)} ${esc(d.hero.subtitulo)}">
<meta property="og:image" content="/${esc(d.hero.foto)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" as="font" type="font/woff2" href="/fontes/familjen-grotesk-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fontes/fragment-mono-latin.woff2" crossorigin>
<link rel="stylesheet" href="/fontes.css">
<link rel="stylesheet" href="/site.css">
</head>
<body>

<header class="topo">
  <div class="wrap">
    <a class="marca" href="#"><span class="marca-leque" aria-hidden="true">${listras}</span>${esc(d.marca.assinatura)}</a>
    <nav class="nav" aria-label="Seções">
      <ul>
        <li><a href="#servicos">Serviços</a></li>
        <li><a href="#como-trabalhar">Como funciona</a></li>
        <li><a href="#sobre">Sobre</a></li>
        <li><a href="#lalaia">LALAIÁ</a></li>
        <li><a href="#cursos">Cursos</a></li>
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
      </div>

      <div class="leque-area">
        <div class="leque" aria-label="Cartela de serviços da Kari">${leque}
          <figure class="leque-foto">
            <img src="/${esc(d.hero.foto)}" alt="Kari sorrindo, segurando um cabide com uma peça de babados vermelhos, num fundo pink" width="640" height="640" fetchpriority="high">
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
        <p>Cada serviço tem a sua cor na cartela. Escolha o que combina com você e me chame no WhatsApp pelo botão do próprio serviço.</p>
      </div>

      <fieldset class="filtro">
        <legend class="visualmente-oculto">Mostrar serviços</legend>
        <input type="radio" name="grupo" id="f-todos" checked><label for="f-todos">Todos</label>
        ${filtro}
      </fieldset>

      <ul class="grade-servicos">${servicos}
      </ul>
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

  <section class="secao secao-cinza" id="sobre" aria-labelledby="titulo-sobre">
    <div class="wrap sobre-grade">
      <figure class="sobre-foto" style="margin:0">${img(fotoSobre, 'Kari')}</figure>
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
      </div>
      <ul class="detalhes">${d.lalaia.detalhes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <ul class="produtos">${produtos}
      </ul>
      <div class="lalaia-cta"><a class="btn" href="${wa}">${esc(d.lalaia.cta)}</a></div>
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
</main>

<footer class="rodape" id="contato">
  <div class="faixa-cores" aria-hidden="true">${listras}</div>
  <div class="wrap">
    <h2>Vamos conversar?</h2>
    <a class="btn" href="${wa}">Chamar no WhatsApp</a>
    <div class="redes">
      <a href="${esc(d.marca.instagram.kari)}">@karienegavaw</a>
      <a href="${esc(d.marca.instagram.lalaia)}">@lalaia.acessorios</a>
    </div>
    <p class="rodape-fim">${esc(d.marca.nome)} · Styling &amp; Visual Merchandising · ${esc(d.marca.cidade)}<br>Foto do topo: ${esc(d.hero.credito_foto.replace(/^Foto: /, ''))}</p>
  </div>
</footer>

<div class="barra-wa"><a class="btn" href="${wa}">Chamar no WhatsApp</a></div>
</body>
</html>`;
}
