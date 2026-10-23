# Sistema de design do site da Kari

Fonte da verdade é `public/site.css` (site) e `public/painel/painel.css` (painel). Este arquivo documenta os tokens para quem for criar uma seção nova sem inventar componente: tudo que o site precisa já existe no CSS.

## Tokens do site (`public/site.css`)

| Token | Valor | Uso |
|---|---|---|
| `--tinta` | `#141218` | texto principal, rodapé, botão da LALAIÁ |
| `--tinta-suave` | `#4B4752` | texto secundário, rótulos |
| `--papel` | `#FFFFFF` | fundo da página |
| `--cinza` | `#F1F1F3` | seções alternadas (`.secao-cinza`), caixas "para quem" |
| `--linha` | `#E2E1E6` | bordas de cartões, divisores |
| `--raio` | `6px` | cantos de cartões e botões |
| `--gutter` | `16px` (32px ≥ 960) | margem lateral |
| `--sans` | `"Familjen Grotesk", system-ui, sans-serif` | todo o texto; títulos em 600 |
| `--mono` | `"Fragment Mono", ui-monospace, monospace` | rótulos em caixa alta (`.rotulo`), legendas |

### Cor de destaque (uma só, da estação)

Desde 23/10/2026 o site tem **uma** cor de destaque, sem cor por serviço: a Kari achou que "escolher o serviço pela cor" não fazia sentido e lembrou que cor é sazonal. A cor mora em `conteudo.json` (`marca.cor_destaque`, hoje `#C52118`, vermelho provisório até ela escolher a da estação) e chega a cada página como `--destaque` no `<html style>` (`src/marca.js`); `public/site.css` não guarda essa cor, só neutros. O `/favicon.svg` é gerado pelo Worker com a mesma cor. A prévia do link (`og.jpg`) e os ícones do painel não usam a cor, para não precisarem ser refeitos a cada troca.

`--destaque` pinta: botões (`.btn`), foco do teclado, a marca do topo (leque de três lâminas), a faixa do rodapé, as lâminas do leque, a barra das citações, a inicial do depoimento e o cupom. Texto branco sobre `--destaque` exige contraste ≥ 4,5:1: `test/unit/cor.test.mjs` confere o valor configurado (o vermelho dá 5,8:1). Cor clara demais para texto branco (mostarda, por exemplo) reprova o teste: escolher um tom mais escuro. `--tinta-suave` sobre `--papel`/`--cinza` para texto secundário de 15 px ou mais. Nunca texto cinza sobre fundo colorido.

### Tipografia

- Títulos de seção (`.secao-cab h2`): `clamp(40px, 7vw, 76px)`, peso 600, tracking `-.045em`.
- Título de cartão (`h3`): 22–27 px, peso 600.
- Corpo: 17 px / 1.55; secundário 15–16 px em `--tinta-suave`.
- Rótulo (`.rotulo`): 12 px mono, caixa alta, tracking `.06em`.
- Fontes servidas pelo site (`public/fontes.css`, subconjunto latin, `font-display: swap`): Familjen Grotesk variável 400–700 + itálico, Fragment Mono 400, Onest variável 400–800 (painel). Preload das duas usadas acima da dobra no `<head>`.

### Componentes que toda seção nova reaproveita

| Classe | O que é | Onde usar |
|---|---|---|
| `.secao` / `.secao-cinza` + `.secao-cab` | seção com título grande e um parágrafo | qualquer bloco novo da home, alternando o fundo |
| `.btn` | botão de 48 px na cor de destaque | toda ação de WhatsApp; um botão por bloco |
| `.btn-linha` | botão secundário com contorno | ação secundária ao lado de um `.btn` |
| `.rotulo` | rótulo mono em caixa alta | eyebrow, preço ("A partir de"), serviço do depoimento |
| `.passos` / `.passo` | lista numerada (sequência real) | "Como trabalhar comigo", "Como encomendar" |
| `.como` (`<details>/<summary>`) | acordeão sem JS, 44 px no `summary` | "Como funciona", perguntas da FAQ |
| `.citacao` | citação com barra na cor de destaque | frase do serviço, texto do depoimento |
| `.chips` | etiquetas pequenas | formação, cidade |
| `.barra-wa` | barra fixa no celular com o botão | sempre presente abaixo de 960 px |

### Regras

- Alvos de toque: tudo clicável com pelo menos 44×44 px (`.btn` 48 px, `.legenda a` 46 px, `summary` 44 px).
- Movimento: só o leque abrindo no hero; `prefers-reduced-motion: reduce` desliga tudo (`site.css`).
- Leque da abertura: uma lâmina por serviço com a primeira foto dele (nunca `kari-chapeu-anturio` nem `kari-oculos`), em moldura branca, aberta de 20 em 20 graus em volta da foto da Kari (×1,2 no desktop, `--abre`); o ângulo vem do HTML (`--a`), as de dentro ficam na frente. No desktop cada lâmina leva o nome curto do serviço, alinhado na borda que fica à mostra. Serviço sem foto não entra no leque.
- Imagens: `loading="lazy"`, `width` e `height` em toda foto fora do hero; o hero tem `fetchpriority="high"`.
- Breakpoints: 640 px (2 colunas) e 960 px (3 colunas, navegação no topo, barra fixa some).
- Sem componente novo fora desta lista: se a seção não cabe, é decisão de design, não de código.

## Tokens do painel (`public/painel/painel.css`)

`--roxo #8D51FF`, `--roxo-forte #6A2FE0`, `--roxo-claro #F1EAFF`, `--verde #017F38`, `--verde-claro #E3F4EA`, `--mostarda #FEBC5C`, `--mostarda-claro #FFF3DF`, `--vermelho #C52118`, `--vermelho-claro #FCE9E7`, `--tinta #17141F`, `--tinta-suave #4F4A58`, `--linha #DDD8E4`, `--fundo #F6F4F9`, `--branco #FFFFFF`. Fonte Onest 17 px / 1.45. Largura máxima 520 px (é um app de celular). Toda ação da API: botão desabilitado enquanto roda, `mostrarToast` ao terminar, `mensagem` da API embaixo do campo quando der erro.
