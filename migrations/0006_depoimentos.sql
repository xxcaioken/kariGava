-- Depoimentos de clientes cadastrados no painel (R-04). Ordem e "tirar com desfazer" como em itens.
CREATE TABLE depoimentos (
  id               TEXT PRIMARY KEY,
  ordem            INTEGER NOT NULL,
  nome             TEXT NOT NULL,
  de_onde          TEXT NOT NULL DEFAULT '',   -- cidade/profissão, opcional
  texto            TEXT NOT NULL,              -- até 400 letras
  servico          TEXT NOT NULL DEFAULT '',   -- id de conteudo.servicos ou vazio
  foto_chave       TEXT,                       -- chave no R2 (dep/<id>.jpg) ou NULL
  largura          INTEGER,                    -- tamanho da foto enviada (width/height no site)
  altura           INTEGER,
  consentimento_em TEXT,                       -- quando a Kari marcou que a cliente autorizou
  criado_em        TEXT NOT NULL,
  removido_em      TEXT
);
CREATE INDEX depoimentos_ordem ON depoimentos (ordem) WHERE removido_em IS NULL;
