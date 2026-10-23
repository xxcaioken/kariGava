// Painel do site da Kari: fotos do Instagram e do celular, ordem das fotos e textos dos serviços.
// Contrato da API em docs/API.md. Dados vindos da API ou do Instagram só entram na tela via textContent.

const $ = (s) => document.querySelector(s);
const enc = encodeURIComponent;

const MSG_REDE = 'Sem internet agora. Confira a conexão e tente de novo.';
const MSG_GERAL = 'Algo não deu certo. Tente de novo em alguns minutos.';
const MSG_DESLIGADO = 'Essa conta ainda não está ligada ao site. Peça para o Caio ligar.';
const LIMITE_TEXTO = 220;
const LIMITE_FOTO = 15 * 1024 * 1024;
const TELAS = ['tela-carregando', 'tela-falha', 'tela-email', 'tela-codigo', 'tela-inicio', 'tela-secao', 'tela-depoimentos', 'tela-pares', 'tela-faq'];

let estado = null;
let telaAtual = 'tela-carregando';
let secaoAtual = null;
let emailLogin = '';
let novidades = { status: 'carregando', posts: [], mensagem: '' };

// ---------- Utilidades ----------

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue;
    e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return e;
}

function plural(n, um, varios) { return `${n} ${n === 1 ? um : varios}`; }
function resumir(texto, max) {
  const t = (texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
function aplicarCor(elemento, cor) {
  if (/^#[0-9a-f]{3,8}$/i.test(cor || '')) elemento.style.setProperty('--cor', cor);
}
function mostrar(sel, texto) { const e = $(sel); if (texto !== undefined) e.textContent = texto; e.hidden = false; }
function esconder(sel) { $(sel).hidden = true; }
function ocupado(botao, texto) {
  if (!botao.dataset.textoOriginal) botao.dataset.textoOriginal = botao.textContent;
  botao.textContent = texto;
  botao.disabled = true;
}
function livre(botao) {
  if (botao.dataset.textoOriginal) { botao.textContent = botao.dataset.textoOriginal; delete botao.dataset.textoOriginal; }
  botao.disabled = false;
}

const avisoSr = el('div', { class: 'sr', 'aria-live': 'polite' });
document.body.append(avisoSr);
function anunciar(texto) { avisoSr.textContent = ''; setTimeout(() => { avisoSr.textContent = texto; }, 50); }

// ---------- API ----------

class ErroApi extends Error {
  constructor({ tipo, status = 0, erro = '', mensagem = '' }) {
    super(mensagem || erro || tipo);
    Object.assign(this, { tipo, status, erro, mensagem });
  }
}

async function api(caminho, { metodo = 'GET', json, form } = {}) {
  const opcoes = { method: metodo, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (json !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(json);
  } else if (form) {
    opcoes.body = form; // o navegador monta o multipart com o boundary
  }
  let res;
  try { res = await fetch(caminho, opcoes); } catch { throw new ErroApi({ tipo: 'rede', mensagem: MSG_REDE }); }
  let dados = null;
  try { dados = await res.json(); } catch { /* resposta sem JSON */ }
  if (res.status === 401 && caminho.startsWith('/api/painel/')) {
    irParaEmail();
    throw new ErroApi({ tipo: 'sessao', status: 401, erro: 'sem_sessao' });
  }
  if (!res.ok) {
    const mensagem = dados?.mensagem
      || (res.status === 413 ? 'Essa foto é grande demais. Escolha outra ou tire um print dela.' : MSG_GERAL);
    throw new ErroApi({ tipo: 'api', status: res.status, erro: dados?.erro || '', mensagem });
  }
  return dados ?? {};
}

function mensagemDe(e) { return e?.mensagem || MSG_GERAL; }

// ---------- Estado ----------

const secao = (id) => estado.secoes.find((s) => s.id === id);
const nomeSecao = (id) => secao(id)?.nome || id;
const itensDa = (id) => estado.itens.filter((i) => i.secao === id).sort((a, b) => a.ordem - b.ordem);
const contasLigadas = () => (estado.instagram?.contas || []).filter((c) => c.conectada);
const usuarioDaConta = (conta) => (estado.instagram?.contas || []).find((c) => c.conta === conta)?.usuario || '';

async function sincronizar() {
  try { estado = await api('/api/painel/estado'); } catch (e) { if (e.tipo === 'sessao') throw e; return; }
  renderAtual();
}

function renderAtual() {
  if (telaAtual === 'tela-inicio') { renderCartoes(); renderNovidades(); }
  if (telaAtual === 'tela-secao' && secaoAtual) renderSecao();
  if (telaAtual === 'tela-depoimentos') renderDepoimentos();
  if (telaAtual === 'tela-pares') renderPares();
  if (telaAtual === 'tela-faq') renderFaq();
}

// Marca nos posts guardados (novidades e grade) em que seção eles estão no site.
function marcarNoSite(conta, igId, secaoId, colocar) {
  if (!conta || !igId) return;
  const listas = [novidades.posts, ...Object.values(igCache).map((c) => c.posts)];
  for (const lista of listas) {
    for (const p of lista) {
      if (p.conta !== conta || p.ig_id !== igId) continue;
      const atual = new Set(p.no_site || []);
      if (colocar) atual.add(secaoId); else atual.delete(secaoId);
      p.no_site = [...atual];
    }
  }
}
function marcarItem(item, colocar) {
  if (item?.origem === 'instagram') marcarNoSite(item.ig_conta, item.ig_id, item.secao, colocar);
}

async function apagarItens(itens) {
  for (const item of itens) await api(`/api/painel/itens/${enc(item.id)}`, { metodo: 'DELETE', json: {} });
}

// ---------- Telas ----------

function mostrarTela(id, { foco } = {}) {
  for (const t of TELAS) $(`#${t}`).hidden = t !== id;
  telaAtual = id;
  const alvo = foco || $(`#${id}`).querySelector('[tabindex="-1"]');
  if (alvo) alvo.focus({ preventScroll: true });
}

function fecharTodosDialogos() {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
}

function irParaEmail() {
  fecharTodosDialogos();
  $('#toast-area').replaceChildren();
  estado = null;
  secaoAtual = null;
  esconder('#erro-email');
  mostrarTela('tela-email', { foco: $('#email') });
}

// ---------- Abrir ----------

const params = new URLSearchParams(location.search);
const instagramLigado = params.get('instagram') === 'ligado';
const instagramErro = params.get('instagram') === 'erro' ? (params.get('motivo') || 'Não deu para ligar o Instagram. Tente de novo.') : null;
if (params.has('instagram')) history.replaceState(null, '', location.pathname);

async function iniciar({ avisarInstagram = false } = {}) {
  mostrarTela('tela-carregando');
  try {
    estado = await api('/api/painel/estado');
  } catch (e) {
    if (e.tipo === 'sessao') return;
    $('#falha-texto').textContent = mensagemDe(e);
    mostrarTela('tela-falha');
    return;
  }
  irInicio();
  carregarNovidades();
  if (avisarInstagram) mostrarToast('Instagram ligado!');
  else if (instagramErro) mostrarToast(instagramErro);
}

$('#falha-tentar').addEventListener('click', () => iniciar());

// ---------- Login ----------

$('#form-email').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const email = $('#email').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    mostrar('#erro-email', email ? 'Esse e-mail parece incompleto. Confira se tem @ e o final, como .com' : 'Escreva seu e-mail para receber o código.');
    $('#email').focus();
    return;
  }
  await pedirCodigo(email, $('#btn-email'), '#erro-email', () => {
    emailLogin = email;
    $('#email-mostrado').textContent = email;
    $('#codigo').value = '';
    esconder('#erro-codigo');
    mostrarTela('tela-codigo', { foco: $('#codigo') });
  });
});

async function pedirCodigo(email, botao, erroSel, depois) {
  ocupado(botao, 'Enviando código...');
  try {
    await api('/api/login/codigo', { metodo: 'POST', json: { email } });
    esconder(erroSel);
    depois();
  } catch (e) {
    mostrar(erroSel, mensagemDe(e));
  } finally {
    livre(botao);
  }
}

$('#reenviar').addEventListener('click', () => pedirCodigo(emailLogin, $('#reenviar'), '#erro-codigo', () => {
  $('#codigo').value = '';
  $('#codigo').focus();
  anunciar('Mandamos um código novo para seu e-mail.');
  mostrar('#erro-codigo', 'Mandamos um código novo. Use o mais recente que chegou.');
  $('#erro-codigo').style.background = 'var(--verde-claro)';
  $('#erro-codigo').style.color = '#0B5129';
}));

$('#trocar-email').addEventListener('click', () => {
  esconder('#erro-email');
  mostrarTela('tela-email', { foco: $('#email') });
});

$('#codigo').addEventListener('input', () => {
  $('#erro-codigo').style.background = '';
  $('#erro-codigo').style.color = '';
});

$('#form-codigo').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const codigo = $('#codigo').value.replace(/\D/g, '');
  $('#erro-codigo').style.background = '';
  $('#erro-codigo').style.color = '';
  if (codigo.length !== 6) {
    mostrar('#erro-codigo', 'O código tem 6 números. Confira no seu e-mail e digite de novo.');
    $('#codigo').focus();
    return;
  }
  const botao = $('#btn-codigo');
  ocupado(botao, 'Entrando...');
  try {
    await api('/api/login/entrar', { metodo: 'POST', json: { email: emailLogin, codigo } });
    esconder('#erro-codigo');
    livre(botao);
    await iniciar({ avisarInstagram: instagramLigado });
  } catch (e) {
    mostrar('#erro-codigo', mensagemDe(e));
    $('#codigo').select();
    livre(botao);
  }
});

document.querySelectorAll('.btn-sair').forEach((b) => b.addEventListener('click', async () => {
  ocupado(b, 'Saindo...');
  try { await api('/api/login/sair', { metodo: 'POST', json: {} }); } catch { /* sai mesmo assim */ }
  livre(b);
  irParaEmail();
}));

// ---------- Início ----------

function irInicio({ focarSecao } = {}) {
  secaoAtual = null;
  const email = estado.usuario?.email || '';
  $('#ola').textContent = /kari/i.test(email) ? 'Oi, Kari!' : 'Oi!';
  renderCartoes();
  renderNovidades();
  const cartao = focarSecao && document.querySelector(`#cartoes [data-secao="${CSS.escape(focarSecao)}"]`);
  mostrarTela('tela-inicio', { foco: cartao || undefined });
  if (!cartao) window.scrollTo(0, 0);
}

