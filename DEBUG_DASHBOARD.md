NSTRUÇÕES PARA O CLAUDE CODE - CORREÇÃO URGENTE DO DASHBOARD
PROBLEMA IDENTIFICADO:
O dashboard está tentando acessar productsResponse.data.products, mas a API está retornando uma estrutura diferente.

CORREÇÕES NECESSÁRIAS:

## 1. VERIFICAR ESTRUTURA DA RESPOSTA DA API

No arquivo Dashboard.tsx, linha 66, o código espera:
productsResponse.data.products.length

Mas a API provavelmente está retornando:
- productsResponse.data (array direto)
- ou productsResponse.data com estrutura diferente

### CORREÇÃO NO DASHBOARD.TSX:

```javascript
// ALTERAR DE:
setProducts(productsResponse.data.products || []);

// PARA:
// Verificar a estrutura real da resposta
console.log('Resposta da API products:', productsResponse.data);
const productsData = Array.isArray(productsResponse.data) 
  ? productsResponse.data 
  : (productsResponse.data?.products || productsResponse.data?.data || []);

setProducts(productsData);

// E ajustar a verificação de length:
if (productsData.length === 0) {
  // mostrar mensagem
}
2. VERIFICAR ENDPOINTS DA API
Verificar se os endpoints existem e retornam dados:

/api/dashboard/products
/api/dashboard/metrics

CRIAR OS ENDPOINTS SE NÃO EXISTIREM:
javascript// pages/api/dashboard/products.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateRange = searchParams.get('dateRange') || 'today';
    const marketplace = searchParams.get('marketplace') || 'all';
    
    // Query REAL no banco
    const query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.asin,
        p.image_url,
        p.marketplace,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        COALESCE(SUM(oi.price * oi.quantity), 0) as revenue,
        COALESCE(SUM((oi.price - COALESCE(oi.cost, 0)) * oi.quantity), 0) as profit
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE 1=1
        ${marketplace !== 'all' ? 'AND p.marketplace = $1' : ''}
      GROUP BY p.id
      ORDER BY units_sold DESC
      LIMIT 100
    `;
    
    const products = await db.query(query, marketplace !== 'all' ? [marketplace] : []);
    
    // Retornar array direto ou objeto com products
    return NextResponse.json(products.rows || []);
    
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return NextResponse.json([], { status: 500 });
  }
}
3. ADICIONAR BOTÃO DE SINCRONIZAÇÃO MANUAL
Como não há dados, adicione um botão visível para sincronizar:
jsx// No Dashboard.tsx, dentro do return:
{products.length === 0 && !loading && (
  <div className="bg-white rounded-lg p-8 text-center">
    <h3 className="text-xl font-semibold mb-4">Nenhum produto encontrado</h3>
    <p className="text-gray-600 mb-6">
      Clique no botão abaixo para sincronizar seus produtos da Amazon e Mercado Livre
    </p>
    <button
      onClick={triggerManualSync}
      className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600"
    >
      🔄 Sincronizar Agora
    </button>
  </div>
)}
4. VERIFICAR SE O BANCO TEM AS TABELAS
Execute este script para verificar:
javascript// scripts/checkDatabase.js
const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Verificar tabelas
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tabelas encontradas:', tables.rows);
    
    // Verificar produtos
    const products = await pool.query('SELECT COUNT(*) FROM products');
    console.log('Total de produtos:', products.rows[0].count);
    
    // Verificar pedidos
    const orders = await pool.query('SELECT COUNT(*) FROM orders');
    console.log('Total de pedidos:', orders.rows[0].count);
    
  } catch (error) {
    console.error('Erro:', error);
    console.log('\n⚠️  Execute: npm run db:migrate para criar as tabelas');
  }
  
  pool.end();
}

checkDatabase();
5. IMPLEMENTAR SINCRONIZAÇÃO BÁSICA
Se não existe, crie:
javascript// pages/api/sync/trigger.ts
export async function POST() {
  try {
    // Importar e executar sincronizador
    const { syncAmazonData } = await import('@/services/amazon/sync');
    const { syncMercadoLivreData } = await import('@/services/mercadolivre/sync');
    
    // Executar em paralelo
    await Promise.all([
      syncAmazonData(),
      syncMercadoLivreData()
    ]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro na sincronização:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
AÇÕES IMEDIATAS:

Corrigir a estrutura de resposta no Dashboard.tsx
Verificar se os endpoints da API existem
Adicionar logs para debug
Implementar botão de sincronização visível
Verificar se o banco tem as tabelas necessárias

Execute na ordem:

node scripts/checkDatabase.js (verificar banco)
Corrigir Dashboard.tsx com os ajustes acima
Testar novamente

O erro está acontecendo porque a API não está retornando dados na estrutura esperada!