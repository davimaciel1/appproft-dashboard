// Script para ajustar as queries do Data Kiosk

const fs = require('fs');
const path = require('path');

// Criar versão corrigida do dataKioskQueries.js
const correctedQueries = `/**
 * Queries GraphQL para Amazon Data Kiosk
 * Versão corrigida com campos válidos
 */
class DataKioskQueries {
  /**
   * Query para métricas diárias de vendas e tráfego
   */
  static getDailyMetricsQuery(days = 30) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    const marketplaceId = process.env.SP_API_MARKETPLACE_ID || 'A2Q3Y263D00KWC';
    
    return \`
      query DailyMetrics {
        analytics_salesAndTraffic_2023_11_15 {
          salesAndTrafficByDate(
            startDate: "\${startDateStr}"
            endDate: "\${endDate}"
            aggregateBy: DAY
            marketplaceIds: ["\${marketplaceId}"]
          ) {
            startDate
            endDate
            marketplaceId
            sales {
              orderedProductSales { 
                amount 
                currencyCode 
              }
              orderedProductSalesB2B { 
                amount 
                currencyCode 
              }
              unitsOrdered
              unitsOrderedB2B
              totalOrderItems
              totalOrderItemsB2B
            }
            traffic {
              pageViews
              pageViewsB2B
              pageViewsPercentage
              pageViewsPercentageB2B
              sessions
              sessionsB2B
              sessionPercentage
              sessionPercentageB2B
              buyBoxPercentage
              buyBoxPercentageB2B
              unitSessionPercentage
              unitSessionPercentageB2B
            }
          }
        }
      }
    \`;
  }

  /**
   * Query para métricas por ASIN (versão simplificada)
   */
  static getAsinMetricsQuery(startDate, endDate, marketplaceId, asinGranularity = 'CHILD') {
    return \`
      query AsinMetrics {
        analytics_salesAndTraffic_2023_11_15 {
          salesAndTrafficByAsin(
            startDate: "\${startDate}"
            endDate: "\${endDate}"
            aggregateBy: \${asinGranularity}
            marketplaceIds: ["\${marketplaceId}"]
          ) {
            startDate
            endDate
            marketplaceId
            parentAsin
            childAsin
            sku
            sales {
              orderedProductSales { 
                amount 
                currencyCode 
              }
              orderedProductSalesB2B { 
                amount 
                currencyCode 
              }
              unitsOrdered
              unitsOrderedB2B
              totalOrderItems
              totalOrderItemsB2B
            }
            traffic {
              pageViews
              pageViewsB2B
              pageViewsPercentage
              pageViewsPercentageB2B
              sessions
              sessionsB2B
              sessionPercentage
              sessionPercentageB2B
              buyBoxPercentage
              buyBoxPercentageB2B
              unitSessionPercentage
              unitSessionPercentageB2B
            }
          }
        }
      }
    \`;
  }

  /**
   * Helper para calcular data anterior
   */
  static getDateDaysAgo(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}

module.exports = DataKioskQueries;
`;

// Salvar backup do arquivo original
const originalPath = path.join(__dirname, '../server/services/dataKiosk/dataKioskQueries.js');
const backupPath = path.join(__dirname, '../server/services/dataKiosk/dataKioskQueries.js.backup');

console.log('🔧 CORRIGINDO QUERIES DO DATA KIOSK');
console.log('='.repeat(50));

try {
  // Fazer backup
  if (fs.existsSync(originalPath)) {
    fs.copyFileSync(originalPath, backupPath);
    console.log('✅ Backup criado:', backupPath);
  }
  
  // Salvar versão corrigida
  fs.writeFileSync(originalPath, correctedQueries);
  console.log('✅ Queries corrigidas salvas em:', originalPath);
  
  console.log('\n📋 Alterações feitas:');
  console.log('- Removidos campos inválidos: averageSellingPrice, unitsRefunded, refundRate, etc.');
  console.log('- Mantidos apenas campos válidos da API');
  console.log('- Ajustado getDailyMetricsQuery para aceitar parâmetro de dias');
  
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}

console.log('\n✅ Correção concluída!');