function renderCartoes() {
  const caixa = $('#cartoes');
  caixa.replaceChildren();
  for (const s of estado.secoes) {
    const itens = itensDa(s.id);
    const miniaturas = el('span', { class: 'miniaturas' });
    if (itens.length) {
      itens.slice(0, 4).forEach((i) => miniaturas.append(el('img', { src: i.foto_url, alt: '', loading: 'lazy' })));
      if (itens.length > 4) miniaturas.append(el('span', { class: 'mais', text: `+${itens.length - 4}` }));
    } else {
      miniaturas.append(el('span', { class: 'sem', text: 'Ainda sem fotos. Toque para colocar.' }));
    }
    // Serviço mostra também o estado do preço (R-02), para a Kari ver de longe o que falta preencher.
    const preco = s.tipo === 'servico' ? estado.textos?.[s.id]?.preco : undefined;
    let linhaPreco = s.tipo === 'servico'
      ? el('span', { class: 'cartao-preco', text: preco ? `A partir de R$ ${preco.toLocaleString('pt-BR')}` : 'Sem preço no site' })
      : null;
    if (s.id === 'lalaia') {
      const lista = (estado.lalaia?.produtos || []).filter((p) => p.fotos.length);
      const semPreco = lista.filter((p) => !p.preco).length;
      const produtosTexto = lista.length ? `${plural(lista.length, 'produto', 'produtos')} · ${semPreco ? `${semPreco} sem preço` : 'todos com preço'}` : 'Nenhum produto ainda';
      linhaPreco = el('span', { class: 'cartao-preco', text: `${produtosTexto} · Cupom ${situacaoDoCupom(estado.lalaia?.cupom)}` });
    }
    // Fotos do Instagram que ainda não têm as versões leves (R-10): dá para gerar abrindo a parte e esperando "Otimizando".
    const semVersaoLeve = itens.filter((i) => i.origem === 'instagram' && !i.variantes).length;
    const cartao = el('button', { class: 'cartao', type: 'button', 'data-secao': s.id, onclick: () => abrirSecao(s.id) },
      el('span', { class: 'cartao-topo' },
        el('span', { class: 'cartao-nome', text: s.nome }),
        el('span', { class: 'qtd', text: plural(itens.length, 'foto', 'fotos') })),
      miniaturas,
      ...(linhaPreco ? [linhaPreco] : []),
      semVersaoLeve ? el('span', { class: 'cartao-preco', text: `${plural(semVersaoLeve, 'foto', 'fotos')} sem versão leve` }) : null,
      el('span', { class: 'ir', 'aria-hidden': 'true', text: 'Atualizar →' }));
    aplicarCor(cartao, s.cor);
    caixa.append(cartao);
  }
  // Depoimentos (R-04) não são fotos de seção: cartão próprio, com a própria tela.
  const deps = depoimentos();
  const cartaoDep = el('button', { class: 'cartao', type: 'button', 'data-secao': 'depoimentos', onclick: abrirDepoimentos },
    el('span', { class: 'cartao-topo' },
      el('span', { class: 'cartao-nome', text: 'Depoimentos' }),
      el('span', { class: 'qtd', text: plural(deps.length, 'depoimento', 'depoimentos') })),
    el('span', { class: 'cartao-preco', text: deps.length ? resumir(deps.map((d) => d.nome).join(', '), 60) : 'O que as clientes dizem de você. Toque para cadastrar o primeiro.' }),
    el('span', { class: 'ir', 'aria-hidden': 'true', text: 'Atualizar →' }));
  aplicarCor(cartaoDep, '#E5196E');
  caixa.append(cartaoDep);
  // Antes e depois (R-05): pares de fotos, com a própria tela.
  const ps = pares();
  const miniPares = el('span', { class: 'miniaturas' });
  if (ps.length) {
    ps.slice(0, 2).forEach((p) => miniPares.append(el('img', { src: p.antes_url, alt: '', loading: 'lazy' }), el('img', { src: p.depois_url, alt: '', loading: 'lazy' })));
    if (ps.length > 2) miniPares.append(el('span', { class: 'mais', text: `+${ps.length - 2}` }));
  } else {
    miniPares.append(el('span', { class: 'sem', text: 'Vitrines, looks e armários antes e depois da sua mão. Toque para cadastrar o primeiro par.' }));
  }
  const cartaoPar = el('button', { class: 'cartao', type: 'button', 'data-secao': 'antes-depois', onclick: abrirPares },
    el('span', { class: 'cartao-topo' },
      el('span', { class: 'cartao-nome', text: 'Antes e depois' }),
      el('span', { class: 'qtd', text: plural(ps.length, 'par', 'pares') })),
    miniPares,
    el('span', { class: 'ir', 'aria-hidden': 'true', text: 'Atualizar →' }));
  aplicarCor(cartaoPar, '#017F38');
  caixa.append(cartaoPar);
  // Perguntas frequentes (R-06).
  const fs = faqs();
  const publicadas = fs.filter((f) => f.publicada).length;
  const rascunhos = fs.filter((f) => !f.revisada).length;
  const cartaoFaq = el('button', { class: 'cartao', type: 'button', 'data-secao': 'faq', onclick: abrirFaq },
    el('span', { class: 'cartao-topo' },
      el('span', { class: 'cartao-nome', text: 'Perguntas frequentes' }),
      el('span', { class: 'qtd', text: plural(fs.length, 'pergunta', 'perguntas') })),
    el('span', { class: 'cartao-preco', text: fs.length ? `${publicadas} no site${rascunhos ? ` · ${plural(rascunhos, 'rascunho para revisar', 'rascunhos para revisar')}` : ''}` : 'Nenhuma pergunta ainda. Toque para escrever a primeira.' }),
    el('span', { class: 'ir', 'aria-hidden': 'true', text: 'Atualizar →' }));
  aplicarCor(cartaoFaq, '#2A2730');
  caixa.append(cartaoFaq);
}

async function carregarNovidades() {
  if (!estado) return;
  if (!contasLigadas().length) {
    novidades = { status: 'desligado', posts: [], mensagem: '' };
    renderNovidades();
    return;
  }
  novidades = { status: 'carregando', posts: [], mensagem: '' };
  renderNovidades();
  try {
    const r = await api('/api/painel/instagram/novidades');
    novidades = { status: 'ok', posts: r.posts || [], mensagem: '' };
  } catch (e) {
    if (e.tipo === 'sessao') return;
    novidades = { status: e.erro === 'instagram_desconectado' ? 'desligado' : 'erro', posts: [], mensagem: mensagemDe(e) };
  }
  if (telaAtual === 'tela-inicio') renderNovidades();
}

function cartaoDesligado(mensagem) {
  return el('div', { class: 'aviso-card' },
    el('p', { text: mensagem || MSG_DESLIGADO }),
    el('p', { text: 'Enquanto isso, você pode colocar fotos do celular em cada parte do site.' }));
}

function cartaoErro(mensagem, tentar) {
  return el('div', { class: 'aviso-card aviso-erro' },
    el('p', { text: mensagem || MSG_GERAL }),
    el('button', { class: 'btn btn-claro', type: 'button', text: 'Tentar de novo', onclick: tentar }));
}

function renderNovidades() {
  const caixa = $('#novidades');
  caixa.replaceChildren();
  if (novidades.status === 'carregando') {
    const faixa = el('div', { class: 'faixa', 'aria-busy': 'true' }, el('span', { class: 'sr', text: 'Carregando suas fotos...' }));
    for (let i = 0; i < 4; i++) faixa.append(el('div', { class: 'esqueleto', 'aria-hidden': 'true' }));
    caixa.append(faixa);
    return;
  }
  if (novidades.status === 'desligado') { caixa.append(cartaoDesligado(novidades.mensagem)); return; }
  if (novidades.status === 'erro') { caixa.append(cartaoErro(novidades.mensagem, carregarNovidades)); return; }
  if (!novidades.posts.length) {
    caixa.append(el('div', { class: 'vazio' }, el('p', { text: 'Ainda não apareceu nenhum post. Quando você postar no Instagram, ele aparece aqui.' })));
    return;
  }
  const variasContas = contasLigadas().length > 1;
  const faixa = el('div', { class: 'faixa' });
  for (const p of novidades.posts) {
    const noSite = (p.no_site || []).length > 0;
    faixa.append(el('button', {
      class: 'post', type: 'button',
      'aria-label': `${p.titulo_sugerido || 'Post do Instagram'}${noSite ? ', já está no site' : ''}`,
      onclick: () => abrirPublicar(p),
    },
    el('img', { src: p.foto_url, alt: '', loading: 'lazy' }),
    variasContas && el('span', { class: 'conta-etq', text: usuarioDaConta(p.conta) }),
    noSite && el('span', { class: 'etq', text: 'No site' })));
  }
  caixa.append(faixa);
}

// ---------- Publicar um post (folha inferior, 3 toques) ----------

let pubPost = null;
let pubSecao = null;

function abrirPublicar(post) {
  pubPost = post;
  const ja = post.no_site || [];
  pubSecao = post.conta === 'lalaia' && !ja.includes('lalaia') ? 'lalaia' : null;
  $('#pub-foto').src = post.foto_url;
  $('#pub-foto').alt = post.titulo_sugerido ? `Foto: ${post.titulo_sugerido}` : 'Foto do Instagram';
  const legenda = resumir(post.legenda, 140);
  $('#pub-legenda').textContent = legenda;
  $('#pub-legenda').hidden = !legenda;
  if (ja.length) mostrar('#pub-ja', `Essa foto já está no site em: ${ja.map(nomeSecao).join(', ')}.`);
  else esconder('#pub-ja');
  const chips = $('#pub-chips');
  chips.replaceChildren();
  for (const s of estado.secoes) {
    const jaEsta = ja.includes(s.id);
    chips.append(el('button', {
      class: 'chip', type: 'button', 'data-secao': s.id, disabled: jaEsta,
      'aria-pressed': jaEsta ? null : String(pubSecao === s.id),
      text: jaEsta ? `${s.nome} · já está` : s.nome,
      onclick: () => escolherChip(s.id),
    }));
  }
  $('#pub-nome').value = post.titulo_sugerido || '';
  esconder('#pub-erro');
  abrirDialogo('#dlg-publicar');
}

function escolherChip(id) {
  pubSecao = id;
  esconder('#pub-erro');
  document.querySelectorAll('#pub-chips .chip:not(:disabled)').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.secao === id));
  });
}

$('#pub-ok').addEventListener('click', async () => {
  if (!pubSecao) {
    mostrar('#pub-erro', 'Escolha onde a foto vai aparecer, tocando numa das opções acima.');
    return;
  }
  const botao = $('#pub-ok');
  const post = pubPost;
  const secaoId = pubSecao;
  ocupado(botao, 'Publicando...');
  try {
    const r = await api('/api/painel/itens', {
      metodo: 'POST',
      json: { secao: secaoId, titulo: $('#pub-nome').value.trim(), instagram: [{ conta: post.conta, ig_id: post.ig_id }] },
    });
    const criados = r.itens || [];
    fecharDialogo('#dlg-publicar');
    if (!criados.length) { mostrarToast(`Essa foto já estava em ${nomeSecao(secaoId)}.`); return; }
    criados.forEach((i) => marcarItem(i, true));
    marcarNoSite(post.conta, post.ig_id, secaoId, true);
    await sincronizar();
    mostrarToast(`Publicado no site em ${nomeSecao(secaoId)}`, {
      verSite: true,
      desfazer: async () => {
        await apagarItens(criados);
        criados.forEach((i) => marcarItem(i, false));
        marcarNoSite(post.conta, post.ig_id, secaoId, false);
        await sincronizar();
        mostrarToast('Pronto, a foto saiu do site');
      },
    });
  } catch (e) {
    if (e.tipo !== 'sessao') mostrar('#pub-erro', mensagemDe(e));
  } finally {
    livre(botao);
  }
});

// ---------- Uma parte do site ----------

function abrirSecao(id) {
  secaoAtual = id;
  const s = secao(id);
  $('#secao-titulo').textContent = s.nome;
  const ehServico = s.tipo === 'servico';
  $('#textos').hidden = !ehServico;
  if (ehServico) preencherTextos();
  $('#produtos').hidden = id !== 'lalaia';
  $('#condicoes').hidden = id !== 'lalaia';
  if (id === 'lalaia') preencherCondicoes();
  renderSecao();
  window.scrollTo(0, 0);
  mostrarTela('tela-secao');
  // Fotos do Instagram ainda sem versão leve (importação interrompida, ou anterior às versões) são otimizadas
  // em segundo plano ao abrir a parte; é o que zera o "N fotos sem versão leve" do cartão (review-r1 S-20).
  otimizarFotos(itensDa(id).filter((i) => i.origem === 'instagram'));
  // O "voltar" do celular volta para o início em vez de sair do painel.
  history.pushState({ secao: id }, '');
}

function sairDaSecao() {
  if ((textosMudaram() || condicoesMudaram()) && !confirm('Você mudou os textos e ainda não salvou. Quer voltar sem salvar?')) return false;
  irInicio({ focarSecao: secaoAtual });
  return true;
}

$('#voltar').addEventListener('click', () => {
  if (history.state?.secao) history.back(); // o popstate abaixo faz a volta
  else sairDaSecao();
});
$('#voltar-dep').addEventListener('click', () => {
  if (history.state?.secao) history.back();
  else irInicio({ focarSecao: 'depoimentos' });
});
$('#voltar-par').addEventListener('click', () => {
  if (history.state?.secao) history.back();
  else irInicio({ focarSecao: 'antes-depois' });
});
$('#voltar-faq').addEventListener('click', () => {
  if (history.state?.secao) history.back();
  else irInicio({ focarSecao: 'faq' });
});

