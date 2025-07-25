#!/usr/bin/env python3
"""
Script de otimização de preços usando Machine Learning
Calcula elasticidade de preço e sugere preços ótimos considerando:
- Elasticidade própria e cruzada
- Dinâmica da Buy Box
- Margem de lucro mínima
- Comportamento dos competidores
"""

import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import warnings
warnings.filterwarnings('ignore')

load_dotenv()

class PriceOptimizer:
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
    
    def get_price_history(self, asin, days=90):
        """Busca histórico de preços e vendas"""
        query = """
        WITH price_changes AS (
            SELECT 
                p.asin,
                p.price,
                p.cost,
                p.updated_at as price_changed_at,
                LEAD(p.updated_at) OVER (PARTITION BY p.asin ORDER BY p.updated_at) as next_change
            FROM products p
            WHERE p.asin = %s
            AND p.updated_at >= CURRENT_DATE - INTERVAL '%s days'
        ),
        sales_with_prices AS (
            SELECT 
                sm.date,
                sm.units_ordered,
                sm.ordered_product_sales,
                sm.sessions,
                sm.buy_box_percentage,
                pc.price,
                pc.cost,
                (pc.price - pc.cost) / pc.price as margin
            FROM sales_metrics sm
            JOIN price_changes pc ON sm.asin = pc.asin
            AND sm.date >= pc.price_changed_at 
            AND (sm.date < pc.next_change OR pc.next_change IS NULL)
            WHERE sm.asin = %s
            AND sm.date >= CURRENT_DATE - INTERVAL '%s days'
        ),
        competitor_data AS (
            SELECT 
                date(ct.timestamp) as date,
                MIN(ct.price) as min_competitor_price,
                AVG(ct.price) as avg_competitor_price,
                COUNT(DISTINCT ct.competitor_seller_id) as competitor_count,
                MAX(CASE WHEN ct.is_buy_box_winner THEN ct.price END) as buy_box_price
            FROM competitor_tracking_advanced ct
            WHERE ct.asin = %s
            AND ct.timestamp >= NOW() - INTERVAL '%s days'
            GROUP BY date(ct.timestamp)
        )
        SELECT 
            s.*,
            c.min_competitor_price,
            c.avg_competitor_price,
            c.competitor_count,
            c.buy_box_price,
            CASE 
                WHEN c.min_competitor_price > 0 
                THEN (s.price - c.min_competitor_price) / c.min_competitor_price * 100
                ELSE 0 
            END as price_gap_pct
        FROM sales_with_prices s
        LEFT JOIN competitor_data c ON s.date = c.date
        ORDER BY s.date
        """
        
        with self.get_connection() as conn:
            df = pd.read_sql(query, conn, params=(asin, days, asin, days, asin, days))
            
        return df
    
    def calculate_price_elasticity(self, df):
        """Calcula elasticidade de preço própria"""
        if len(df) < 10:  # Mínimo de dados necessários
            return -2.0  # Elasticidade padrão
            
        # Preparar dados
        df = df.copy()
        df['log_price'] = np.log(df['price'])
        df['log_quantity'] = np.log(df['units_ordered'] + 1)  # +1 para evitar log(0)
        
        # Adicionar variáveis de controle
        df['day_of_week'] = pd.to_datetime(df['date']).dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Regressão log-log para elasticidade
        X = df[['log_price', 'buy_box_percentage', 'is_weekend']].values
        y = df['log_quantity'].values
        
        # Remover NaN
        mask = ~np.isnan(X).any(axis=1) & ~np.isnan(y)
        X = X[mask]
        y = y[mask]
        
        if len(X) < 10:
            return -2.0
            
        # Treinar modelo
        model = LinearRegression()
        model.fit(X, y)
        
        # Elasticidade é o coeficiente do log_price
        elasticity = model.coef_[0]
        
        # Limitar elasticidade a valores razoáveis
        return np.clip(elasticity, -5.0, -0.5)
    
    def calculate_cross_elasticity(self, asin, competitor_asins, days=90):
        """Calcula elasticidade cruzada com competidores"""
        cross_elasticities = {}
        
        # Por simplicidade, assumir elasticidade cruzada pequena
        # Em produção, calcular com base em dados reais
        for comp_asin in competitor_asins[:5]:  # Limitar a 5 competidores principais
            cross_elasticities[comp_asin] = 0.3  # Elasticidade cruzada típica
            
        return cross_elasticities
    
    def simulate_demand(self, current_price, new_price, current_velocity, elasticity, 
                       competitor_prices=None, cross_elasticities=None):
        """Simula demanda com novo preço"""
        # Efeito da mudança de preço próprio
        price_change_pct = (new_price - current_price) / current_price
        demand_change_pct = price_change_pct * elasticity
        
        # Efeito dos preços dos competidores (se disponível)
        if competitor_prices and cross_elasticities:
            for comp_asin, comp_price in competitor_prices.items():
                if comp_asin in cross_elasticities:
                    # Se nosso preço sobe e do competidor não, perdemos demanda
                    relative_change = price_change_pct
                    demand_change_pct += relative_change * cross_elasticities[comp_asin]
        
        # Nova velocidade estimada
        new_velocity = current_velocity * (1 + demand_change_pct)
        
        return max(0, new_velocity)
    
    def calculate_buy_box_probability(self, our_price, competitor_min_price, 
                                    current_buy_box_pct, rating=4.5):
        """Estima probabilidade de ganhar Buy Box"""
        if competitor_min_price is None or competitor_min_price == 0:
            return current_buy_box_pct / 100
            
        # Modelo simplificado de Buy Box
        # Fatores: preço relativo, rating, fulfillment (assumindo FBA)
        price_ratio = our_price / competitor_min_price
        
        # Função logística para probabilidade
        # Se preço igual, ~70% de chance (outros fatores)
        # Se 5% mais caro, ~30% de chance
        # Se 5% mais barato, ~90% de chance
        z = -20 * (price_ratio - 1.0) + 0.5 * (rating - 4.0)
        probability = 1 / (1 + np.exp(-z))
        
        return np.clip(probability, 0.05, 0.95)
    
    def optimize_price(self, asin, params):
        """Otimiza preço para um produto"""
        # Buscar dados históricos
        df = self.get_price_history(asin, params.get('elasticity_window', 90))
        
        if len(df) == 0:
            return None
            
        # Dados atuais
        current_state = df.iloc[-1]
        current_price = float(current_state['price'])
        current_velocity = float(current_state['units_ordered'])
        current_margin = float(current_state['margin'])
        current_buy_box = float(current_state['buy_box_percentage'])
        unit_cost = float(current_state['cost'])
        
        # Calcular elasticidade
        elasticity = self.calculate_price_elasticity(df)
        
        # Competidores
        competitor_min = current_state['min_competitor_price']
        competitor_avg = current_state['avg_competitor_price']
        
        # Definir range de preços para testar
        min_margin = params.get('min_margin', 0.15)
        min_price = unit_cost / (1 - min_margin)
        
        # Máximo: 20% acima do preço atual ou média dos competidores
        max_price = max(current_price * 1.2, 
                       competitor_avg * 1.1 if competitor_avg else current_price * 1.2)
        
        # Testar diferentes preços
        test_prices = np.linspace(min_price, max_price, 50)
        results = []
        
        for test_price in test_prices:
            # Simular demanda
            new_velocity = self.simulate_demand(
                current_price, test_price, current_velocity, elasticity
            )
            
            # Estimar Buy Box
            buy_box_prob = self.calculate_buy_box_probability(
                test_price, competitor_min, current_buy_box
            )
            
            # Considerar peso da Buy Box
            buy_box_weight = params.get('buy_box_weight', 0.7)
            effective_velocity = new_velocity * (buy_box_prob * buy_box_weight + 
                                               (1 - buy_box_weight))
            
            # Calcular métricas
            revenue = effective_velocity * test_price
            profit = effective_velocity * (test_price - unit_cost)
            margin = (test_price - unit_cost) / test_price
            
            results.append({
                'price': test_price,
                'velocity': effective_velocity,
                'revenue': revenue,
                'profit': profit,
                'margin': margin,
                'buy_box_prob': buy_box_prob
            })
        
        # Encontrar preço ótimo (maximizar lucro)
        results_df = pd.DataFrame(results)
        optimal_idx = results_df['profit'].idxmax()
        optimal = results_df.iloc[optimal_idx]
        
        # Calcular mudanças esperadas
        revenue_change = (optimal['revenue'] - current_velocity * current_price)
        profit_change = (optimal['profit'] - current_velocity * (current_price - unit_cost))
        
        return {
            'asin': asin,
            'current_price': current_price,
            'current_buy_box_pct': current_buy_box,
            'current_velocity': current_velocity,
            'current_margin': current_margin,
            'elasticity': elasticity,
            'cross_elasticity': {},  # Simplificado por enquanto
            'suggested_price': round(optimal['price'], 2),
            'price_range': {
                'min': round(min_price, 2),
                'max': round(max_price, 2)
            },
            'expected_buy_box_pct': round(optimal['buy_box_prob'] * 100, 1),
            'expected_velocity': round(optimal['velocity'], 1),
            'expected_revenue_change': round(revenue_change, 2),
            'expected_profit_change': round(profit_change, 2),
            'competitor_min_price': float(competitor_min) if competitor_min else None,
            'competitor_avg_price': float(competitor_avg) if competitor_avg else None,
            'confidence_score': 0.8 if len(df) > 30 else 0.6,
            'recommendation_reason': self._get_recommendation_reason(
                current_price, optimal['price'], current_buy_box, optimal['buy_box_prob']
            )
        }
    
    def _get_recommendation_reason(self, current_price, suggested_price, 
                                 current_bb, expected_bb):
        """Gera explicação da recomendação"""
        price_change_pct = (suggested_price - current_price) / current_price * 100
        
        if price_change_pct < -5:
            if current_bb < 50:
                return "Redução agressiva para recuperar Buy Box"
            else:
                return "Redução para aumentar volume mantendo margem"
        elif price_change_pct < 0:
            return "Pequeno ajuste para melhorar competitividade"
        elif price_change_pct > 5:
            return "Aumento possível devido a baixa elasticidade"
        else:
            return "Preço atual próximo do ótimo"
    
    def optimize_all_prices(self, params):
        """Otimiza preços de todos os produtos elegíveis"""
        # Buscar produtos para otimizar
        query = """
        SELECT DISTINCT p.asin
        FROM products p
        JOIN sales_metrics sm ON p.asin = sm.asin
        WHERE p.active = true
        AND p.marketplace = 'amazon'
        AND p.cost > 0
        AND sm.date >= CURRENT_DATE - 30
        GROUP BY p.asin
        HAVING COUNT(DISTINCT sm.date) >= 14
        AND SUM(sm.units_ordered) >= 10
        ORDER BY SUM(sm.ordered_product_sales) DESC
        LIMIT 50
        """
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                products = cursor.fetchall()
        
        optimizations = []
        errors = []
        
        for product in products:
            try:
                optimization = self.optimize_price(product['asin'], params)
                if optimization:
                    optimizations.append(optimization)
            except Exception as e:
                errors.append({
                    'asin': product['asin'],
                    'error': str(e)
                })
        
        # Ordenar por impacto no lucro
        optimizations.sort(key=lambda x: abs(x['expected_profit_change']), reverse=True)
        
        return {
            'success': True,
            'data': {
                'optimizations': optimizations[:20],  # Top 20
                'total_products': len(products),
                'successful_optimizations': len(optimizations),
                'errors': len(errors),
                'timestamp': datetime.now().isoformat(),
                'summary': self._generate_summary(optimizations)
            }
        }
    
    def _generate_summary(self, optimizations):
        """Gera resumo das otimizações"""
        if not optimizations:
            return {}
            
        total_revenue_impact = sum(o['expected_revenue_change'] for o in optimizations)
        total_profit_impact = sum(o['expected_profit_change'] for o in optimizations)
        
        price_increases = [o for o in optimizations if o['suggested_price'] > o['current_price']]
        price_decreases = [o for o in optimizations if o['suggested_price'] < o['current_price']]
        
        return {
            'total_revenue_impact_monthly': round(total_revenue_impact * 30, 2),
            'total_profit_impact_monthly': round(total_profit_impact * 30, 2),
            'products_to_increase': len(price_increases),
            'products_to_decrease': len(price_decreases),
            'avg_elasticity': round(np.mean([o['elasticity'] for o in optimizations]), 2),
            'avg_price_change_pct': round(
                np.mean([
                    (o['suggested_price'] - o['current_price']) / o['current_price'] * 100 
                    for o in optimizations
                ]), 1
            )
        }

def main():
    """Função principal"""
    # Ler input do Node.js
    input_data = json.loads(sys.stdin.read())
    
    optimizer = PriceOptimizer()
    
    if input_data.get('command') == 'optimize_all_prices':
        result = optimizer.optimize_all_prices(input_data.get('params', {}))
    elif input_data.get('command') == 'optimize_single':
        result = optimizer.optimize_price(
            input_data.get('asin'),
            input_data.get('params', {})
        )
        if result:
            result = {'success': True, 'data': result}
        else:
            result = {'success': False, 'error': 'No data available for optimization'}
    else:
        result = {
            'success': False,
            'error': f'Unknown command: {input_data.get("command")}'
        }
    
    # Retornar resultado
    print(json.dumps(result))

if __name__ == '__main__':
    main()