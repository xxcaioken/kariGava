-- Configurações do site editadas no painel, uma linha por chave, valor em JSON.
-- Chaves de hoje: "condicoes" (pagamento, frete, prazo_padrao, troca) e "gbp_url" (link das avaliações no Google).
-- Chave/valor evita uma migration por configuração nova.
CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