const TELAS_PROPRIAS = { 'tela-depoimentos': 'depoimentos', 'tela-pares': 'antes-depois', 'tela-faq': 'faq' };
window.addEventListener('popstate', () => {
  if (TELAS_PROPRIAS[telaAtual]) {
    const cartao = TELAS_PROPRIAS[telaAtual];
    const aberto = document.querySelector('dialog[open]');
    if (aberto) { aberto.close(); history.pushState({ secao: cartao }, ''); return; }
    irInicio({ focarSecao: cartao });
    return;
  }
  if (telaAtual !== 'tela-secao') return;
  const aberto = document.querySelector('dialog[open]');
  if (aberto) { aberto.close(); history.pushState({ secao: secaoAtual }, ''); return; }
  if (!sairDaSecao()) history.pushState({ secao: secaoAtual }, '');
});

function renderSecao({ foco } = {}) {
  const s = secao(secaoAtual);
  const itens = itensDa(secaoAtual);
  const ehServico = s.tipo === 'servico';
  $('#secao-qtd').textContent = plural(itens.length, 'foto', 'fotos');
  if (itens.length >= 2) {
    mostrar('#secao-dica', ehServico
      ? 'A foto de cima é a principal do serviço. Use as setas para mudar a ordem.'
      : 'A foto de cima aparece primeiro. Use as setas para mudar a ordem.');
  } else {
    esconder('#secao-dica');
  }
  const lista = $('#secao-itens');
  lista.replaceChildren();
  if (!itens.length) {
    lista.append(el('div', { class: 'vazio' }, el('p', { text: 'Nenhuma foto aqui ainda. Use os botões acima para trazer do Instagram ou do celular.' })));
    return;
  }
  itens.forEach((item, idx) => {
    const nome = item.titulo || 'Sem nome';
    lista.append(el('div', { class: 'item' },
      el('img', { src: item.foto_url, alt: '', loading: 'lazy' }),
      el('button', { class: 'nome', type: 'button', 'aria-label': `${nome}. Mudar o nome`, onclick: () => abrirNome(item) },
        idx === 0 && ehServico && el('span', { class: 'principal', text: 'Foto principal' }),
        el('span', { text: nome }),
        el('small', { text: 'Mudar nome' })),
      el('div', { class: 'acoes-item' },
        el('button', { class: 'mini', type: 'button', 'data-id': item.id, 'data-dir': 'cima', disabled: idx === 0, 'aria-label': `Mostrar antes: ${nome}`, text: '↑', onclick: (ev) => mover(item, 'cima', ev.currentTarget) }),
        el('button', { class: 'mini', type: 'button', 'data-id': item.id, 'data-dir': 'baixo', disabled: idx === itens.length - 1, 'aria-label': `Mostrar depois: ${nome}`, text: '↓', onclick: (ev) => mover(item, 'baixo', ev.currentTarget) })),
      el('button', { class: 'tirar', type: 'button', text: 'Tirar do site', 'aria-label': `Tirar do site: ${nome}`, onclick: () => abrirTirar(item) })));
  });
  if (foco) {
    const mesma = lista.querySelector(`[data-id="${CSS.escape(foco.id)}"][data-dir="${foco.dir}"]`);
    const outra = lista.querySelector(`[data-id="${CSS.escape(foco.id)}"][data-dir="${foco.dir === 'cima' ? 'baixo' : 'cima'}"]`);
    (mesma && !mesma.disabled ? mesma : outra)?.focus();
  }
  if (secaoAtual === 'lalaia') renderProdutos();
}

// ---------- Produtos da LALAIÁ (R-03) ----------

const produtos = () => estado.lalaia?.produtos || [];
const produtoDaFoto = (item) => produtos().find((p) => p.fotos.some((f) => f.id === item.id));
const resumoProduto = (p) => {
  const partes = [plural(p.fotos.length, 'foto', 'fotos'), p.preco ? `R$ ${p.preco.toLocaleString('pt-BR')}` : 'sem preço'];
  if (p.disponibilidade === 'pronta') partes.push('pronta entrega');
  if (p.disponibilidade === 'encomenda') partes.push(p.prazo_dias ? `até ${p.prazo_dias} dias úteis` : 'sob encomenda');
  return partes.join(' · ');
};

function renderProdutos() {
  const lista = $('#lista-produtos');
  const abertos = new Set([...lista.querySelectorAll('details[open]')].map((d) => d.dataset.slug));
  lista.replaceChildren();
  const todos = produtos();
  if (!todos.length) {
    lista.append(el('div', { class: 'vazio' }, el('p', { text: 'Nenhum produto ainda. Coloque fotos da LALAIÁ com o nome da peça e elas viram produtos aqui.' })));
    return;
  }
  for (const p of todos) lista.append(cartaoProduto(p, abertos.has(p.slug)));
}

function cartaoProduto(p, aberto) {
  const erro = el('div', { class: 'erro', role: 'alert', hidden: true });
  const precoCampo = el('input', { id: `prod-preco-${p.slug}`, type: 'number', inputmode: 'numeric', min: 1, max: 99999, step: 1, placeholder: 'Ex.: 65', value: p.preco ?? '' });
  const dispCampo = el('select', { id: `prod-disp-${p.slug}` },
    el('option', { value: '', text: 'Não dizer' }),
    el('option', { value: 'pronta', text: 'Pronta entrega', selected: p.disponibilidade === 'pronta' }),
    el('option', { value: 'encomenda', text: 'Sob encomenda', selected: p.disponibilidade === 'encomenda' }));
  const prazoCampo = el('input', { id: `prod-prazo-${p.slug}`, type: 'number', inputmode: 'numeric', min: 1, max: 90, step: 1, placeholder: 'Ex.: 7', value: p.prazo_dias ?? '' });
  const prazoLabel = el('label', { class: 'campo', hidden: p.disponibilidade !== 'encomenda' }, el('span', { text: 'Prazo de produção (dias úteis)' }), prazoCampo);
  dispCampo.addEventListener('change', () => { prazoLabel.hidden = dispCampo.value !== 'encomenda'; });
  const descCampo = el('textarea', { id: `prod-desc-${p.slug}`, maxlength: 220, 'aria-describedby': `prod-cont-${p.slug}` });
  descCampo.value = p.descricao || '';
  const contador = el('span', { class: 'ajuda', id: `prod-cont-${p.slug}`, text: `${descCampo.value.length} de 220 letras` });
  descCampo.addEventListener('input', () => { contador.textContent = `${descCampo.value.length} de 220 letras`; contador.classList.toggle('passou', descCampo.value.length > 220); });

  const salvar = el('button', { class: 'btn btn-verde', type: 'submit', text: 'Salvar produto' });
  const form = el('form', { novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const precoTexto = precoCampo.value.trim();
    const preco = precoTexto ? Number(precoTexto) : null;
    const prazoTexto = prazoCampo.value.trim();
    const prazo = dispCampo.value === 'encomenda' && prazoTexto ? Number(prazoTexto) : null;
    if (preco !== null && (!Number.isInteger(preco) || preco < 1 || preco > 99999)) { mostrarErro(erro, 'O preço precisa ser um número inteiro, sem centavos, de 1 a 99.999. Deixe vazio para não mostrar.'); precoCampo.focus(); return; }
    if (prazo !== null && (!Number.isInteger(prazo) || prazo < 1 || prazo > 90)) { mostrarErro(erro, 'O prazo é em dias úteis, de 1 a 90.'); prazoCampo.focus(); return; }
    if (descCampo.value.trim().length > 220) { mostrarErro(erro, 'A descrição pode ter até 220 letras.'); descCampo.focus(); return; }
    ocupado(salvar, 'Salvando...');
    try {
      await api(`/api/painel/lalaia/produtos/${enc(p.slug)}`, { metodo: 'PUT', json: { preco, disponibilidade: dispCampo.value || null, prazo_dias: prazo, descricao: descCampo.value.trim() } });
      erro.hidden = true;
      await sincronizar();
      mostrarToast('Produto salvo', { verSite: true });
    } catch (e) {
      if (e.tipo !== 'sessao') mostrarErro(erro, mensagemDe(e));
    } finally {
      livre(salvar);
    }
  } },
    el('label', { class: 'campo' }, el('span', { text: 'Preço (R$, sem centavos)' }), precoCampo,
      el('span', { class: 'ajuda', text: 'Deixe vazio para não mostrar preço.' })),
    el('label', { class: 'campo' }, el('span', { text: 'Disponibilidade' }), dispCampo),
    prazoLabel,
    el('label', { class: 'campo' }, el('span', { text: 'Descrição curta' }), descCampo, contador),
    erro,
    salvar,
    el('button', { class: 'btn btn-claro', type: 'button', text: 'Renomear produto', onclick: () => renomearProduto(p) }));

  const det = el('details', { class: 'produto-edit', 'data-slug': p.slug, open: aberto },
    el('summary', {},
      el('span', { class: 'produto-nome', text: p.titulo || 'Sem nome' }),
      el('span', { class: 'produto-resumo', text: resumoProduto(p) })),
    form);
  return det;
}

function mostrarErro(div, texto) { div.textContent = texto; div.hidden = false; }

// Renomeia todas as fotos do produto e leva os dados junto (confirmação com a contagem, DES-20).
async function renomearProduto(p) {
  const nome = prompt('Novo nome do produto (vale para todas as fotos dele):', p.titulo || '');
  if (nome === null) return;
  const limpo = nome.replace(/\s+/g, ' ').trim();
  if (!limpo) { mostrarToast('O nome não pode ficar vazio.'); return; }
  if (limpo === p.titulo) return;
  if (!confirm(`Mover ${plural(p.fotos.length, 'foto', 'fotos')} para "${limpo}"?`)) return;
  try {
    await api(`/api/painel/lalaia/produtos/${enc(p.slug)}/renomear`, { metodo: 'POST', json: { nome: limpo } });
    await sincronizar();
    mostrarToast(`Produto renomeado para "${limpo}"`, { verSite: true });
  } catch (e) {
    if (e.tipo !== 'sessao') mostrarToast(mensagemDe(e));
  }
}

let movendo = false;
async function mover(item, direcao) {
  if (movendo) return;
  movendo = true;
  document.querySelectorAll('#secao-itens .mini').forEach((b) => { b.disabled = true; });
  try {
    const r = await api(`/api/painel/itens/${enc(item.id)}/mover`, { metodo: 'POST', json: { direcao } });
    estado.itens = estado.itens.filter((i) => i.secao !== secaoAtual).concat(r.itens || []);
    renderSecao({ foco: { id: item.id, dir: direcao } });
    anunciar(direcao === 'cima' ? 'Foto subiu na ordem.' : 'Foto desceu na ordem.');
  } catch (e) {
    renderSecao();
    if (e.tipo !== 'sessao') mostrarToast(mensagemDe(e), { erro: true });
  } finally {
    movendo = false;
  }
}

// Tirar do site (fotos e depoimentos usam o mesmo diálogo; muda o que é tirado e o que o desfazer faz)
let tirarPedido = null;
function abrirTirar(item) {
  abrirConfirmacaoTirar({
    titulo: 'Tirar essa foto do site?',
    texto: 'Ela some do site, mas continua no seu Instagram e no seu celular.',
    tirando: 'Tirando...',
    apagar: async () => { await api(`/api/painel/itens/${enc(item.id)}`, { metodo: 'DELETE', json: {} }); marcarItem(item, false); },
    saiu: 'A foto saiu do site',
    desfazer: async () => { await api(`/api/painel/itens/${enc(item.id)}/restaurar`, { metodo: 'POST', json: {} }); marcarItem(item, true); },
    voltou: 'Pronto, a foto voltou para o site',
    voltarFoco: $('#secao-titulo'),
  });
}
function abrirConfirmacaoTirar(pedido) {
  tirarPedido = pedido;
  $('#tirar-titulo').textContent = pedido.titulo;
  $('#tirar-texto').textContent = pedido.texto;
  esconder('#tirar-erro');
  abrirDialogo('#dlg-tirar', { voltarFoco: pedido.voltarFoco });
}

$('#tirar-sim').addEventListener('click', async () => {
  const botao = $('#tirar-sim');
  const p = tirarPedido;
  ocupado(botao, p.tirando);
  try {
    await p.apagar();
    fecharDialogo('#dlg-tirar');
    await sincronizar();
    mostrarToast(p.saiu, {
      desfazer: async () => {
        await p.desfazer();
        await sincronizar();
        mostrarToast(p.voltou);
      },
    });
  } catch (e) {
    if (e.tipo !== 'sessao') mostrar('#tirar-erro', mensagemDe(e));
  } finally {
    livre(botao);
  }
});

