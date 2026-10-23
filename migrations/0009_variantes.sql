-- Versões leves das fotos (R-10): larguras que existem no R2 e o tamanho da original, para width/height e srcset.
-- variantes = JSON {"larguras":[480,960,1600],"webp":true}; NULL = só a foto original (o site usa <img> simples).
ALTER TABLE itens ADD COLUMN variantes TEXT;
ALTER TABLE itens ADD COLUMN largura INTEGER;
ALTER TABLE itens ADD COLUMN altura INTEGER;
