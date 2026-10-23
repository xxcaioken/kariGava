-- Pares "antes e depois" de vitrines, looks e armários (R-05). Um par só existe com as duas fotos.
CREATE TABLE antes_depois (
  id               TEXT PRIMARY KEY,
  ordem            INTEGER NOT NULL,
  legenda          TEXT NOT NULL DEFAULT '',   -- até 120 letras
  servico          TEXT NOT NULL,              -- vm | styling | edicao
  antes_chave      TEXT NOT NULL,              -- ad/<id>-antes.jpg
  depois_chave     TEXT NOT NULL,              -- ad/<id>-depois.jpg
  largura_antes    INTEGER NOT NULL,
  altura_antes     INTEGER NOT NULL,
  largura_depois   INTEGER NOT NULL,
  altura_depois    INTEGER NOT NULL,
  consentimento_em TEXT NOT NULL,              -- a Kari marcou que a cliente autorizou
  criado_em        TEXT NOT NULL,
  removido_em      TEXT
);
CREATE INDEX antes_depois_ordem ON antes_depois (ordem) WHERE removido_em IS NULL;