// Mudar o nome da foto
let nomeItem = null;
function abrirNome(item) {
  nomeItem = item;
  $('#nome-campo').value = item.titulo || '';
  esconder('#nome-erro');
  // Na LALAIÁ, fotos com o mesmo nome formam um produto: avisa que renomear uma só a tira do produto.
  const produto = item.secao === 'lalaia' ? produtoDaFoto(item) : null;
  if (produto && (produto.fotos.length > 1 || produto.preco != null || produto.disponibilidade || produto.descricao)) {
    mostrar('#nome-aviso', `Essa foto faz parte do produto "${produto.titulo}". Com outro nome ela sai do produto e vira um produto novo, sem preço. Para renomear o produto inteiro, use "Renomear produto" na lista de produtos.`);
  } else {
    esconder('#nome-aviso');
  }
  abrirDialogo('#dlg-nome');
  $('#nome-campo').focus();
  $('#nome-campo').select();
}

async function salvarNome() {
  const botao = $('#nome-ok');
  if (botao.disabled) return;
  ocupado(botao, 'Salvando...');
  try {
    await api(`/api/painel/itens/${enc(nomeItem.id)}`, { metodo: 'PATCH', json: { titulo: $('#nome-campo').value.trim() } });
    fecharDialogo('#dlg-nome');
    await sincronizar();
    mostrarToast('Nome salvo');
  } catch (e) {
    if (e.tipo !== 'sessao') mostrar('#nome-erro', mensagemDe(e));
  } finally {
    livre(botao);
  }
}
$('#nome-ok').addEventListener('click', salvarNome);
$('#nome-campo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); salvarNome(); } });

// ---------- Textos do serviço ----------

function preencherTextos() {
  const t = estado.textos?.[secaoAtual] || {};
  $('#txt-resumo').value = t.resumo || '';
  $('#txt-para').value = t.para_quem || '';
  $('#txt-preco').value = t.preco ?? '';
  esconder('#erro-textos');
  atualizarContadores();
}

// Campo vazio = sem preço (null). Qualquer outra coisa tem de ser inteiro em reais de 1 a 99.999.
function lerPrecoDoCampo() {
  const texto = $('#txt-preco').value.trim();
  if (!texto) return null;
  const n = Number(texto);
  if (!Number.isInteger(n) || n < 1 || n > 99999) return NaN;
  return n;
}

function textosMudaram() {
  if (telaAtual !== 'tela-secao' || $('#textos').hidden) return false;
  const t = estado?.textos?.[secaoAtual] || {};
  return $('#txt-resumo').value !== (t.resumo || '') || $('#txt-para').value !== (t.para_quem || '')
    || $('#txt-preco').value !== String(t.preco ?? '');
}

function atualizarContadores() {
  for (const [campo, contador] of [['#txt-resumo', '#cont-resumo'], ['#txt-para', '#cont-para']]) {
    const n = $(campo).value.length;
    const c = $(contador);
    c.textContent = `${n} de ${LIMITE_TEXTO} letras`;
    c.classList.toggle('passou', n > LIMITE_TEXTO);
  }
}
$('#txt-resumo').addEventListener('input', atualizarContadores);
$('#txt-para').addEventListener('input', atualizarContadores);

$('#form-textos').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const resumo = $('#txt-resumo').value.trim();
  const paraQuem = $('#txt-para').value.trim();
  if (!resumo) { mostrar('#erro-textos', 'Escreva a frase de apresentação do serviço.'); $('#txt-resumo').focus(); return; }
  if (resumo.length > LIMITE_TEXTO || paraQuem.length > LIMITE_TEXTO) {
    mostrar('#erro-textos', `Cada texto pode ter até ${LIMITE_TEXTO} letras.`);
    return;
  }
  const preco = lerPrecoDoCampo();
  if (Number.isNaN(preco)) {
    mostrar('#erro-textos', 'O preço precisa ser um número inteiro, sem centavos, de 1 a 99.999. Deixe vazio para não mostrar.');
    $('#txt-preco').focus();
    return;
  }
  const botao = $('#salvar-textos');
  const id = secaoAtual;
  ocupado(botao, 'Salvando...');
  try {
    const r = await api(`/api/painel/textos/${enc(id)}`, { metodo: 'PUT', json: { resumo, para_quem: paraQuem, preco } });
    estado.textos = { ...(estado.textos || {}), [id]: r.textos || { resumo, para_quem: paraQuem, preco } };
    renderCartoes();
    esconder('#erro-textos');
    if (secaoAtual === id) preencherTextos();
    mostrarToast('Alterações salvas', { verSite: true });
  } catch (e) {
    if (e.tipo !== 'sessao') mostrar('#erro-textos', mensagemDe(e));
  } finally {
    livre(botao);
  }
});

// ---------- Como encomendar: condições da LALAIÁ (R-03) ----------

const CAMPOS_CONDICOES = [
  ['pagamento', '#cond-pagamento', '#cont-cond-pagamento'],
  ['frete', '#cond-frete', '#cont-cond-frete'],
  ['prazo_padrao', '#cond-prazo', '#cont-cond-prazo'],
  ['troca', '#cond-troca', '#cont-cond-troca'],
];
const condicoesAtuais = () => estado?.lalaia?.condicoes || {};
const cupomAtual = () => estado?.lalaia?.cupom || { ativo: false, codigo: '', desconto: null, valido_ate: '' };

// Hoje no formato AAAA-MM-DD do celular da Kari, para comparar com `valido_ate` como texto.
function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dataCurta = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// "ligado", "desligado" ou "vencido em dd/mm", para o cartão em "Partes do site".
function situacaoDoCupom(c) {
  if (!c?.ativo) return 'desligado';
  if (c.valido_ate && c.valido_ate < hojeLocal()) return `vencido em ${dataCurta(c.valido_ate)}`;
  return 'ligado';
}

function preencherCondicoes() {
  const c = condicoesAtuais();
  for (const [campo, sel] of CAMPOS_CONDICOES) $(sel).value = c[campo] || '';
  $('#cond-gbp').value = c.gbp_url || '';
  const cupom = cupomAtual();
  $('#cupom-ativo').checked = Boolean(cupom.ativo);
  $('#cupom-codigo').value = cupom.codigo || '';
  $('#cupom-desconto').value = cupom.desconto ?? '';
  $('#cupom-validade').value = cupom.valido_ate || '';
  esconder('#erro-condicoes');
  atualizarContadoresCondicoes();
}

function cupomDoFormulario() {
  const codigo = $('#cupom-codigo').value.trim().toUpperCase();
  const desconto = $('#cupom-desconto').value.trim();
  return { ativo: $('#cupom-ativo').checked, codigo: codigo || null, desconto: desconto ? Number(desconto) : null, valido_ate: $('#cupom-validade').value || null };
}

function atualizarContadoresCondicoes() {
  for (const [, sel, cont] of CAMPOS_CONDICOES) {
    const n = $(sel).value.length;
    const c = $(cont);
    c.textContent = `${n} de ${LIMITE_TEXTO} letras`;
    c.classList.toggle('passou', n > LIMITE_TEXTO);
  }
}
for (const [, sel] of CAMPOS_CONDICOES) $(sel).addEventListener('input', atualizarContadoresCondicoes);

function condicoesMudaram() {
  if (telaAtual !== 'tela-secao' || $('#condicoes').hidden) return false;
  const c = condicoesAtuais();
  const cupom = cupomAtual();
  const f = cupomDoFormulario();
  return CAMPOS_CONDICOES.some(([campo, sel]) => $(sel).value !== (c[campo] || '')) || $('#cond-gbp').value !== (c.gbp_url || '')
    || f.ativo !== Boolean(cupom.ativo) || (f.codigo || '') !== (cupom.codigo || '') || f.desconto !== (cupom.desconto ?? null) || (f.valido_ate || '') !== (cupom.valido_ate || '');
}

$('#form-condicoes').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const corpo = {};
  for (const [campo, sel] of CAMPOS_CONDICOES) corpo[campo] = $(sel).value.trim() || null;
  if (CAMPOS_CONDICOES.some(([campo]) => (corpo[campo] || '').length > LIMITE_TEXTO)) {
    mostrar('#erro-condicoes', `Cada condição pode ter até ${LIMITE_TEXTO} letras.`);
    return;
  }
  const gbp = $('#cond-gbp').value.trim();
  if (gbp && !/^https:\/\/\S+\.\S+/i.test(gbp)) {
    mostrar('#erro-condicoes', 'Cole o link do seu perfil no Google (começa com https://).');
    $('#cond-gbp').focus();
    return;
  }
  corpo.gbp_url = gbp || null;
  corpo.cupom = cupomDoFormulario();
  if (corpo.cupom.ativo && (!corpo.cupom.codigo || !corpo.cupom.desconto)) {
    mostrar('#erro-condicoes', 'Para ligar o cupom, preencha o código e o desconto.');
    $(corpo.cupom.codigo ? '#cupom-desconto' : '#cupom-codigo').focus();
    return;
  }
  if (corpo.cupom.codigo && !/^[A-Z0-9]{1,20}$/.test(corpo.cupom.codigo)) {
    mostrar('#erro-condicoes', 'O código do cupom tem até 20 letras ou números, sem espaços nem acentos.');
    $('#cupom-codigo').focus();
    return;
  }
  const botao = $('#salvar-condicoes');
  ocupado(botao, 'Salvando...');
  try {
    const r = await api('/api/painel/lalaia/condicoes', { metodo: 'PUT', json: corpo });
    estado.lalaia = { ...(estado.lalaia || {}), condicoes: r.condicoes, cupom: r.cupom };
    renderCartoes();
    esconder('#erro-condicoes');
    if (secaoAtual === 'lalaia') preencherCondicoes();
    mostrarToast('Condições salvas', { verSite: true });
  } catch (e) {
    if (e.tipo !== 'sessao') mostrar('#erro-condicoes', mensagemDe(e));
  } finally {
    livre(botao);
  }
});

// ---------- Trazer do Instagram (várias de uma vez) ----------

let igCache = {};
let igConta = null;
let igSel = [];

$('#abrir-instagram').addEventListener('click', abrirInstagram);

function abrirInstagram() {
  const s = secao(secaoAtual);
  $('#ig-titulo').textContent = `Fotos para ${s.nome}`;
  igCache = {};
  igSel = [];
  esconder('#ig-erro');
  atualizarContador();
  const contas = contasLigadas();
  if (!contas.length) {
    igConta = null;
    $('#ig-contas').replaceChildren();
    $('#ig-contas').hidden = true;
    $('#ig-area').replaceChildren(el('div', { class: 'aviso-card', style: 'margin:16px' },
      el('p', { text: MSG_DESLIGADO }),
      el('p', { text: 'Enquanto isso, use o botão "+ Foto do celular".' })));
  } else {
    $('#ig-contas').hidden = false;
    const preferida = s.id === 'lalaia' ? contas.find((c) => c.conta === 'lalaia') : contas.find((c) => c.conta === 'kari');
    igConta = (preferida || contas[0]).conta;
    renderAbas();
    selecionarConta(igConta);
  }
  abrirDialogo('#dlg-instagram', { voltarFoco: $('#abrir-instagram') });
}

function renderAbas() {
  const caixa = $('#ig-contas');
  caixa.replaceChildren();
  for (const c of contasLigadas()) {
    caixa.append(el('button', {
      class: 'conta', type: 'button', role: 'tab', id: `aba-${c.conta}`, 'data-conta': c.conta,
      'aria-selected': String(c.conta === igConta), 'aria-controls': 'ig-area', tabindex: c.conta === igConta ? '0' : '-1',
      text: c.usuario || c.conta, onclick: () => selecionarConta(c.conta),
    }));
  }
}

