// Quiz "Qual é o seu momento de estilo?" (R-07): página /quiz gerada do conteudo.json. A lógica roda no
// navegador (public/quiz.js) a partir do bloco JSON embutido; nada é salvo nem enviado para o servidor.
// Sem JS, o <noscript> mostra as 8 perguntas em lista e o botão do WhatsApp.
import conteudo from '../conteudo.json' with { type: 'json' };
import { esc, linkWa, MENSAGENS_WA } from './site.js';
import { metaBase } from './seo.js';

const ICONE_WA = '<svg class="icone-wa" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.2-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 2.2.9 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';
const CORES_MARCA = ['roxo', 'vermelho', 'mostarda', 'pink', 'verde', 'grafite'];

// O resultado mais escolhido vence; empate fica com o primeiro na ordem de conteudo.json. (Mesma regra de public/quiz.js.)
export function resultadoDoQuiz(respostas) {
  const { resultados } = conteudo.quiz;
  const contagem = new Map(resultados.map(r => [r.id, 0]));
  for (const id of respostas) if (contagem.has(id)) contagem.set(id, contagem.get(id) + 1);
  return resultados.reduce((melhor, r) => (contagem.get(r.id) > contagem.get(melhor.id) ? r : melhor), resultados[0]);
}

export function dadosDoQuiz(whatsappNumero) {
  const { titulo, perguntas, resultados } = conteudo.quiz;
  return {
    titulo,
    perguntas: perguntas.map(p => ({ pergunta: p.pergunta, opcoes: p.opcoes.map(o => ({ texto: o.texto, resultado: o.resultado })) })),
    resultados: resultados.map(r => ({
      id: r.id, nome: r.nome, texto: r.texto, servico: r.servico, link: `/#${r.servico}`,
      servico_nome: conteudo.servicos.find(s => s.id === r.servico)?.titulo || '',
      wa: linkWa(whatsappNumero, `Oi Kari, fiz o quiz do site e deu ${r.nome}`),
    })),
  };
}

export function renderizarQuiz({ whatsappNumero, base = '' } = {}) {
  const q = conteudo.quiz;
  const dados = dadosDoQuiz(whatsappNumero);
  const waGeral = esc(linkWa(whatsappNumero, MENSAGENS_WA.geral));
  // "<" vira < para o JSON nunca fechar a tag <script>; JSON.parse devolve o texto original.
  const json = JSON.stringify(dados).replace(/</g, '\\u003c');
  const listras = CORES_MARCA.map(c => `<i style="background:var(--${c})"></i>`).join('');

  const lista = q.perguntas.map((p, i) => `
        <li class="quiz-lista-pergunta"><strong>${i + 1}. ${esc(p.pergunta)}</strong>
          <ul>${p.opcoes.map(o => `<li>${esc(o.texto)}</li>`).join('')}</ul>
        </li>`).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(q.titulo)} · Quiz · ${esc(conteudo.marca.assinatura)}</title>
<meta name="description" content="${esc(q.intro)} Com ${esc(conteudo.marca.nome)}, ${esc(conteudo.marca.profissao)} em ${esc(conteudo.marca.cidade)}.">
${metaBase({ base, caminho: '/quiz', titulo: `${q.titulo} · Quiz da ${conteudo.marca.assinatura}`, descricao: q.intro })}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" as="font" type="font/woff2" href="/fontes/familjen-grotesk-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fontes/fragment-mono-latin.woff2" crossorigin>
<link rel="stylesheet" href="/fontes.css">
<link rel="stylesheet" href="/site.css">
</head>
<body class="pagina-quiz">

<header class="topo">
  <div class="wrap">
    <a class="marca" href="/"><span class="marca-leque" aria-hidden="true">${listras}</span>${esc(conteudo.marca.assinatura)}</a>
    <a class="btn topo-cta" href="${waGeral}">Chamar no WhatsApp</a>
  </div>
</header>

<main class="quiz">
  <div class="wrap quiz-wrap">
    <p class="rotulo">Quiz</p>
    <h1 id="quiz-titulo" tabindex="-1">${esc(q.titulo)}</h1>
    <p class="quiz-intro" id="quiz-intro">${esc(q.intro)}</p>

    <div id="quiz-app" hidden>
      <p class="quiz-progresso"><span id="quiz-progresso">Pergunta 1 de ${q.perguntas.length}</span></p>
      <div class="quiz-barra" aria-hidden="true"><i id="quiz-barra"></i></div>
      <div class="quiz-tela" id="quiz-tela"></div>
    </div>

    <noscript>
      <p class="quiz-sem-js">Seu navegador está sem JavaScript, então o quiz vira uma lista: anote as respostas que mais parecem com você e me conte no WhatsApp.</p>
      <ol class="quiz-lista">${lista}
      </ol>
      <a class="btn" href="${waGeral}">${ICONE_WA} Chamar no WhatsApp</a>
    </noscript>
  </div>
</main>

<footer class="rodape rodape-curto">
  <div class="faixa-cores" aria-hidden="true">${listras}</div>
  <div class="wrap">
    <p class="rodape-fim">${esc(conteudo.marca.nome)} · ${esc(conteudo.marca.profissao)} · ${esc(conteudo.marca.cidade)} · <a href="/">Voltar ao site</a></p>
  </div>
</footer>

<script type="application/json" id="quiz-dados">${json}</script>
<script src="/quiz.js" defer></script>
</body>
</html>`;
}
