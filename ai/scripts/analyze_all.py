#!/usr/bin/env python3
"""
Script principal de análise com IA
Gera insights acionáveis baseados em todos os dados coletados
"""

import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import warnings
warnings.filterwarnings('ignore')

# Carregar variáveis de ambiente
load_dotenv()

class InsightsGenerator:
    def __init__(self):
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'postgres'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD')
        }
        
    def get_connection(self):
        """Conecta ao PostgreSQL"""
        return psycopg2.connect(**self.db_config, cursor_factory=RealDictCursor)
    
    def analyze_stockout_risk(self, lookback_days=30):
        """Analisa risco de stockout para todos os produtos"""
        insights = []
        
        query = """
        WITH inventory_status AS (
            SELECT 
                i.asin,
                i.sku,
                p.name as product_name,
                i.fulfillable_quantity,
                i.inbound_working_quantity,
                i.inbound_shipped_quantity,
                i.days_of_supply,
                i.alert_status,
                p.lead_time_days,
                p.price as unit_price
            FROM inventory_snapshots i
            JOIN products p ON i.asin = p.asin
            WHERE i.snapshot_time = (
                SELECT MAX(snapshot_time) 
                FROM inventory_snapshots i2 
                WHERE i2.asin = i.asin
            )
        ),
        sales_velocity AS (
            SELECT 
                asin,
                AVG(units_ordered) as avg_daily_sales,
                STDDEV(units_ordered) as stddev_sales,
                MAX(units_ordered) as max_daily_sales
            FROM sales_metrics
            WHERE date >= CURRENT_DATE - INTERVAL '%s days'
            GROUP BY asin
        )
        SELECT 
            i.*,
            s.avg_daily_sales,
            s.stddev_sales,
            s.max_daily_sales,
            CASE 
                WHEN i.fulfillable_quantity > 0 AND s.avg_daily_sales > 0
                THEN i.fulfillable_quantity / s.avg_daily_sales
                ELSE i.days_of_supply
            END as calculated_days_of_supply
        FROM inventory_status i
        LEFT JOIN sales_velocity s ON i.asin = s.asin
        WHERE i.alert_status IN ('critical', 'low')
        OR (s.avg_daily_sales > 0 AND i.fulfillable_quantity / s.avg_daily_sales < i.lead_time_days + 7)
        """ % lookback_days
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()
                
        for row in results:
            if not row['avg_daily_sales'] or row['avg_daily_sales'] == 0:
                continue
                
            days_until_stockout = row['calculated_days_of_supply']
            lead_time = row['lead_time_days'] or 21  # Default 21 dias
            
            # Calcular quantidade de reorder considerando variabilidade
            safety_stock_days = 7 + (row['stddev_sales'] or 0) * 2  # 2 desvios padrão
            reorder_days = lead_time + safety_stock_days + 30  # 30 dias adicionais
            reorder_quantity = int(row['avg_daily_sales'] * reorder_days)
            
            # Calcular urgência e impacto
            urgency = 'critical' if days_until_stockout < lead_time else 'high'
            potential_lost_sales = row['avg_daily_sales'] * max(0, lead_time - days_until_stockout) * row['unit_price']
            
            insight = {
                'asin': row['asin'],
                'type': 'restock',
                'priority': urgency,
                'title': f'Risco de Stockout: {row["product_name"][:50]}',
                'description': f'Estoque acabará em {int(days_until_stockout)} dias. '
                             f'Lead time: {lead_time} dias. '
                             f'Velocidade: {row["avg_daily_sales"]:.1f} un/dia.',
                'recommendation': f'Enviar {reorder_quantity} unidades para FBA imediatamente. '
                                f'Quantidade cobre {int(reorder_days)} dias de vendas.',
                'supporting_data': {
                    'current_stock': row['fulfillable_quantity'],
                    'inbound_quantity': row['inbound_working_quantity'] + row['inbound_shipped_quantity'],
                    'daily_velocity': round(row['avg_daily_sales'], 1),
                    'days_until_stockout': int(days_until_stockout),
                    'lead_time_days': lead_time,
                    'reorder_quantity': reorder_quantity,
                    'safety_stock_days': int(safety_stock_days)
                },
                'confidence_score': 0.9 if row['stddev_sales'] < row['avg_daily_sales'] * 0.3 else 0.7,
                'potential_impact': round(potential_lost_sales, 2),
                'model_name': 'stockout_analyzer',
                'model_version': '1.0'
            }
            
            insights.append(insight)
            
        return insights
    
    def analyze_pricing_opportunities(self, lookback_hours=24):
        """Analisa oportunidades de otimização de preço"""
        insights = []
        
        query = """
        WITH current_pricing AS (
            SELECT 
                p.asin,
                p.name as product_name,
                p.price as our_price,
                p.buy_box_percentage,
                p.cost as unit_cost
            FROM products p
            WHERE p.active = true
            AND p.marketplace = 'amazon'
        ),
        competitor_pricing AS (
            SELECT 
                ct.asin,
                MIN(ct.price) as min_competitor_price,
                AVG(ct.price) as avg_competitor_price,
                COUNT(DISTINCT ct.competitor_seller_id) as competitor_count,
                COUNT(*) FILTER (WHERE ct.is_buy_box_winner) as buy_box_wins,
                MAX(CASE WHEN ct.is_buy_box_winner THEN ct.price END) as buy_box_price,
                MAX(CASE WHEN ct.is_buy_box_winner THEN ct.seller_name END) as buy_box_seller
            FROM competitor_tracking_advanced ct
            WHERE ct.timestamp >= NOW() - INTERVAL '%s hours'
            GROUP BY ct.asin
        ),
        sales_data AS (
            SELECT 
                asin,
                SUM(units_ordered) as recent_units,
                AVG(unit_session_percentage) as conversion_rate
            FROM sales_metrics
            WHERE date >= CURRENT_DATE - 7
            GROUP BY asin
        )
        SELECT 
            cp.*,
            comp.min_competitor_price,
            comp.avg_competitor_price,
            comp.competitor_count,
            comp.buy_box_price,
            comp.buy_box_seller,
            comp.buy_box_wins,
            sd.recent_units,
            sd.conversion_rate,
            (cp.our_price - cp.unit_cost) / cp.our_price as profit_margin,
            (cp.our_price - comp.min_competitor_price) / cp.our_price * 100 as price_gap_pct
        FROM current_pricing cp
        LEFT JOIN competitor_pricing comp ON cp.asin = comp.asin
        LEFT JOIN sales_data sd ON cp.asin = sd.asin
        WHERE comp.min_competitor_price IS NOT NULL
        AND (
            (cp.buy_box_percentage < 70 AND comp.min_competitor_price < cp.our_price)
            OR (comp.buy_box_price < cp.our_price * 0.95)
        )
        """ % lookback_hours
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()
                
        for row in results:
            # Calcular preço sugerido
            if row['buy_box_percentage'] < 50:
                # Perdendo muito Buy Box - ser agressivo
                suggested_price = row['min_competitor_price'] * 0.99
            elif row['buy_box_percentage'] < 70:
                # Perdendo moderadamente - igualar
                suggested_price = row['buy_box_price'] or row['min_competitor_price']
            else:
                # Pequeno ajuste
                suggested_price = row['our_price'] * 0.98
                
            # Garantir margem mínima de 15%
            min_price_with_margin = row['unit_cost'] / 0.85 if row['unit_cost'] else row['our_price'] * 0.7
            suggested_price = max(suggested_price, min_price_with_margin)
            
            # Calcular impacto estimado
            price_reduction_pct = (row['our_price'] - suggested_price) / row['our_price'] * 100
            
            # Estimar aumento de vendas baseado em elasticidade
            elasticity = -2.0  # Elasticidade típica para produtos Amazon
            sales_increase_pct = abs(price_reduction_pct * elasticity)
            
            current_daily_sales = (row['recent_units'] or 0) / 7
            expected_daily_sales = current_daily_sales * (1 + sales_increase_pct / 100)
            
            daily_revenue_change = (expected_daily_sales * suggested_price) - (current_daily_sales * row['our_price'])
            monthly_impact = daily_revenue_change * 30
            
            insight = {
                'asin': row['asin'],
                'type': 'pricing',
                'priority': 'high' if row['buy_box_percentage'] < 50 else 'medium',
                'title': f'Otimizar Preço: {row["product_name"][:50]}',
                'description': f'Buy Box em {row["buy_box_percentage"]:.0f}%. '
                             f'Seu preço está {row["price_gap_pct"]:.1f}% acima do menor competidor.',
                'recommendation': f'Reduzir preço de R$ {row["our_price"]:.2f} para R$ {suggested_price:.2f} '
                                f'(-{price_reduction_pct:.1f}%) para recuperar Buy Box.',
                'competitor_name': row['buy_box_seller'],
                'competitor_action': 'price_competition',
                'supporting_data': {
                    'current_price': float(row['our_price']),
                    'suggested_price': round(suggested_price, 2),
                    'min_competitor_price': float(row['min_competitor_price']),
                    'buy_box_price': float(row['buy_box_price']) if row['buy_box_price'] else None,
                    'buy_box_percentage': float(row['buy_box_percentage']),
                    'competitor_count': row['competitor_count'],
                    'price_reduction_pct': round(price_reduction_pct, 1),
                    'expected_sales_increase_pct': round(sales_increase_pct, 1),
                    'current_margin': round(row['profit_margin'] * 100, 1)
                },
                'confidence_score': 0.85 if row['competitor_count'] > 2 else 0.75,
                'potential_impact': round(monthly_impact, 2),
                'model_name': 'price_optimizer',
                'model_version': '1.0'
            }
            
            insights.append(insight)
            
        return insights
    
    def analyze_new_competitors(self, lookback_days=7):
        """Detecta e analisa novos competidores"""
        insights = []
        
        query = """
        WITH new_competitors AS (
            SELECT 
                ct.competitor_seller_id,
                ct.seller_name,
                COUNT(DISTINCT ct.asin) as products_count,
                AVG(ct.price) as avg_price,
                COUNT(*) FILTER (WHERE ct.is_buy_box_winner) as buy_box_wins,
                AVG(ct.feedback_rating) as avg_rating,
                MIN(ct.timestamp) as first_seen
            FROM competitor_tracking_advanced ct
            WHERE ct.timestamp >= NOW() - INTERVAL '%s days'
            AND ct.competitor_seller_id NOT IN (
                SELECT DISTINCT competitor_seller_id
                FROM competitor_tracking_advanced
                WHERE timestamp < NOW() - INTERVAL '%s days'
            )
            GROUP BY ct.competitor_seller_id, ct.seller_name
            HAVING COUNT(DISTINCT ct.asin) >= 3
            OR COUNT(*) FILTER (WHERE ct.is_buy_box_winner) >= 2
        ),
        affected_products AS (
            SELECT 
                nc.competitor_seller_id,
                array_agg(DISTINCT p.name) as product_names,
                array_agg(DISTINCT ct.asin) as asins
            FROM new_competitors nc
            JOIN competitor_tracking_advanced ct ON nc.competitor_seller_id = ct.competitor_seller_id
            JOIN products p ON ct.asin = p.asin
            WHERE ct.timestamp >= NOW() - INTERVAL '%s days'
            GROUP BY nc.competitor_seller_id
        )
        SELECT 
            nc.*,
            ap.product_names,
            ap.asins
        FROM new_competitors nc
        LEFT JOIN affected_products ap ON nc.competitor_seller_id = ap.competitor_seller_id
        ORDER BY nc.buy_box_wins DESC, nc.products_count DESC
        """ % (lookback_days, lookback_days, lookback_days)
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()
                
        for row in results:
            # Determinar nível de ameaça
            threat_level = 'high'
            if row['buy_box_wins'] > 5:
                threat_level = 'critical'
            elif row['buy_box_wins'] < 2:
                threat_level = 'medium'
                
            product_list = ', '.join(row['product_names'][:3])
            if len(row['product_names']) > 3:
                product_list += f' e mais {len(row["product_names"]) - 3}'
                
            insight = {
                'asin': 'GLOBAL',  # Insight global, não específico de ASIN
                'type': 'competitor',
                'priority': threat_level,
                'title': f'Novo Competidor Detectado: {row["seller_name"]}',
                'description': f'Competindo em {row["products_count"]} produtos. '
                             f'Ganhou Buy Box {row["buy_box_wins"]} vezes. '
                             f'Preço médio: R$ {row["avg_price"]:.2f}',
                'recommendation': f'Monitorar estratégia de preços em: {product_list}. '
                                f'Considerar ajuste preventivo de preços.',
                'competitor_name': row['seller_name'],
                'competitor_action': 'new_market_entry',
                'supporting_data': {
                    'seller_id': row['competitor_seller_id'],
                    'products_affected': row['products_count'],
                    'buy_box_wins': row['buy_box_wins'],
                    'avg_price': round(row['avg_price'], 2),
                    'avg_rating': round(row['avg_rating'], 1) if row['avg_rating'] else None,
                    'first_seen': row['first_seen'].isoformat(),
                    'affected_asins': row['asins'][:10]  # Limitar para não ficar muito grande
                },
                'confidence_score': 0.95,
                'potential_impact': row['products_count'] * 1000,  # Impacto estimado
                'model_name': 'competitor_detector',
                'model_version': '1.0'
            }
            
            insights.append(insight)
            
        return insights
    
    def analyze_buy_box_losses(self, lookback_hours=24):
        """Analisa perdas recentes de Buy Box"""
        insights = []
        
        query = """
        WITH buy_box_changes AS (
            SELECT 
                ct.asin,
                p.name as product_name,
                p.price as our_price,
                ct.seller_name as new_winner,
                ct.price as winner_price,
                ct.timestamp as lost_at,
                LAG(ct.seller_name) OVER (PARTITION BY ct.asin ORDER BY ct.timestamp) as previous_winner
            FROM competitor_tracking_advanced ct
            JOIN products p ON ct.asin = p.asin
            WHERE ct.is_buy_box_winner = true
            AND ct.timestamp >= NOW() - INTERVAL '%s hours'
        ),
        recent_losses AS (
            SELECT *
            FROM buy_box_changes
            WHERE previous_winner = 'Sua Loja'
            AND new_winner != 'Sua Loja'
        )
        SELECT 
            rl.*,
            sm.units_ordered as daily_sales,
            sm.ordered_product_sales as daily_revenue
        FROM recent_losses rl
        LEFT JOIN LATERAL (
            SELECT 
                AVG(units_ordered) as units_ordered,
                AVG(ordered_product_sales) as ordered_product_sales
            FROM sales_metrics
            WHERE asin = rl.asin
            AND date >= CURRENT_DATE - 7
        ) sm ON true
        """ % lookback_hours
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()
                
        for row in results:
            price_diff = row['our_price'] - row['winner_price']
            price_diff_pct = (price_diff / row['our_price']) * 100
            
            # Estimar perda de vendas
            hours_since_loss = (datetime.now() - row['lost_at']).total_seconds() / 3600
            estimated_lost_sales = (row['daily_sales'] or 0) * (hours_since_loss / 24) * 0.7  # 70% das vendas vêm da Buy Box
            estimated_lost_revenue = estimated_lost_sales * row['our_price']
            
            insight = {
                'asin': row['asin'],
                'type': 'buy_box',
                'priority': 'critical',
                'title': f'Buy Box Perdida: {row["product_name"][:50]}',
                'description': f'Perdeu Buy Box para {row["new_winner"]} há {hours_since_loss:.1f} horas. '
                             f'Competidor está R$ {price_diff:.2f} ({price_diff_pct:.1f}%) mais barato.',
                'recommendation': f'Ajustar preço para R$ {row["winner_price"] * 0.99:.2f} '
                                f'para recuperar Buy Box imediatamente.',
                'competitor_name': row['new_winner'],
                'competitor_action': 'won_buy_box',
                'supporting_data': {
                    'asin': row['asin'],
                    'our_price': float(row['our_price']),
                    'competitor_price': float(row['winner_price']),
                    'price_difference': round(price_diff, 2),
                    'price_difference_pct': round(price_diff_pct, 1),
                    'hours_since_loss': round(hours_since_loss, 1),
                    'estimated_lost_sales': round(estimated_lost_sales, 1),
                    'daily_sales_avg': round(row['daily_sales'] or 0, 1)
                },
                'confidence_score': 0.95,
                'potential_impact': round(estimated_lost_revenue * 30, 2),  # Impacto mensal se não recuperar
                'model_name': 'buy_box_analyzer',
                'model_version': '1.0'
            }
            
            insights.append(insight)
            
        return insights
    
    def generate_all_insights(self, params):
        """Gera todos os insights disponíveis"""
        all_insights = []
        
        try:
            # 1. Análise de Stockout
            stockout_insights = self.analyze_stockout_risk(
                lookback_days=params.get('lookback_days', 30)
            )
            all_insights.extend(stockout_insights)
            
            # 2. Oportunidades de Pricing
            pricing_insights = self.analyze_pricing_opportunities()
            all_insights.extend(pricing_insights)
            
            # 3. Novos Competidores
            competitor_insights = self.analyze_new_competitors()
            all_insights.extend(competitor_insights)
            
            # 4. Perdas de Buy Box
            buybox_insights = self.analyze_buy_box_losses()
            all_insights.extend(buybox_insights)
            
            # Filtrar por confidence threshold
            confidence_threshold = params.get('confidence_threshold', 0.7)
            filtered_insights = [
                i for i in all_insights 
                if i['confidence_score'] >= confidence_threshold
            ]
            
            # Ordenar por prioridade e impacto
            priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
            filtered_insights.sort(
                key=lambda x: (
                    priority_order.get(x['priority'], 99),
                    -x.get('potential_impact', 0)
                )
            )
            
            return {
                'success': True,
                'data': {
                    'insights': filtered_insights[:50],  # Limitar a 50 insights
                    'total_generated': len(all_insights),
                    'total_filtered': len(filtered_insights),
                    'timestamp': datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

def main():
    """Função principal"""
    # Ler input do Node.js
    input_data = json.loads(sys.stdin.read())
    
    generator = InsightsGenerator()
    
    if input_data.get('command') == 'generate_insights':
        result = generator.generate_all_insights(input_data.get('params', {}))
    else:
        result = {
            'success': False,
            'error': f'Unknown command: {input_data.get("command")}'
        }
    
    # Retornar resultado
    print(json.dumps(result))

if __name__ == '__main__':
    main()