$('#ig-contas').addEventListener('keydown', (ev) => {
  if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
  const abas = [...document.querySelectorAll('#ig-contas .conta')];
  const i = abas.findIndex((a) => a.dataset.conta === igConta);
  const prox = abas[(i + (ev.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length];
  if (prox) { selecionarConta(prox.dataset.conta); prox.focus(); }
});

function selecionarConta(conta) {
  igConta = conta;
  document.querySelectorAll('#ig-contas .conta').forEach((a) => {
    const sel = a.dataset.conta === conta;
    a.setAttribute('aria-selected', String(sel));
    a.tabIndex = sel ? 0 : -1;
  });
  $('#ig-area').setAttribute('aria-labelledby', `aba-${conta}`);
  if (!igCache[conta]) carregarPagina(conta);
  else renderGrade();
}

async function carregarPagina(conta, { mais = false } = {}) {
  const c = igCache[conta] || (igCache[conta] = { posts: [], depois: null, status: 'vazio', mensagem: '', carregandoMais: false, erroMais: '' });
  if (mais) { c.carregandoMais = true; c.erroMais = ''; } else { c.status = 'carregando'; }
  if (igConta === conta) renderGrade();
  try {
    const q = new URLSearchParams({ conta });
    if (mais && c.depois) q.set('depois', c.depois);
    const r = await api(`/api/painel/instagram?${q}`);
    c.posts = mais ? c.posts.concat(r.posts || []) : (r.posts || []);
    c.depois = r.depois || null;
    c.status = 'ok';
  } catch (e) {
    if (e.tipo === 'sessao') return;
    if (mais) c.erroMais = mensagemDe(e);
    else { c.status = e.erro === 'instagram_desconectado' ? 'desligado' : 'erro'; c.mensagem = mensagemDe(e); }
  } finally {
    c.carregandoMais = false;
  }
  if (igConta === conta && $('#dlg-instagram').open) renderGrade({ manterFocoMais: mais });
}

const chaveDe = (p) => `${p.conta}:${p.ig_id}`;

function renderGrade({ manterFocoMais = false } = {}) {
  const area = $('#ig-area');
  const c = igCache[igConta];
  area.replaceChildren();
  if (!c || c.status === 'carregando') {
    area.append(el('p', { class: 'carregando-texto', 'aria-busy': 'true', text: 'Carregando suas fotos...' }));
    return;
  }
  if (c.status === 'desligado') { area.append(el('div', { style: 'padding:16px' }, cartaoDesligado(c.mensagem))); return; }
  if (c.status === 'erro') { area.append(el('div', { style: 'padding:16px' }, cartaoErro(c.mensagem, () => carregarPagina(igConta)))); return; }
  if (!c.posts.length) {
    area.append(el('div', { class: 'vazio', style: 'margin:16px' }, el('p', { text: 'Essa conta ainda não tem posts.' })));
    return;
  }
  const grade = el('div', { class: 'grade' });
  for (const p of c.posts) grade.append(botaoPostGrade(p));
  area.append(grade);
  if (c.depois || c.erroMais) {
    const rodape = el('div', { class: 'mais-fotos' });
    if (c.erroMais) rodape.append(el('div', { class: 'erro', role: 'alert', text: c.erroMais }));
    if (c.depois) {
      const mais = el('button', {
        class: 'btn btn-claro', type: 'button', id: 'ig-mais', disabled: c.carregandoMais,
        text: c.carregandoMais ? 'Carregando mais fotos...' : 'Ver mais fotos',
        onclick: () => carregarPagina(igConta, { mais: true }),
      });
      rodape.append(mais);
      if (manterFocoMais) mais.focus();
    }
    area.append(rodape);
  }
  atualizarMarcas();
}

function botaoPostGrade(p) {
  const jaAqui = (p.no_site || []).includes(secaoAtual);
  const emOutra = !jaAqui && (p.no_site || []).length > 0;
  const nome = p.titulo_sugerido || 'Post do Instagram';
  return el('button', {
    class: 'post', type: 'button', 'data-chave': chaveDe(p), disabled: jaAqui,
    'aria-pressed': jaAqui ? null : 'false',
    'aria-label': `${nome}${jaAqui ? ', já está aqui' : emOutra ? ', já está em outra parte do site' : ''}`,
    onclick: () => alternarSelecao(p),
  },
  el('img', { src: p.foto_url, alt: '', loading: 'lazy' }),
  jaAqui && el('span', { class: 'etq etq-aqui', text: 'Já está aqui' }),
  emOutra && el('span', { class: 'etq', text: 'No site' }),
  !jaAqui && el('span', { class: 'marca-sel', 'aria-hidden': 'true' }));
}

function alternarSelecao(p) {
  const chave = chaveDe(p);
  const i = igSel.findIndex((s) => s.chave === chave);
  if (i >= 0) igSel.splice(i, 1);
  else igSel.push({ chave, conta: p.conta, ig_id: p.ig_id });
  esconder('#ig-erro');
  atualizarMarcas();
  atualizarContador();
}

function atualizarMarcas() {
  document.querySelectorAll('#ig-area .post[data-chave]').forEach((b) => {
    if (b.disabled) return;
    const pos = igSel.findIndex((s) => s.chave === b.dataset.chave);
    b.setAttribute('aria-pressed', String(pos >= 0));
    const marca = b.querySelector('.marca-sel');
    if (marca) marca.textContent = pos >= 0 ? String(pos + 1) : '';
  });
}

function atualizarContador() {
  const n = igSel.length;
  $('#ig-contador').textContent = n === 0 ? 'Toque nas fotos que você quer colocar' : n === 1 ? '1 foto escolhida' : `${n} fotos escolhidas`;
  const botao = $('#ig-adicionar');
  if (botao.dataset.textoOriginal) return; // enviando
  botao.disabled = n === 0;
  botao.textContent = n === 0 ? 'Adicionar fotos' : n === 1 ? 'Adicionar 1 foto' : `Adicionar ${n} fotos`;
}

$('#ig-adicionar').addEventListener('click', async () => {
  const n = igSel.length;
  if (!n) return;
  const botao = $('#ig-adicionar');
  const secaoId = secaoAtual;
  ocupado(botao, n === 1 ? 'Trazendo 1 foto...' : `Trazendo ${n} fotos...`);
  try {
    const r = await api('/api/painel/itens', {
      metodo: 'POST',
      json: { secao: secaoId, instagram: igSel.map(({ conta, ig_id }) => ({ conta, ig_id })) },
    });
    const criados = r.itens || [];
    livre(botao);
    fecharDialogo('#dlg-instagram');
    criados.forEach((i) => marcarItem(i, true));
    await sincronizar();
    const qtd = criados.length;
    if (!qtd) { mostrarToast(n === 1 ? 'Essa foto já estava aqui.' : 'Essas fotos já estavam aqui.'); return; }
    mostrarToast(qtd === 1 ? '1 foto colocada no site' : `${qtd} fotos colocadas no site`, {
      verSite: true,
      desfazer: async () => {
        await apagarItens(criados);
        criados.forEach((i) => marcarItem(i, false));
        await sincronizar();
        mostrarToast(qtd === 1 ? 'Pronto, a foto saiu do site' : 'Pronto, as fotos saíram do site');
      },
    });
    otimizarFotos(criados); // em segundo plano; a foto já está no site
  } catch (e) {
    livre(botao);
    if (e.tipo !== 'sessao') mostrar('#ig-erro', mensagemDe(e));
  } finally {
    atualizarContador();
  }
});

// ---------- Foto do celular ----------

let celArquivo = null;
let celUrl = null;

$('#abrir-celular').addEventListener('click', () => { $('#arquivo').value = ''; $('#arquivo').click(); });
$('#cel-outra').addEventListener('click', () => { $('#arquivo').value = ''; $('#arquivo').click(); });

$('#arquivo').addEventListener('change', () => {
  const arquivo = $('#arquivo').files?.[0];
  if (!arquivo) return;
  const pareceFoto = (arquivo.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name || '');
  const aberto = $('#dlg-celular').open;
  const avisar = (msg) => (aberto ? mostrar('#cel-erro', msg) : mostrarToast(msg, { erro: true }));
  if (!pareceFoto) { avisar('Esse arquivo não é uma foto. Escolha uma foto da galeria.'); return; }
  if (arquivo.size > LIMITE_FOTO) { avisar('Essa foto é grande demais. Escolha outra ou tire um print dela.'); return; }
  celArquivo = arquivo;
  if (celUrl) URL.revokeObjectURL(celUrl);
  celUrl = URL.createObjectURL(arquivo);
  const previa = $('#cel-previa');
  previa.hidden = false;
  esconder('#cel-sem-previa');
  previa.onerror = () => { previa.hidden = true; mostrar('#cel-sem-previa'); };
  previa.src = celUrl;
  esconder('#cel-erro');
  $('#cel-titulo').textContent = `Foto para ${nomeSecao(secaoAtual)}`;
  if (!aberto) {
    $('#cel-nome').value = '';
    abrirDialogo('#dlg-celular', { voltarFoco: $('#abrir-celular') });
  }
});

$('#dlg-celular').addEventListener('close', () => {
  if (celUrl) { URL.revokeObjectURL(celUrl); celUrl = null; }
  $('#cel-previa').removeAttribute('src');
  celArquivo = null;
});

// Foto de celular chega com 3 a 8 MB; o site só precisa de 1600 px no lado maior (480 px para o avatar do depoimento).
// Também endireita fotos tiradas com o celular de lado (orientação EXIF).
// Devolve { arquivo, largura, altura }; largura/altura ficam null quando o navegador não lê o formato (o servidor explica o que fazer).
const LADO_MAXIMO = 1600;
async function reduzirFoto(arquivo, ladoMaximo = LADO_MAXIMO) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    return { arquivo, largura: null, altura: null };
  }
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const original = { largura: bitmap.width, altura: bitmap.height };
  bitmap.close();
  const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.85));
  if (blob && (blob.size < arquivo.size || escala < 1)) return { arquivo: blob, largura: canvas.width, altura: canvas.height };
  return { arquivo, ...original };
}

// ---------- Versões leves das fotos (R-10) ----------
// O Worker não redimensiona (plano Free): o navegador gera 480/960/1600 px (só as menores que a original, mais a
// original) em JPEG e, quando o navegador souber, WebP. Em falha, a foto publica do mesmo jeito, sem versões.
const LARGURAS_VARIANTES = [480, 960, 1600];
const TEMPO_MAXIMO_VARIANTES = 20000;
let suporteWebp = null;

async function navegadorGeraWebp() {
  if (suporteWebp !== null) return suporteWebp;
  const c = document.createElement('canvas');
  c.width = 2; c.height = 2;
  const b = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.8));
  suporteWebp = Boolean(b && b.type === 'image/webp'); // Safari antigo devolve PNG, não null
  return suporteWebp;
}

function largurasDasVariantes(largura) {
  const teto = Math.min(largura, LARGURAS_VARIANTES[LARGURAS_VARIANTES.length - 1]);
  return [...LARGURAS_VARIANTES.filter((w) => w < teto), teto];
}

const comTempo = (promessa, ms) => Promise.race([promessa, new Promise((_, falha) => setTimeout(() => falha(new Error('tempo esgotado')), ms))]);

// Devolve { largura, altura, campos: [[nome, blob]...], webp }. largura/altura são da original já endireitada (EXIF).
async function gerarVariantes(arquivo) {
  try {
    return await comTempo((async () => {
      const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
      const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
      const largura = Math.round(bitmap.width * escala);
      const altura = Math.round(bitmap.height * escala);
      const webp = await navegadorGeraWebp();
      const campos = [];
      for (const w of largurasDasVariantes(largura)) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = Math.max(1, Math.round(altura * (w / largura)));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const jpg = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
        if (!jpg) throw new Error('toBlob jpeg nulo');
        campos.push([`${w}.jpg`, jpg]);
        if (webp) {
          const wb = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', 0.8));
          if (wb && wb.type === 'image/webp') campos.push([`${w}.webp`, wb]);
        }
      }
      bitmap.close();
      return { largura, altura, campos, webp };
    })(), TEMPO_MAXIMO_VARIANTES);
  } catch (e) {
    console.warn('não deu para gerar as versões leves; a foto vai sem elas', e);
    return { largura: null, altura: null, campos: [], webp: false };
  }
}

function anexarVariantes(form, v) {
  if (v.largura && v.altura) { form.append('largura', String(v.largura)); form.append('altura', String(v.altura)); }
  for (const [nome, blob] of v.campos) form.append(nome, blob, nome);
}

