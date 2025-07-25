// Script para criar queries simplificadas do Data Kiosk

const fs = require('fs');
const path = require('path');

// Criar versão mínima das queries
const simplifiedQueries = `/**
 * Queries GraphQL para Amazon Data Kiosk
 * Versão simplificada com apenas campos válidos confirmados
 */
class DataKioskQueries {
  /**
   * Query para métricas diárias de vendas e tráfego (simplificada)
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
              unitsOrdered
              totalOrderItems
            }
            traffic {
              pageViews
              sessions
              buyBoxPercentage
              unitSessionPercentage
            }
          }
        }
      }
    \`;
  }

  /**
   * Query para métricas por ASIN (simplificada)
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
              unitsOrdered
              totalOrderItems
            }
            traffic {
              pageViews
              sessions
              buyBoxPercentage
              unitSessionPercentage
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

// Salvar arquivo
const filePath = path.join(__dirname, '../server/services/dataKiosk/dataKioskQueries.js');

console.log('🔧 CORRIGINDO QUERIES DO DATA KIOSK (VERSÃO FINAL)');
console.log('='.repeat(50));

try {
  // Salvar versão simplificada
  fs.writeFileSync(filePath, simplifiedQueries);
  console.log('✅ Queries simplificadas salvas');
  
  console.log('\n📋 Campos mantidos (confirmados válidos):');
  console.log('Sales:');
  console.log('  - orderedProductSales (amount, currencyCode)');
  console.log('  - unitsOrdered');
  console.log('  - totalOrderItems');
  console.log('\nTraffic:');
  console.log('  - pageViews');
  console.log('  - sessions');
  console.log('  - buyBoxPercentage');
  console.log('  - unitSessionPercentage');
  
  console.log('\n❌ Campos removidos (inválidos):');
  console.log('  - pageViewsPercentage, pageViewsPercentageB2B');
  console.log('  - sessionPercentage, sessionPercentageB2B');
  console.log('  - Todos os campos B2B');
  
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}

console.log('\n✅ Correção final concluída!');