// Quiz "Qual é o seu momento de estilo?" (R-07): uma pergunta por tela, escolher avança, "Voltar" volta uma.
// Lê os dados do bloco JSON da página; nada é salvo nem enviado. Todo texto entra via textContent.
(() => {
  const dados = JSON.parse(document.getElementById('quiz-dados').textContent);
  const app = document.getElementById('quiz-app');
  const tela = document.getElementById('quiz-tela');
  const progresso = document.getElementById('quiz-progresso');
  const barra = document.getElementById('quiz-barra');
  const intro = document.getElementById('quiz-intro');
  const total = dados.perguntas.length;
  const respostas = [];
  let indice = 0;
  const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, String(v));
    }
    for (const f of filhos) if (f) e.append(f);
    return e;
  }

  // O resultado mais escolhido vence; empate fica com o primeiro na ordem dos resultados (mesma regra do servidor).
  function resultado() {
    const contagem = new Map(dados.resultados.map((r) => [r.id, 0]));
    for (const id of respostas) if (contagem.has(id)) contagem.set(id, contagem.get(id) + 1);
    return dados.resultados.reduce((melhor, r) => (contagem.get(r.id) > contagem.get(melhor.id) ? r : melhor), dados.resultados[0]);
  }

  // Troca de tela: com movimento reduzido é imediata; senão, um fade curto (CSS .quiz-tela.saindo).
  function trocar(montar, foco) {
    const aplicar = () => {
      tela.replaceChildren(montar());
      tela.classList.remove('saindo');
      const alvo = foco ? tela.querySelector(foco) : null;
      (alvo || tela.querySelector('h2'))?.focus({ preventScroll: false });
    };
    if (movimentoReduzido || !tela.childElementCount) { aplicar(); return; }
    tela.classList.add('saindo');
    tela.addEventListener('transitionend', aplicar, { once: true });
    setTimeout(aplicar, 260); // garante a troca se o transitionend não vier
  }

  function telaPergunta() {
    const p = dados.perguntas[indice];
    progresso.textContent = `Pergunta ${indice + 1} de ${total}`;
    barra.style.width = `${Math.round((indice / total) * 100)}%`;
    const opcoes = el('div', { class: 'quiz-opcoes', role: 'group', 'aria-labelledby': 'quiz-pergunta' });
    p.opcoes.forEach((o) => opcoes.append(el('button', {
      class: 'quiz-opcao', type: 'button', text: o.texto,
      onclick: () => { respostas[indice] = o.resultado; indice += 1; indice < total ? trocar(telaPergunta) : trocar(telaResultado, '.quiz-resultado h2'); },
    })));
    return el('div', { class: 'quiz-pergunta' },
      el('h2', { id: 'quiz-pergunta', tabindex: '-1', text: p.pergunta }),
      opcoes,
      indice > 0 && el('button', { class: 'quiz-voltar', type: 'button', text: '← Voltar', onclick: () => { indice -= 1; trocar(telaPergunta); } }));
  }

  function telaResultado() {
    const r = resultado();
    progresso.textContent = 'Resultado';
    barra.style.width = '100%';
    return el('div', { class: 'quiz-resultado' },
      el('p', { class: 'rotulo', text: 'Seu momento de estilo' }),
      el('h2', { tabindex: '-1', text: r.nome }),
      el('p', { class: 'quiz-resultado-texto', text: r.texto }),
      el('p', { class: 'quiz-resultado-servico', text: `Serviço indicado: ${r.servico_nome}` }),
      el('div', { class: 'quiz-acoes' },
        el('a', { class: 'btn', href: r.wa, text: 'Chamar a Kari no WhatsApp' }),
        el('a', { class: 'btn btn-linha', href: r.link, text: 'Ver o serviço' })),
      el('button', { class: 'quiz-voltar', type: 'button', text: 'Refazer o quiz', onclick: () => { respostas.length = 0; indice = 0; trocar(telaPergunta); } }));
  }

  intro.hidden = true;
  app.hidden = false;
  trocar(telaPergunta);
})();