// Compara o que o servidor gravou com o que foi mandado: alguma versão ficou de fora?
function faltouVariante(item, v) {
  if (!v.campos.length) return false;
  const esperadas = v.campos.filter(([n]) => n.endsWith('.jpg')).map(([n]) => Number(n.split('.')[0]));
  const tem = item?.variantes?.larguras || [];
  const faltaJpg = esperadas.some((w) => !tem.includes(w));
  const mandouWebp = v.campos.some(([n]) => n.endsWith('.webp'));
  return faltaJpg || (mandouWebp && !item?.variantes?.webp);
}

async function enviarVariantes(item, v) {
  if (!v.campos.length) return item;
  const form = new FormData();
  anexarVariantes(form, v);
  const r = await api(`/api/painel/itens/${enc(item.id)}/variantes`, { metodo: 'POST', form });
  return r.item;
}

function avisarVariantesFaltando(item, v) {
  mostrarToast('Foto publicada; algumas versões leves não subiram. Toque para tentar de novo.', {
    acao: { texto: 'Tentar de novo', aoTocar: async () => { const novo = await enviarVariantes(item, v); await sincronizar(); if (faltouVariante(novo, v)) avisarVariantesFaltando(novo, v); else mostrarToast('Pronto, versões leves no ar'); } },
  });
}

// Fotos vindas do Instagram chegam só no tamanho original: o painel baixa cada uma (mesma origem), gera as versões
// e manda em segundo plano, uma por vez, com progresso. Falha numa foto não para as outras nem vira erro.
let otimizando = false; // uma rodada por vez: abrir e fechar partes rápido não dispara envios duplicados
async function otimizarFotos(itens) {
  const lista = itens.filter((i) => !i.variantes);
  if (!lista.length || otimizando) return;
  otimizando = true;
  try { await otimizarLista(lista); } finally { otimizando = false; }
}

async function otimizarLista(lista) {
  const status = $('#otimizando');
  let n = 0;
  for (const item of lista) {
    n += 1;
    status.textContent = `Otimizando fotos… ${n} de ${lista.length}`;
    status.hidden = false;
    try {
      const resposta = await fetch(item.foto_url, { credentials: 'same-origin' });
      if (!resposta.ok) throw new Error(`foto ${resposta.status}`);
      const v = await gerarVariantes(await resposta.blob());
      await enviarVariantes(item, v);
    } catch (e) {
      console.warn('não deu para otimizar a foto', item.id, e);
    }
  }
  status.hidden = true;
  await sincronizar();
}

$('#cel-ok').addEventListener('click', async () => {
  if (!celArquivo) { mostrar('#cel-erro', 'Escolha uma foto da galeria primeiro.'); return; }
  const botao = $('#cel-ok');
  ocupado(botao, 'Preparando foto...');
  const [{ arquivo: foto }, variantes] = await Promise.all([reduzirFoto(celArquivo), gerarVariantes(celArquivo)]);
  const form = new FormData();
  form.append('secao', secaoAtual);
  form.append('titulo', $('#cel-nome').value.trim());
  form.append('foto', foto, foto === celArquivo ? (celArquivo.name || 'foto.jpg') : 'foto.jpg');
  anexarVariantes(form, variantes);
  botao.textContent = 'Enviando...';
  try {
    const r = await api('/api/painel/itens', { metodo: 'POST', form });
    const criados = r.itens || [];
    livre(botao);
    fecharDialogo('#dlg-celular');
    await sincronizar();
    if (faltouVariante(criados[0], variantes)) { avisarVariantesFaltando(criados[0], variantes); return; }
    mostrarToast('Foto colocada no site', {
      verSite: true,
      desfazer: async () => {
        await apagarItens(criados);
        await sincronizar();
        mostrarToast('Pronto, a foto saiu do site');
      },
    });
  } catch (e) {
    livre(botao);
    if (e.tipo !== 'sessao') mostrar('#cel-erro', mensagemDe(e));
  }
});

// ---------- Depoimentos (R-04) ----------

const depoimentos = () => estado?.depoimentos || [];
const LIMITE_DEPOIMENTO = 400;
const LADO_AVATAR = 480;
let depEditando = null;   // depoimento em edição (null = novo)
let depArquivo = null;    // foto escolhida (File)
let depUrl = null;

function abrirDepoimentos() {
  secaoAtual = null;
  renderDepoimentos();
  window.scrollTo(0, 0);
  mostrarTela('tela-depoimentos');
  history.pushState({ secao: 'depoimentos' }, '');
}

function renderDepoimentos({ foco } = {}) {
  const lista = depoimentos();
  $('#dep-qtd').textContent = plural(lista.length, 'depoimento', 'depoimentos');
  $('#dep-dica').hidden = lista.length < 2;
  const caixa = $('#dep-lista');
  caixa.replaceChildren();
  if (!lista.length) {
    caixa.append(el('div', { class: 'vazio' }, el('p', { text: 'Nenhum depoimento ainda. Toque em "Novo depoimento" para cadastrar o primeiro.' })));
    return;
  }
  lista.forEach((d, idx) => {
    const servico = d.servico ? nomeSecao(d.servico) : '';
    const avatar = d.foto_url
      ? el('img', { src: d.foto_url, alt: '', loading: 'lazy' })
      : el('span', { class: 'dep-inicial', 'aria-hidden': 'true', text: [...(d.nome || '?')][0].toUpperCase() });
    const cartao = el('div', { class: 'item dep' },
      avatar,
      el('button', { class: 'nome', type: 'button', 'aria-label': `${d.nome}. Editar`, onclick: () => abrirDepoimento(d) },
        el('span', { text: d.nome + (d.de_onde ? `, ${d.de_onde}` : '') }),
        el('em', { text: resumir(d.texto, 90) }),
        servico && el('small', { text: servico })),
      el('div', { class: 'acoes-item' },
        el('button', { class: 'mini', type: 'button', 'data-id': d.id, 'data-dir': 'cima', disabled: idx === 0, 'aria-label': `Mostrar antes: ${d.nome}`, text: '↑', onclick: (ev) => moverDepoimento(d, 'cima', ev.currentTarget) }),
        el('button', { class: 'mini', type: 'button', 'data-id': d.id, 'data-dir': 'baixo', disabled: idx === lista.length - 1, 'aria-label': `Mostrar depois: ${d.nome}`, text: '↓', onclick: (ev) => moverDepoimento(d, 'baixo', ev.currentTarget) })),
      el('button', { class: 'editar', type: 'button', text: 'Editar', 'aria-label': `Editar: ${d.nome}`, onclick: () => abrirDepoimento(d) }),
      el('button', { class: 'tirar', type: 'button', text: 'Tirar do site', 'aria-label': `Tirar do site: ${d.nome}`, onclick: () => tirarDepoimento(d) }));
    aplicarCor(cartao, secao(d.servico)?.cor || '#E5196E');
    caixa.append(cartao);
  });
  if (foco) {
    const mesma = caixa.querySelector(`[data-id="${CSS.escape(foco.id)}"][data-dir="${foco.dir}"]`);
    const outra = caixa.querySelector(`[data-id="${CSS.escape(foco.id)}"][data-dir="${foco.dir === 'cima' ? 'baixo' : 'cima'}"]`);
    (mesma && !mesma.disabled ? mesma : outra)?.focus();
  }
}

async function moverDepoimento(d, direcao, botao) {
  botao.disabled = true;
  try {
    const r = await api(`/api/painel/depoimentos/${enc(d.id)}/mover`, { metodo: 'POST', json: { direcao } });
    estado.depoimentos = r.depoimentos || estado.depoimentos;
    renderDepoimentos({ foco: { id: d.id, dir: direcao } });
    anunciar(`${d.nome} agora aparece ${direcao === 'cima' ? 'antes' : 'depois'}.`);
  } catch (e) {
    botao.disabled = false;
    if (e.tipo !== 'sessao') mostrarToast(mensagemDe(e), { erro: true });
  }
}

function tirarDepoimento(d) {
  abrirConfirmacaoTirar({
    titulo: `Tirar o depoimento de ${d.nome} do site?`,
    texto: 'Ele some do site. Dá para desfazer logo em seguida.',
    tirando: 'Tirando...',
    apagar: () => api(`/api/painel/depoimentos/${enc(d.id)}`, { metodo: 'DELETE', json: {} }),
    saiu: 'O depoimento saiu do site',
    desfazer: () => api(`/api/painel/depoimentos/${enc(d.id)}/restaurar`, { metodo: 'POST', json: {} }),
    voltou: 'Pronto, o depoimento voltou para o site',
    voltarFoco: $('#dep-titulo'),
  });
}

function preencherServicos() {
  const sel = $('#dep-servico');
  sel.replaceChildren(el('option', { value: '', text: 'Sem serviço' }));
  for (const s of estado.secoes.filter((x) => x.tipo === 'servico')) sel.append(el('option', { value: s.id, text: s.nome }));
}

function limparFotoDep() {
  if (depUrl) { URL.revokeObjectURL(depUrl); depUrl = null; }
  depArquivo = null;
  $('#dep-arquivo').value = '';
  const previa = $('#dep-previa');
  previa.removeAttribute('src');
  previa.hidden = true;
  $('#dep-sem-foto').hidden = true;
  $('#dep-escolher').textContent = 'Escolher foto';
  $('#dep-consent-linha').hidden = true;
}

function atualizarContadorDep() {
  const n = $('#dep-texto').value.length;
  const c = $('#cont-dep-texto');
  c.textContent = `${n} de ${LIMITE_DEPOIMENTO} letras`;
  c.classList.toggle('passou', n > LIMITE_DEPOIMENTO);
}
$('#dep-texto').addEventListener('input', atualizarContadorDep);

function abrirDepoimento(d = null) {
  depEditando = d;
  preencherServicos();
  $('#dep-dlg-titulo').textContent = d ? 'Editar depoimento' : 'Novo depoimento';
  $('#dep-nome').value = d?.nome || '';
  $('#dep-de-onde').value = d?.de_onde || '';
  $('#dep-texto').value = d?.texto || '';
  $('#dep-servico').value = d?.servico || '';
  $('#dep-salvar').textContent = d ? 'Salvar alterações' : 'Colocar no site';
  $('#dep-foto-area').hidden = Boolean(d); // a foto não muda na edição
  $('#dep-consent').checked = false;
  limparFotoDep();
  $('#dep-consent-linha').hidden = true;
  esconder('#dep-erro');
  atualizarContadorDep();
  abrirDialogo('#dlg-depoimento', { voltarFoco: d ? $('#dep-titulo') : $('#dep-novo') });
  $('#dep-nome').focus();
}
$('#dep-novo').addEventListener('click', () => abrirDepoimento(null));
$('#dep-escolher').addEventListener('click', () => { $('#dep-arquivo').value = ''; $('#dep-arquivo').click(); });
$('#dep-sem-foto').addEventListener('click', () => { limparFotoDep(); $('#dep-consent-linha').hidden = true; });

$('#dep-arquivo').addEventListener('change', () => {
  const arquivo = $('#dep-arquivo').files?.[0];
  if (!arquivo) return;
  const pareceFoto = (arquivo.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name || '');
  if (!pareceFoto) { mostrar('#dep-erro', 'Esse arquivo não é uma foto. Escolha uma foto da galeria.'); return; }
  if (arquivo.size > LIMITE_FOTO) { mostrar('#dep-erro', 'Essa foto é grande demais. Escolha outra ou tire um print dela.'); return; }
  depArquivo = arquivo;
  if (depUrl) URL.revokeObjectURL(depUrl);
  depUrl = URL.createObjectURL(arquivo);
  const previa = $('#dep-previa');
  previa.onerror = () => { previa.hidden = true; };
  previa.src = depUrl;
  previa.hidden = false;
  $('#dep-sem-foto').hidden = false;
  $('#dep-escolher').textContent = 'Trocar foto';
  // Com foto, a autorização da cliente é obrigatória (uc4a).
  $('#dep-consent-linha').hidden = false;
  esconder('#dep-erro');
});

$('#dlg-depoimento').addEventListener('close', () => { limparFotoDep(); depEditando = null; });

