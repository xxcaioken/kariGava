// Página de privacidade (R-13): quem cuida dos dados, o que o site coleta, o que o painel guarda e os direitos
// da LGPD. O canal de contato é EMAIL_CONTATO; enquanto a var estiver vazia, o WhatsApp do site.
import conteudo from '../conteudo.json' with { type: 'json' };
import { esc, linkWa } from './site.js';
import { casca } from './paginas.js';

export const VERSAO_PRIVACIDADE = '22/10/2026';

export function renderizarPrivacidade({ emailContato = '', whatsappNumero, base = '' } = {}) {
  const email = String(emailContato || '').trim();
  const wa = esc(linkWa(whatsappNumero, 'Oi Kari, vi a página de privacidade do site e quero falar sobre os meus dados'));
  const canal = email
    ? `pelo e-mail <a href="mailto:${esc(email)}">${esc(email)}</a>`
    : `pelo <a href="${wa}">WhatsApp do site</a>`;
  const corpo = `    <p class="rotulo">Privacidade</p>
    <h1>Como este site trata os seus dados</h1>
    <p class="leitura-intro">Este site é simples de propósito: ele apresenta o trabalho da Kari e leva a conversa para o WhatsApp. Aqui está, sem juridiquês, o que acontece com os seus dados.</p>

    <h2>Quem cuida dos seus dados</h2>
    <p>A responsável (controladora) é ${esc(conteudo.marca.nome)}, ${esc(conteudo.marca.profissao.toLowerCase())} em ${esc(conteudo.marca.cidade)}. Para qualquer pedido sobre os seus dados, fale ${canal}.</p>

    <h2>O que o site coleta</h2>
    <ul>
      <li><strong>Nada sobre você enquanto visitante.</strong> Não há formulário, cadastro, cookie de rastreamento nem pixel de redes sociais.</li>
      <li><strong>O botão de WhatsApp</strong> só abre o aplicativo com uma mensagem pronta. A conversa acontece no WhatsApp, sob as regras dele, e nada volta para este site.</li>
      <li><strong>Medição de audiência,</strong> quando estiver ligada, é feita sem cookies e sem identificar pessoas: contamos visitas por página, não quem visitou.</li>
      <li><strong>O quiz</strong> roda inteiro no seu navegador. As respostas não são guardadas nem enviadas.</li>
    </ul>

    <h2>O painel</h2>
    <p>O painel de edição é só da Kari e de quem ela autorizar. Ele guarda:</p>
    <ul>
      <li>o e-mail de quem entra, usado para mandar o código de acesso e manter a sessão;</li>
      <li>as fotos, os textos, os preços, os depoimentos e as perguntas publicados no site;</li>
      <li>para depoimentos e fotos de antes e depois, o registro de que a cliente autorizou a publicação.</li>
    </ul>
    <p>Esses dados ficam guardados enquanto o conteúdo estiver no site. O que é tirado do site pode ser restaurado por pouco tempo e depois é apagado.</p>

    <h2>Seus direitos</h2>
    <p>A Lei Geral de Proteção de Dados (LGPD, art. 18) garante que você pode pedir para saber quais dados seus existem aqui, corrigi-los, apagá-los ou retirar uma autorização que deu. Se você aparece num depoimento ou numa foto e quer que ela saia do site, é só pedir ${canal}: a retirada é feita pelo painel, na hora.</p>

    <p class="leitura-versao">Versão desta página: ${VERSAO_PRIVACIDADE}.</p>`;
  return casca({ titulo: 'Privacidade', descricao: 'O que este site coleta (quase nada), o que o painel guarda e os seus direitos pela LGPD.', corpo, whatsappNumero, base, caminho: '/privacidade' });
}
