#!/usr/bin/env python3
"""
Script de previsão de demanda usando Prophet
Gera previsões de vendas para os próximos 30 dias
"""

import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import warnings
warnings.filterwarnings('ignore')

load_dotenv()

class DemandForecaster:
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
    
    def get_historical_data(self, asin, days=180):
        """Busca dados históricos de vendas"""
        query = """
        SELECT 
            date as ds,
            units_ordered as y,
            ordered_product_sales as revenue,
            EXTRACT(DOW FROM date) as day_of_week,
            EXTRACT(MONTH FROM date) as month,
            CASE 
                WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN 1 
                ELSE 0 
            END as is_weekend
        FROM sales_metrics
        WHERE asin = %s
        AND date >= CURRENT_DATE - INTERVAL '%s days'
        AND date < CURRENT_DATE
        ORDER BY date
        """
        
        with self.get_connection() as conn:
            df = pd.read_sql(query, conn, params=(asin, days))
            
        return df
    
    def get_product_info(self, asin):
        """Busca informações do produto"""
        query = """
        SELECT 
            p.asin,
            p.name,
            p.price,
            p.lead_time_days,
            p.min_order_quantity,
            AVG(i.fulfillable_quantity) as avg_inventory
        FROM products p
        LEFT JOIN inventory_snapshots i ON p.asin = i.asin
        WHERE p.asin = %s
        GROUP BY p.asin, p.name, p.price, p.lead_time_days, p.min_order_quantity
        """
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, (asin,))
                return cursor.fetchone()
    
    def add_brazilian_holidays(self, model):
        """Adiciona feriados brasileiros ao modelo"""
        # Feriados fixos
        model.add_country_holidays(country_name='BR')
        
        # Datas especiais de e-commerce
        for year in range(2022, 2026):
            # Black Friday (última sexta de novembro)
            black_friday = pd.Timestamp(year=year, month=11, day=1) + pd.DateOffset(weeks=3, weekday=4)
            model.add_seasonality(
                name='black_friday',
                period=365.25,
                fourier_order=5,
                condition_name='is_black_friday'
            )
            
            # Cyber Monday
            cyber_monday = black_friday + pd.DateOffset(days=3)
            
            # Prime Day (geralmente em julho)
            prime_day = pd.Timestamp(year=year, month=7, day=15)
            
        return model
    
    def forecast_demand(self, asin, forecast_days=30):
        """Gera previsão de demanda para um produto"""
        # Buscar dados históricos
        df = self.get_historical_data(asin)
        
        if len(df) < 30:  # Mínimo 30 dias de dados
            return None
            
        # Buscar informações do produto
        product_info = self.get_product_info(asin)
        
        # Preparar dados para Prophet
        df['cap'] = df['y'].max() * 2  # Cap para logistic growth
        df['floor'] = 0
        
        # Criar modelo
        model = Prophet(
            growth='linear',  # ou 'logistic' se houver saturação
            changepoint_prior_scale=0.05,
            seasonality_mode='multiplicative',
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            interval_width=0.95
        )
        
        # Adicionar feriados
        model = self.add_brazilian_holidays(model)
        
        # Adicionar regressores se disponíveis
        if 'is_weekend' in df.columns:
            model.add_regressor('is_weekend')
            
        # Treinar modelo
        model.fit(df)
        
        # Criar dataframe futuro
        future = model.make_future_dataframe(periods=forecast_days)
        future['cap'] = df['cap'].max()
        future['floor'] = 0
        
        # Adicionar regressores ao futuro
        future['is_weekend'] = (future['ds'].dt.dayofweek >= 5).astype(int)
        
        # Fazer previsão
        forecast = model.predict(future)
        
        # Calcular métricas de erro (se possível)
        mape = None
        if len(df) > 60:  # Precisa de dados suficientes para validação
            try:
                df_cv = cross_validation(model, initial='30 days', period='10 days', horizon='10 days')
                df_p = performance_metrics(df_cv)
                mape = df_p['mape'].mean()
            except:
                mape = None
                
        # Preparar resultado
        future_forecast = forecast[forecast['ds'] > df['ds'].max()].copy()
        
        # Calcular recomendações de estoque
        avg_daily_forecast = future_forecast['yhat'].mean()
        lead_time = product_info['lead_time_days'] or 21
        safety_stock_days = 7 + future_forecast['yhat'].std() / avg_daily_forecast * 2
        
        reorder_point = int(avg_daily_forecast * (lead_time + safety_stock_days))
        reorder_quantity = int(avg_daily_forecast * 30)  # 30 dias de estoque
        recommended_stock = int(avg_daily_forecast * (lead_time + safety_stock_days + 30))
        
        # Preparar dados diários
        daily_forecasts = []
        for _, row in future_forecast.iterrows():
            daily_forecasts.append({
                'date': row['ds'].strftime('%Y-%m-%d'),
                'units_forecast': max(0, int(row['yhat'])),
                'units_lower': max(0, int(row['yhat_lower'])),
                'units_upper': max(0, int(row['yhat_upper'])),
                'revenue_forecast': max(0, row['yhat'] * (product_info['price'] or 0)),
                'revenue_lower': max(0, row['yhat_lower'] * (product_info['price'] or 0)),
                'revenue_upper': max(0, row['yhat_upper'] * (product_info['price'] or 0)),
                'trend_factor': row.get('trend', 1.0) / row['yhat'] if row['yhat'] > 0 else 1.0,
                'seasonality_factor': (row.get('yearly', 0) + row.get('weekly', 0)) / row['yhat'] if row['yhat'] > 0 else 1.0,
                'promotion_factor': 1.0  # Placeholder
            })
            
        return {
            'asin': asin,
            'product_name': product_info['name'],
            'model_version': '3.0',
            'confidence_level': 0.95,
            'mape': mape,
            'recommended_stock_level': recommended_stock,
            'reorder_point': reorder_point,
            'reorder_quantity': reorder_quantity,
            'daily_forecasts': daily_forecasts,
            'summary': {
                'total_units_30d': sum(d['units_forecast'] for d in daily_forecasts),
                'total_revenue_30d': sum(d['revenue_forecast'] for d in daily_forecasts),
                'avg_daily_units': avg_daily_forecast,
                'growth_trend': 'increasing' if forecast['trend'].iloc[-1] > forecast['trend'].iloc[-30] else 'stable'
            }
        }
    
    def forecast_all_products(self, params):
        """Gera previsões para todos os produtos ativos"""
        forecast_days = params.get('forecast_days', 30)
        
        # Buscar produtos ativos
        query = """
        SELECT DISTINCT p.asin
        FROM products p
        JOIN sales_metrics sm ON p.asin = sm.asin
        WHERE p.active = true
        AND p.marketplace = 'amazon'
        GROUP BY p.asin
        HAVING COUNT(DISTINCT sm.date) >= 30
        LIMIT 100
        """
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query)
                products = cursor.fetchall()
                
        forecasts = []
        errors = []
        
        for product in products:
            try:
                forecast = self.forecast_demand(product['asin'], forecast_days)
                if forecast:
                    forecasts.append(forecast)
            except Exception as e:
                errors.append({
                    'asin': product['asin'],
                    'error': str(e)
                })
                
        return {
            'success': True,
            'data': {
                'forecasts': forecasts,
                'total_products': len(products),
                'successful_forecasts': len(forecasts),
                'errors': len(errors),
                'timestamp': datetime.now().isoformat()
            }
        }

def main():
    """Função principal"""
    # Ler input do Node.js
    input_data = json.loads(sys.stdin.read())
    
    forecaster = DemandForecaster()
    
    if input_data.get('command') == 'forecast_all':
        result = forecaster.forecast_all_products(input_data.get('params', {}))
    else:
        result = {
            'success': False,
            'error': f'Unknown command: {input_data.get("command")}'
        }
    
    # Retornar resultado
    print(json.dumps(result))

if __name__ == '__main__':
    main()