$('#form-depoimento').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const nome = $('#dep-nome').value.trim();
  const deOnde = $('#dep-de-onde').value.trim();
  const texto = $('#dep-texto').value.trim();
  const servico = $('#dep-servico').value;
  if (!nome) { mostrar('#dep-erro', 'Escreva o nome da cliente.'); $('#dep-nome').focus(); return; }
  if (!texto) { mostrar('#dep-erro', 'Escreva o que ela disse.'); $('#dep-texto').focus(); return; }
  if (texto.length > LIMITE_DEPOIMENTO) { mostrar('#dep-erro', `O depoimento pode ter até ${LIMITE_DEPOIMENTO} letras; este tem ${texto.length}.`); return; }
  const consentimento = $('#dep-consent').checked;
  if (!depEditando && depArquivo && !consentimento) { mostrar('#dep-erro', 'Marque que a cliente autorizou antes de publicar a foto.'); $('#dep-consent').focus(); return; }
  const botao = $('#dep-salvar');
  ocupado(botao, 'Salvando...');
  try {
    if (depEditando) {
      const id = depEditando.id;
      await api(`/api/painel/depoimentos/${enc(id)}`, { metodo: 'PATCH', json: { nome, de_onde: deOnde, texto, servico } });
      fecharDialogo('#dlg-depoimento');
      await sincronizar();
      mostrarToast('Depoimento salvo', { verSite: true });
      return;
    }
    let r;
    if (depArquivo) {
      const { arquivo, largura, altura } = await reduzirFoto(depArquivo, LADO_AVATAR);
      const form = new FormData();
      form.append('nome', nome);
      form.append('de_onde', deOnde);
      form.append('texto', texto);
      form.append('servico', servico);
      form.append('consentimento', 'true');
      if (largura && altura) { form.append('largura', String(largura)); form.append('altura', String(altura)); }
      form.append('foto', arquivo, arquivo === depArquivo ? (depArquivo.name || 'foto.jpg') : 'foto.jpg');
      r = await api('/api/painel/depoimentos', { metodo: 'POST', form });
    } else {
      r = await api('/api/painel/depoimentos', { metodo: 'POST', json: { nome, de_onde: deOnde, texto, servico, consentimento } });
    }
    const criado = r.depoimento;
    fecharDialogo('#dlg-depoimento');
    await sincronizar();
    mostrarToast('Depoimento no site', {
      verSite: true,
      desfazer: async () => {
        await api(`/api/painel/depoimentos/${enc(criado.id)}`, { metodo: 'DELETE', json: {} });
        await sincronizar();
        mostrarToast('Pronto, o depoimento saiu do site');
      },
    });
  } catch (e) {
    if (e.tipo !== 'sessao') mostrar('#dep-erro', mensagemDe(e));
  } finally {
    livre(botao);
  }
});

// ---------- Antes e depois (R-05) ----------

const pares = () => estado?.antes_depois || [];
const LIMITE_LEGENDA = 120;
const SERVICOS_PAR = ['vm', 'styling', 'edicao'];
let parEditando = null;
const parArquivos = { antes: null, depois: null };
const parUrls = { antes: null, depois: null };

function abrirPares() {
  secaoAtual = null;
  renderPares();
  window.scrollTo(0, 0);
  mostrarTela('tela-pares');
  history.pushState({ secao: 'antes-depois' }, '');
}

function renderPares({ foco } = {}) {
  const lista = pares();
  $('#par-qtd').textContent = plural(lista.length, 'par', 'pares');
  $('#par-dica').hidden = lista.length < 2;
  const caixa = $('#par-lista');
  caixa.replaceChildren();
  if (!lista.length) {
    caixa.append(el('div', { class: 'vazio' }, el('p', { text: 'Nenhum par ainda. Toque em "Novo par de fotos" para cadastrar o primeiro.' })));
    return;
  }
  lista.forEach((p, idx) => {
    const nome = p.legenda || nomeSecao(p.servico);
    const cartao = el('div', { class: 'item par' },
      el('span', { class: 'par-mini' }, el('img', { src: p.antes_url, alt: 'Antes', loading: 'lazy' }), el('img', { src: p.depois_url, alt: 'Depois', loading: 'lazy' })),
      el('button', { class: 'nome', type: 'button', 'aria-label': `${nome}. Editar`, onclick: () => abrirPar(p) },
        el('span', { text: nome }),
        el('small', { text: p.legenda ? nomeSecao(p.servico) : 'Sem legenda' })),
      el('div', { class: 'acoes-item' },
        el('button', { class: 'mini', type: 'button', 'data-id': p.id, 'data-dir': 'cima', disabled: idx === 0, 'aria-label': `Mostrar antes: ${nome}`, text: '↑', onclick: (ev) => moverPar(p, 'cima', ev.currentTarget) }),
        el('button', { class: 'mini', type: 'button', 'data-id': p.id, 'data-dir': 'baixo', disabled: idx === lista.length - 1, 'aria-label': `Mostrar depois: ${nome}`, text: '↓', onclick: (ev) => moverPar(p, 'baixo', ev.currentTarget) })),
      el('button', { class: 'editar', type: 'button', text: 'Editar legenda', 'aria-label': `Editar legenda: ${nome}`, onclick: () => abrirPar(p) }),
      el('button', { class: 'tirar', type: 'button', text: 'Tirar do site', 'aria-label': `Tirar do site: ${nome}`, onclick: () => tirarPar(p) }));
    aplicarCor(cartao, secao(p.servico)?.cor || '#017F38');
    caixa.append(cartao);
  });
  if (foco) {
    const mesma = caixa.querySelector(`[data-id="${CSS.escape(foco.id)}"][data-dir="${foco.dir}"]`);
    const outra = caixa.querySelector(`[data-id="${CSS.escape(foco.id)}"][data-dir="${foco.dir === 'cima' ? 'baixo' : 'cima'}"]`);
    (mesma && !mesma.disabled ? mesma : outra)?.focus();
  }
}

async function moverPar(p, direcao, botao) {
  botao.disabled = true;
  try {
    const r = await api(`/api/painel/antes-depois/${enc(p.id)}/mover`, { metodo: 'POST', json: { direcao } });
    estado.antes_depois = r.antes_depois || estado.antes_depois;
    renderPares({ foco: { id: p.id, dir: direcao } });
    anunciar(`O par agora aparece ${direcao === 'cima' ? 'antes' : 'depois'}.`);
  } catch (e) {
    botao.disabled = false;
    if (e.tipo !== 'sessao') mostrarToast(mensagemDe(e), { erro: true });
  }
}

function tirarPar(p) {
  abrirConfirmacaoTirar({
    titulo: 'Tirar esse par do site?',
    texto: 'As duas fotos somem do site. Dá para desfazer logo em seguida.',
    tirando: 'Tirando...',
    apagar: () => api(`/api/painel/antes-depois/${enc(p.id)}`, { metodo: 'DELETE', json: {} }),
    saiu: 'O par saiu do site',
    desfazer: () => api(`/api/painel/antes-depois/${enc(p.id)}/restaurar`, { metodo: 'POST', json: {} }),
    voltou: 'Pronto, o par voltou para o site',
    voltarFoco: $('#par-titulo'),
  });
}

function limparFotosPar() {
  for (const lado of ['antes', 'depois']) {
    if (parUrls[lado]) { URL.revokeObjectURL(parUrls[lado]); parUrls[lado] = null; }
    parArquivos[lado] = null;
    $(`#par-arquivo-${lado}`).value = '';
    const previa = $(`#par-previa-${lado}`);
    previa.removeAttribute('src');
    previa.hidden = true;
    $(`#par-escolher-${lado}`).classList.remove('tem-foto');
  }
}

function atualizarContadorPar() {
  const n = $('#par-legenda').value.length;
  const c = $('#cont-par-legenda');
  c.textContent = `${n} de ${LIMITE_LEGENDA} letras`;
  c.classList.toggle('passou', n > LIMITE_LEGENDA);
}
$('#par-legenda').addEventListener('input', atualizarContadorPar);

function abrirPar(p = null) {
  parEditando = p;
  const sel = $('#par-servico');
  sel.replaceChildren(...SERVICOS_PAR.map((id) => el('option', { value: id, text: nomeSecao(id) })));
  $('#par-dlg-titulo').textContent = p ? 'Editar legenda do par' : 'Novo par de fotos';
  $('#par-legenda').value = p?.legenda || '';
  sel.value = p?.servico || 'vm';
  $('#par-salvar').textContent = p ? 'Salvar alterações' : 'Colocar no site';
  $('#par-fotos-area').hidden = Boolean(p);   // as fotos não mudam na edição
  $('#par-consent-linha').hidden = Boolean(p);
  $('#par-consent').checked = false;
  limparFotosPar();
  esconder('#par-erro');
  atualizarContadorPar();
  abrirDialogo('#dlg-par', { voltarFoco: p ? $('#par-titulo') : $('#par-novo') });
  (p ? $('#par-legenda') : $('#par-escolher-antes')).focus();
}
$('#par-novo').addEventListener('click', () => abrirPar(null));
for (const lado of ['antes', 'depois']) {
  $(`#par-escolher-${lado}`).addEventListener('click', () => { $(`#par-arquivo-${lado}`).value = ''; $(`#par-arquivo-${lado}`).click(); });
  $(`#par-arquivo-${lado}`).addEventListener('change', () => {
    const arquivo = $(`#par-arquivo-${lado}`).files?.[0];
    if (!arquivo) return;
    const pareceFoto = (arquivo.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name || '');
    if (!pareceFoto) { mostrar('#par-erro', 'Esse arquivo não é uma foto. Escolha uma foto da galeria.'); return; }
    if (arquivo.size > LIMITE_FOTO) { mostrar('#par-erro', 'Essa foto é grande demais. Escolha outra ou tire um print dela.'); return; }
    parArquivos[lado] = arquivo;
    if (parUrls[lado]) URL.revokeObjectURL(parUrls[lado]);
    parUrls[lado] = URL.createObjectURL(arquivo);
    const previa = $(`#par-previa-${lado}`);
    previa.onerror = () => { previa.hidden = true; };
    previa.src = parUrls[lado];
    previa.hidden = false;
    $(`#par-escolher-${lado}`).classList.add('tem-foto');
    esconder('#par-erro');
  });
}
$('#dlg-par').addEventListener('close', () => { limparFotosPar(); parEditando = null; });

$('#form-par').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const legenda = $('#par-legenda').value.trim();
  const servico = $('#par-servico').value;
  if (legenda.length > LIMITE_LEGENDA) { mostrar('#par-erro', `A legenda pode ter até ${LIMITE_LEGENDA} letras; esta tem ${legenda.length}.`); return; }
  if (!parEditando) {
    if (!parArquivos.antes) { mostrar('#par-erro', 'Falta a foto de Antes. O par precisa das duas fotos.'); $('#par-escolher-antes').focus(); return; }
    if (!parArquivos.depois) { mostrar('#par-erro', 'Falta a foto de Depois. O par precisa das duas fotos.'); $('#par-escolher-depois').focus(); return; }
    if (!$('#par-consent').checked) { mostrar('#par-erro', 'Marque que a cliente autorizou antes de publicar as fotos.'); $('#par-consent').focus(); return; }
  }
  const botao = $('#par-salvar');
  ocupado(botao, 'Salvando...');
  try {
    if (parEditando) {
      await api(`/api/painel/antes-depois/${enc(parEditando.id)}`, { metodo: 'PATCH', json: { legenda, servico } });
      fecharDialogo('#dlg-par');
      await sincronizar();
      mostrarToast('Par salvo', { verSite: true });
      return;
    }
    const form = new FormData();
    form.append('legenda', legenda);
    form.append('servico', servico);
    form.append('consentimento', 'true');
    for (const lado of ['antes', 'depois']) {
      const { arquivo, largura, altura } = await reduzirFoto(parArquivos[lado]);
      if (largura && altura) { form.append(`largura_${lado}`, String(largura)); form.append(`altura_${lado}`, String(altura)); }
      form.append(lado, arquivo, arquivo === parArquivos[lado] ? (parArquivos[lado].name || `${lado}.jpg`) : `${lado}.jpg`);
    }
    const r = await api('/api/painel/antes-depois', { metodo: 'POST', form });
    const criado = r.par;
    fecharDialogo('#dlg-par');
    await sincronizar();
    mostrarToast('Par no site', {
      verSite: true,
      desfazer: async () => {
        await api(`/api/painel/antes-depois/${enc(criado.id)}`, { metodo: 'DELETE', json: {} });
        await sincronizar();
        mostrarToast('Pronto, o par saiu do site');
      },
    });
  } catch (e) {
    if (e.tipo !== 'sessao') mostrar('#par-erro', mensagemDe(e));
  } finally {
    livre(botao);
  }
});

