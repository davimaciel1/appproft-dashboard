/**
 * Queries GraphQL para Amazon Data Kiosk
 * Baseado na documentação oficial da API
 */
class DataKioskQueries {
  /**
   * Query para métricas diárias de vendas e tráfego
   */
  static getDailyMetricsQuery(startDate, endDate, marketplaceId) {
    return `
      query DailyMetrics {
        analytics_salesAndTraffic_2023_11_15 {
          salesAndTrafficByDate(
            startDate: "${startDate}"
            endDate: "${endDate}"
            aggregateBy: DAY
            marketplaceIds: ["${marketplaceId}"]
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
              averageSalesPerOrderItem { 
                amount 
                currencyCode 
              }
              averageUnitsPerOrderItem
              averageSellingPrice { 
                amount 
                currencyCode 
              }
              unitsRefunded
              refundRate
              claimsGranted
              claimsAmount { 
                amount 
                currencyCode 
              }
              shippedProductSales { 
                amount 
                currencyCode 
              }
              unitsShipped
              ordersShipped
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
              averageOfferCount
              averageParentItems
              feedbackReceived
              negativeFeedbackReceived
              receivedNegativeFeedbackRate
            }
          }
        }
      }
    `;
  }

  /**
   * Query para métricas por ASIN
   */
  static getAsinMetricsQuery(startDate, endDate, marketplaceId, asinGranularity = 'CHILD') {
    return `
      query AsinMetrics {
        analytics_salesAndTraffic_2023_11_15 {
          salesAndTrafficByAsin(
            startDate: "${startDate}"
            endDate: "${endDate}"
            aggregateBy: ${asinGranularity}
            marketplaceIds: ["${marketplaceId}"]
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
              averageSellingPrice { 
                amount 
                currencyCode 
              }
              unitsRefunded
              refundRate
              shippedProductSales { 
                amount 
                currencyCode 
              }
              unitsShipped
              ordersShipped
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
    `;
  }

  /**
   * Query para métricas semanais
   */
  static getWeeklyMetricsQuery(startDate, endDate, marketplaceId) {
    return `
      query WeeklyMetrics {
        analytics_salesAndTraffic_2023_11_15 {
          salesAndTrafficByDate(
            startDate: "${startDate}"
            endDate: "${endDate}"
            aggregateBy: WEEK
            marketplaceIds: ["${marketplaceId}"]
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
              averageSalesPerOrderItem { 
                amount 
                currencyCode 
              }
              averageSellingPrice { 
                amount 
                currencyCode 
              }
              unitsRefunded
              refundRate
            }
            traffic {
              pageViews
              sessions
              buyBoxPercentage
              unitSessionPercentage
              feedbackReceived
              negativeFeedbackReceived
            }
          }
        }
      }
    `;
  }

  /**
   * Query para métricas mensais
   */
  static getMonthlyMetricsQuery(startDate, endDate, marketplaceId) {
    return `
      query MonthlyMetrics {
        analytics_salesAndTraffic_2023_11_15 {
          salesAndTrafficByDate(
            startDate: "${startDate}"
            endDate: "${endDate}"
            aggregateBy: MONTH
            marketplaceIds: ["${marketplaceId}"]
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
              averageSalesPerOrderItem { 
                amount 
                currencyCode 
              }
              unitsRefunded
              refundRate
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
    `;
  }

  /**
   * Query customizada para AppProft Dashboard
   * Focada nas métricas principais do dashboard
   */
  static getAppProftDashboardQuery(date, marketplaceId) {
    return `
      query AppProftDashboard {
        analytics_salesAndTraffic_2023_11_15 {
          todayMetrics: salesAndTrafficByDate(
            startDate: "${date}"
            endDate: "${date}"
            aggregateBy: DAY
            marketplaceIds: ["${marketplaceId}"]
          ) {
            sales {
              orderedProductSales { amount }
              unitsOrdered
              totalOrderItems
              averageSalesPerOrderItem { amount }
            }
            traffic {
              buyBoxPercentage
              unitSessionPercentage
            }
          }
          
          last30Days: salesAndTrafficByDate(
            startDate: "${this.getDateDaysAgo(date, 30)}"
            endDate: "${date}"
            aggregateBy: DAY
            marketplaceIds: ["${marketplaceId}"]
          ) {
            sales {
              orderedProductSales { amount }
              unitsOrdered
              refundRate
            }
            traffic {
              pageViews
              sessions
              buyBoxPercentage
            }
          }
        }
      }
    `;
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