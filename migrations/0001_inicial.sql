-- Fotos que aparecem no site, por seção e em ordem.
CREATE TABLE itens (
  id          TEXT PRIMARY KEY,
  secao       TEXT NOT NULL,
  ordem       INTEGER NOT NULL,
  titulo      TEXT NOT NULL DEFAULT '',
  foto_chave  TEXT NOT NULL,          -- 'img/x.jpg' (foto inicial do site) ou chave no R2
  origem      TEXT NOT NULL,          -- 'inicial' | 'instagram' | 'celular'
  ig_conta    TEXT,
  ig_id       TEXT,
  criado_em   TEXT NOT NULL,
  removido_em TEXT                    -- preenchido quando sai do site (permite desfazer)
);
CREATE INDEX itens_secao_ordem ON itens (secao, ordem) WHERE removido_em IS NULL;
CREATE INDEX itens_ig ON itens (ig_conta, ig_id);

-- Textos dos serviços editados no painel (o resto vem de conteudo.json).
CREATE TABLE textos (
  servico       TEXT PRIMARY KEY,
  resumo        TEXT NOT NULL,
  para_quem     TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

-- Contas do Instagram ligadas ao site.
CREATE TABLE instagram (
  conta          TEXT PRIMARY KEY,    -- 'kari' | 'lalaia'
  usuario_ig     TEXT,
  user_id        TEXT,
  token          TEXT NOT NULL,
  renovado_em    TEXT NOT NULL
);

-- Códigos de login por e-mail (um por e-mail; guardamos só o hash).
CREATE TABLE codigos_login (
  email          TEXT PRIMARY KEY,
  codigo_hash    TEXT NOT NULL,
  expira_em      TEXT NOT NULL,
  tentativas     INTEGER NOT NULL DEFAULT 0,
  janela_inicio  TEXT NOT NULL,       -- início da janela de 15 min para limitar pedidos
  pedidos        INTEGER NOT NULL DEFAULT 1
);
