Aqui estão as instruções para o Claude Code resolver os problemas:

INSTRUÇÕES PARA CORRIGIR O DASHBOARD - PROBLEMAS CRÍTICOS:
O dashboard está com 3 problemas principais que precisam ser corrigidos URGENTEMENTE:

## 1. IMAGENS DOS PRODUTOS NÃO APARECEM

PROBLEMA: Está mostrando apenas um ícone "A" laranja ao invés da imagem real do produto

SOLUÇÃO:
1. Verificar se a coluna image_url existe na tabela products
2. Adicionar query para buscar imagens:
   ```sql
   SELECT 
     p.id,
     p.name,
     p.sku,
     p.asin,
     p.image_url,
     p.thumbnail_url,
     COALESCE(p.image_url, p.thumbnail_url, '/placeholder-product.png') as product_image
   FROM products p

No componente ProductRow.jsx:
jsx<div className="product-image-container">
  <img 
    src={product.product_image || '/placeholder-product.png'}
    alt={product.name}
    className="w-[60px] h-[60px] object-cover rounded-lg"
    onError={(e) => {
      e.target.src = '/placeholder-product.png';
    }}
  />
  {/* Logo do marketplace */}
  <img 
    src={`/icons/${product.marketplace}-logo.svg`}
    className="absolute bottom-0 right-0 w-5 h-5 bg-white rounded-full p-0.5"
  />
</div>

Se não houver imagens no banco, implementar sync com APIs:

Amazon: usar o endpoint getCatalogItem com includedData=['images']
ML: usar o endpoint /items/{id} que retorna pictures array



2. MUDAR COR DE VERDE PARA LARANJA
PROBLEMA: O header está verde (#16A34A) mas deveria ser laranja AppProft (#FF8C00)
SOLUÇÃO:

Localizar todos os lugares com cor verde e substituir:

Header background: de bg-green-600 para bg-orange-500 ou style={{backgroundColor: '#FF8C00'}}
Botões: de bg-green-500 para bg-orange-500
Texto "Get a discount!": manter branco mas fundo laranja


Criar variáveis CSS no global.css:
css:root {
  --primary-orange: #FF8C00;
  --primary-dark: #1a1f36;
  --success-green: #28a745;
}

Usar as variáveis:
jsx<div style={{ backgroundColor: 'var(--primary-orange)' }}>
  Sales
</div>


3. AGRUPAR VENDAS POR PRODUTO
PROBLEMA: Os produtos estão aparecendo individualmente ao invés de agrupados com soma total de vendas
SOLUÇÃO:

Criar query SQL que agrupa por produto:
sqlWITH product_sales AS (
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.asin,
    p.image_url,
    p.marketplace,
    SUM(oi.quantity) as total_units,
    COUNT(DISTINCT o.id) as total_orders,
    SUM(oi.price * oi.quantity) as total_revenue,
    SUM((oi.price - COALESCE(oi.cost, 0)) * oi.quantity) as total_profit,
    -- Vendas do período selecionado
    SUM(CASE WHEN o.created_at >= $2 THEN oi.quantity ELSE 0 END) as period_units,
    -- ACOS médio
    AVG(am.acos) as avg_acos
  FROM products p
  LEFT JOIN order_items oi ON p.id = oi.product_id
  LEFT JOIN orders o ON oi.order_id = o.id
  LEFT JOIN advertising_metrics am ON p.id = am.product_id
  WHERE p.tenant_id = $1
    AND o.status NOT IN ('cancelled', 'returned')
  GROUP BY p.id, p.name, p.sku, p.asin, p.image_url, p.marketplace
  ORDER BY total_units DESC
)
SELECT * FROM product_sales;

Na API endpoint:
javascript// api/products.js
app.get('/api/products/sales', async (req, res) => {
  const { timeFilter } = req.query;
  const startDate = getStartDateFromFilter(timeFilter);
  
  const products = await db.query(productSalesQuery, [
    req.user.tenantId,
    startDate
  ]);
  
  res.json(products.rows);
});

No frontend, garantir que está usando o endpoint correto:
javascriptconst fetchProducts = async () => {
  const response = await fetch(`/api/products/sales?timeFilter=${selectedTime}`);
  const data = await response.json();
  setProducts(data);
};


CHECKLIST DE CORREÇÕES:

 Adicionar coluna image_url na tabela products se não existir
 Implementar sync de imagens das APIs
 Substituir TODAS as cores verdes por laranja #FF8C00
 Criar query SQL que agrupa vendas por produto
 Mostrar total acumulado de vendas (não individual)
 Adicionar fallback para imagens quebradas
 Testar com dados reais do banco

RESULTADO ESPERADO:

Produtos com imagens reais (60x60px) ao invés do ícone "A"
Header e elementos principais em laranja AppProft (#FF8C00)
Vendas agrupadas mostrando total por produto, não vendas individuais

IMPORTANTE: Fazer essas correções ANTES de qualquer outra melhoria no dashboard.

---

**CÓDIGO DE EXEMPLO PARA SYNC DE IMAGENS:**

```javascript
// syncProductImages.js
async function syncAmazonProductImages(tenantId) {
  const productsWithoutImages = await db.query(
    'SELECT * FROM products WHERE tenant_id = $1 AND (image_url IS NULL OR image_url = \'\')',
    [tenantId]
  );

  for (const product of productsWithoutImages.rows) {
    try {
      const catalogItem = await amazonClient.callAPI({
        operation: 'getCatalogItem',
        path: { asin: product.asin },
        query: {
          marketplaceIds: ['A2Q3Y263D00KWC'],
          includedData: ['images', 'attributes']
        }
      });

      const mainImage = catalogItem.images?.[0]?.images?.find(
        img => img.variant === 'MAIN'
      )?.link;

      if (mainImage) {
        await db.query(
          'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2',
          [mainImage, product.id]
        );
      }
    } catch (error) {
      console.error(`Erro ao buscar imagem do produto ${product.asin}:`, error);
    }
  }
}