// ---------- Perguntas frequentes (R-06) ----------

const faqs = () => estado?.faq || [];
const GRUPOS_FAQ = { voce: 'Para você', lojas: 'Para lojas e escolas', lalaia: 'LALAIÁ' };
const LIMITE_PERGUNTA = 140;
const LIMITE_RESPOSTA = 600;
let faqEditando = null;

function abrirFaq() {
  secaoAtual = null;
  renderFaq();
  window.scrollTo(0, 0);
  mostrarTela('tela-faq');
  history.pushState({ secao: 'faq' }, '');
}

function renderFaq({ foco } = {}) {
  const lista = faqs();
  $('#faq-qtd').textContent = `${lista.filter((f) => f.publicada).length} de ${lista.length} no site`;
  const caixa = $('#faq-lista');
  caixa.replaceChildren();
  if (!lista.length) {
    caixa.append(el('div', { class: 'vazio' }, el('p', { text: 'Nenhuma pergunta ainda. Toque em "Nova pergunta" para escrever a primeira.' })));
    return;
  }
  lista.forEach((f, idx) => {
    const selos = [
      !f.revisada && el('span', { class: 'selo selo-rascunho', text: 'Rascunho: revisar' }),
      f.publicada ? el('span', { class: 'selo selo-publicada', text: 'No site' }) : el('span', { class: 'selo selo-oculta', text: 'Fora do site · revise e publique' }),
    ];
    const cartao = el('div', { class: 'item faq' },
      el('button', { class: 'nome', type: 'button', 'aria-label': `${f.pergunta}. Editar`, onclick: () => abrirPergunta(f) },
        el('span', {}, ...selos),
        el('span', { text: f.pergunta }),
        el('em', { text: `${GRUPOS_FAQ[f.grupo] || f.grupo} · ${resumir(f.resposta, 80)}` })),
      el('div', { class: 'acoes-item' },
        el('button', { class: 'mini', type: 'button', 'data-id': f.id, 'data-dir': 'cima', disabled: idx === 0, 'aria-label': `Mostrar antes: ${f.pergunta}`, text: '↑', onclick: (ev) => moverFaq(f, 'cima', ev.currentTarget) }),
        el('button', { class: 'mini', type: 'button', 'data-id': f.id, 'data-dir': 'baixo', disabled: idx === lista.length - 1, 'aria-label': `Mostrar depois: ${f.pergunta}`, text: '↓', onclick: (ev) => moverFaq(f, 'baixo', ev.currentTarget) })),
      el('div', { class: 'linha-acoes' },
        el('button', { class: 'publicar', type: 'button', text: f.publicada ? 'Tirar do site' : 'Publicar no site', onclick: (ev) => publicarFaq(f, !f.publicada, ev.currentTarget) }),
        el('button', { class: 'editar', type: 'button', text: 'Editar', 'aria-label': `Editar: ${f.pergunta}`, onclick: () => abrirPergunta(f) }),
        el('button', { class: 'tirar', type: 'button', text: 'Apagar', 'aria-label': `Apagar: ${f.pergunta}`, onclick: () => tirarFaq(f) })));
    aplicarCor(cartao, f.publicada ? '#2A2730' : '#BDB6C8');
    caixa.append(cartao);
  });
  if (foco) {
    const mesma = caixa.querySelector(`[data-id="${CSS.escape(foco.id)}"][data-dir="${foco.dir}"]`);
    const outra = caixa.querySelector(`[data-id="${CSS.escape(foco.id)}"][data-dir="${foco.dir === 'cima' ? 'baixo' : 'cima'}"]`);
    (mesma && !mesma.disabled ? mesma : outra)?.focus();
  }
}

async function publicarFaq(f, publicada, botao) {
  botao.disabled = true;
  try {
    const r = await api(`/api/painel/faq/${enc(f.id)}`, { metodo: 'PUT', json: { publicada } });
    estado.faq = faqs().map((x) => (x.id === f.id ? r.faq : x));
    renderFaq();
    renderCartoes();
    mostrarToast(publicada ? 'Pergunta no site' : 'A pergunta saiu do site', { verSite: publicada });
  } catch (e) {
    botao.disabled = false;
    if (e.tipo !== 'sessao') mostrarToast(mensagemDe(e), { erro: true });
  }
}

async function moverFaq(f, direcao, botao) {
  botao.disabled = true;
  try {
    const r = await api(`/api/painel/faq/${enc(f.id)}/mover`, { metodo: 'POST', json: { direcao } });
    estado.faq = r.faq || estado.faq;
    renderFaq({ foco: { id: f.id, dir: direcao } });
    anunciar(`A pergunta agora aparece ${direcao === 'cima' ? 'antes' : 'depois'}.`);
  } catch (e) {
    botao.disabled = false;
    if (e.tipo !== 'sessao') mostrarToast(mensagemDe(e), { erro: true });
  }
}

function tirarFaq(f) {
  abrirConfirmacaoTirar({
    titulo: 'Apagar essa pergunta?',
    texto: 'Ela some da lista e do site. Dá para desfazer logo em seguida.',
    tirando: 'Apagando...',
    apagar: () => api(`/api/painel/faq/${enc(f.id)}`, { metodo: 'DELETE', json: {} }),
    saiu: 'Pergunta apagada',
    desfazer: () => api(`/api/painel/faq/${enc(f.id)}/restaurar`, { metodo: 'POST', json: {} }),
    voltou: 'Pronto, a pergunta voltou',
    voltarFoco: $('#faq-titulo'),
  });
}

function atualizarContadoresFaq() {
  for (const [sel, cont, max] of [['#faq-pergunta', '#cont-faq-pergunta', LIMITE_PERGUNTA], ['#faq-resposta', '#cont-faq-resposta', LIMITE_RESPOSTA]]) {
    const n = $(sel).value.length;
    const c = $(cont);
    c.textContent = `${n} de ${max} letras`;
    c.classList.toggle('passou', n > max);
  }
}
$('#faq-pergunta').addEventListener('input', atualizarContadoresFaq);
$('#faq-resposta').addEventListener('input', atualizarContadoresFaq);

function abrirPergunta(f = null) {
  faqEditando = f;
  const sel = $('#faq-grupo');
  sel.replaceChildren(...Object.entries(GRUPOS_FAQ).map(([id, nome]) => el('option', { value: id, text: nome })));
  $('#faq-dlg-titulo').textContent = f ? 'Editar pergunta' : 'Nova pergunta';
  $('#faq-pergunta').value = f?.pergunta || '';
  $('#faq-resposta').value = f?.resposta || '';
  sel.value = f?.grupo || 'voce';
  $('#faq-publicada').checked = Boolean(f?.publicada);
  $('#faq-salvar').textContent = f ? 'Salvar alterações' : 'Salvar pergunta';
  esconder('#faq-erro');
  atualizarContadoresFaq();
  abrirDialogo('#dlg-faq', { voltarFoco: f ? $('#faq-titulo') : $('#faq-nova') });
  $('#faq-pergunta').focus();
}
$('#faq-nova').addEventListener('click', () => abrirPergunta(null));
$('#dlg-faq').addEventListener('close', () => { faqEditando = null; });

$('#form-faq').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const pergunta = $('#faq-pergunta').value.trim();
  const resposta = $('#faq-resposta').value.trim();
  const grupo = $('#faq-grupo').value;
  const publicada = $('#faq-publicada').checked;
  if (!pergunta) { mostrar('#faq-erro', 'Escreva a pergunta.'); $('#faq-pergunta').focus(); return; }
  if (!resposta) { mostrar('#faq-erro', 'Escreva a resposta.'); $('#faq-resposta').focus(); return; }
  if (pergunta.length > LIMITE_PERGUNTA) { mostrar('#faq-erro', `A pergunta pode ter até ${LIMITE_PERGUNTA} letras; esta tem ${pergunta.length}.`); return; }
  if (resposta.length > LIMITE_RESPOSTA) { mostrar('#faq-erro', `A resposta pode ter até ${LIMITE_RESPOSTA} letras; esta tem ${resposta.length}.`); return; }
  const botao = $('#faq-salvar');
  ocupado(botao, 'Salvando...');
  try {
    if (faqEditando) {
      const antes = faqEditando;
      const corpo = { grupo, publicada };
      if (pergunta !== antes.pergunta) corpo.pergunta = pergunta;
      if (resposta !== antes.resposta) corpo.resposta = resposta;
      await api(`/api/painel/faq/${enc(antes.id)}`, { metodo: 'PUT', json: corpo });
    } else {
      await api('/api/painel/faq', { metodo: 'POST', json: { pergunta, resposta, grupo, publicada } });
    }
    fecharDialogo('#dlg-faq');
    await sincronizar();
    mostrarToast(publicada ? 'Pergunta salva e no site' : 'Pergunta salva (fora do site)', { verSite: publicada });
  } catch (e) {
    if (e.tipo !== 'sessao') mostrar('#faq-erro', mensagemDe(e));
  } finally {
    livre(botao);
  }
});

// ---------- Diálogos ----------

const retornoFoco = new Map();

function abrirDialogo(sel, { voltarFoco } = {}) {
  const d = $(sel);
  if (d.open) return;
  retornoFoco.set(d, voltarFoco || document.activeElement);
  d.showModal();
}

function fecharDialogo(sel) {
  const d = $(sel);
  if (d.open) d.close();
}

document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('close', () => {
    const alvo = retornoFoco.get(d);
    retornoFoco.delete(d);
    if (alvo && alvo.isConnected && !alvo.closest('[hidden]') && typeof alvo.focus === 'function') alvo.focus();
    else if (telaAtual === 'tela-secao') $('#secao-titulo').focus();
    else if (telaAtual === 'tela-inicio') $('#ola').focus();
  });
  d.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => d.close()));
});

// Tocar fora da folha inferior fecha
$('#dlg-publicar').addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });

// ---------- Avisos ----------

let toastTimer = null;

function mostrarToast(texto, { desfazer, verSite, erro, acao } = {}) {
  const area = $('#toast-area');
  clearTimeout(toastTimer);
  area.replaceChildren();
  const acoes = el('div', { class: 'toast-acoes' });
  if (acao) {
    acoes.append(el('button', {
      type: 'button', text: acao.texto,
      onclick: async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true;
        clearTimeout(toastTimer);
        try { await acao.aoTocar(); } catch (e) { if (e.tipo !== 'sessao') mostrarToast(mensagemDe(e), { erro: true }); }
      },
    }));
  }
  if (desfazer) {
    acoes.append(el('button', {
      type: 'button', text: 'Desfazer',
      onclick: async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true;
        b.textContent = 'Desfazendo...';
        clearTimeout(toastTimer);
        try { await desfazer(); } catch (e) { if (e.tipo !== 'sessao') mostrarToast(mensagemDe(e), { erro: true }); }
      },
    }));
  }
  if (verSite) acoes.append(el('a', { href: estado?.site_url || '/', target: '_blank', rel: 'noopener', text: 'Ver no site' }));
  const toast = el('div', { class: `toast${erro ? ' toast-erro' : ''}` },
    el('p', { text: texto }),
    acoes.childNodes.length ? acoes : null);
  area.append(toast);
  const tempo = desfazer || acao ? 10000 : 6000;
  const agendar = () => { toastTimer = setTimeout(() => toast.remove(), tempo); };
  toast.addEventListener('focusin', () => clearTimeout(toastTimer));
  toast.addEventListener('focusout', agendar);
  toast.addEventListener('pointerenter', () => clearTimeout(toastTimer));
  toast.addEventListener('pointerleave', agendar);
  agendar();
}

// ---------- Começa ----------

iniciar({ avisarInstagram: instagramLigado });
