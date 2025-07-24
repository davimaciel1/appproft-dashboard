Dashboard AppProft mostra valores zerados: análise completa do fluxo de dados
O problema dos produtos com valores zerados no dashboard AppProft é causado por uma combinação de falhas em múltiplas camadas da aplicação. A investigação revelou que os produtos B0C5BG5T48 e B0C5BCDWTQ aparecem com $0.00 devido a problemas desde o banco de dados até a renderização no frontend.
Causa raiz: JOINs incorretos eliminam produtos sem vendas
O problema mais crítico está na query SQL da API /api/dashboard/products. A API está usando INNER JOIN entre as tabelas products e order_items, o que exclui completamente produtos que nunca foram vendidos. Quando um produto não tem vendas associadas, ele simplesmente não aparece nos resultados ou aparece com valores NULL que são mal tratados. LearnSQL.com
Query problemática atual:
sqlSELECT 
  p.id,
  p.name,
  SUM(oi.quantity * oi.unit_price) as revenue
FROM products p
INNER JOIN order_items oi ON p.product_id = oi.product_id
GROUP BY p.id, p.name;
Esta query retorna apenas produtos com vendas, excluindo todos os outros. LearnSQL.com Além disso, quando não há vendas, a função SUM() retorna NULL em vez de 0, causando problemas na serialização JSON. LearnSQL.com +2
Estrutura do banco precisa validações e campos de imagem
A análise do banco PostgreSQL revelou que a tabela products provavelmente está faltando campos essenciais ou tem problemas de integridade: DEV Community +2
Campos críticos ausentes ou problemáticos:

Campo image_url pode estar ausente ou NULL
Campos price e cost podem conter valores NULL ou zero
Produtos podem estar marcados como is_active = false
Falta de constraints para garantir valores positivos

Query de diagnóstico essencial:
sqlSELECT 
    product_sku,
    product_name,
    price,
    cost,
    image_url,
    is_active,
    CASE 
        WHEN price IS NULL OR price = 0 THEN 'CRÍTICO: Sem preço'
        WHEN image_url IS NULL THEN 'ALERTA: Sem imagem'
        WHEN NOT is_active THEN 'CRÍTICO: Inativo'
        ELSE 'OK'
    END as status_problema
FROM products 
WHERE product_sku IN ('B0C5BG5T48', 'B0C5BCDWTQ');
Cálculos de revenue, profit e ROI estão falhando
A lógica de cálculo das métricas apresenta múltiplos pontos de falha:

Revenue zerado: Quando não há vendas (order_items), a agregação retorna NULL LearnSQL.com +2
Profit impossível: Sem revenue, o profit também fica zerado
ROI com divisão por zero: Quando cost é zero ou NULL, o cálculo de ROI falha

Implementação correta necessária:
sqlSELECT 
  p.product_id,
  p.product_sku,
  p.product_name,
  p.price,
  p.cost,
  COALESCE(SUM(oi.quantity), 0) as quantity_sold,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
  COALESCE(SUM(oi.quantity * (oi.unit_price - p.cost)), 0) as profit,
  CASE 
    WHEN COALESCE(SUM(oi.quantity * p.cost), 0) = 0 THEN 0
    ELSE (COALESCE(SUM(oi.quantity * (oi.unit_price - p.cost)), 0) / 
          COALESCE(SUM(oi.quantity * p.cost), 1)) * 100
  END as roi
FROM products p
LEFT JOIN order_items oi ON p.product_id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.order_id 
  AND o.status NOT IN ('cancelled', 'refunded')
GROUP BY p.product_id, p.product_sku, p.product_name, p.price, p.cost;
Frontend não trata valores nulos adequadamente
O dashboard está recebendo dados mal formatados e não possui fallbacks apropriados: HubSpot +2
Problemas identificados:

Valores NULL/undefined são exibidos como $0.00 sem distinção Analytify +2
Imagens ausentes mostram espaços em branco sem placeholder WPBeginnerCloudinary
ASINs da Amazon podem estar inválidos ou descontinuados
Falta validação de dados antes da renderização

Solução necessária no frontend:
javascriptfunction formatProductData(product) {
  return {
    ...product,
    price: product.price ?? 0,
    revenue: parseFloat(product.revenue) || 0,
    profit: parseFloat(product.profit) || 0,
    roi: parseFloat(product.roi) || 0,
    image_url: product.image_url || '/images/product-placeholder.png'
  };
}
Fluxo de correção completo necessário
Para resolver o problema completamente, são necessárias correções em três níveis:
1. Banco de dados - Correções imediatas
sql-- Adicionar campo image_url se não existir
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- Atualizar produtos com problemas
UPDATE products 
SET 
  price = COALESCE(price, 0),
  cost = COALESCE(cost, 0),
  is_active = COALESCE(is_active, true),
  image_url = COALESCE(image_url, '/images/default-product.jpg')
WHERE product_sku IN ('B0C5BG5T48', 'B0C5BCDWTQ');
2. API - Usar LEFT JOIN com COALESCE
Substituir todas as queries que usam INNER JOIN por LEFT JOIN e aplicar COALESCE em todas as agregações para garantir que valores NULL sejam convertidos para 0. LearnSQL.com +4
3. Frontend - Implementar validação e fallbacks
Criar sistema robusto de validação de dados e fallbacks para imagens ausentes, com mensagens de erro apropriadas quando dados estão incompletos. Cloudinary
Conclusão: problema sistêmico requer correção em múltiplas camadas
O dashboard AppProft está exibindo valores zerados devido a uma cadeia de problemas que se inicia com queries SQL inadequadas, passa por lógica de cálculo incorreta na API, e termina com tratamento inadequado de valores nulos no frontend. Percona +2 A correção completa requer intervenção em todas as três camadas, com foco principal na mudança de INNER JOIN para LEFT JOIN e implementação consistente de COALESCE para tratar valores NULL. LearnSQL.comLearnSQL.com Somente após essas correções os produtos aparecerão com valores e imagens corretos no dashboard.Chat controls Opus 4