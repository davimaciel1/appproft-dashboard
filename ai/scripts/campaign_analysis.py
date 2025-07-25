#!/usr/bin/env python3
"""
Script de análise de campanhas e keywords usando Machine Learning
Identifica oportunidades de otimização em:
- Keywords com baixo desempenho
- Bid optimization
- Negative keywords sugeridos
- Budget allocation
- Campaign structure
"""

import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import warnings
warnings.filterwarnings('ignore')

load_dotenv()

class CampaignAnalyzer:
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
    
    def get_campaign_data(self, lookback_days=30):
        """Busca dados de campanhas e keywords"""
        query = """
        -- Simular dados de campanhas até termos a Advertising API
        WITH campaign_data AS (
            SELECT 
                p.asin,
                p.name as product_name,
                p.price,
                sm.date,
                sm.units_ordered,
                sm.ordered_product_sales,
                sm.sessions,
                sm.buy_box_percentage,
                RANDOM() * 1000 as impressions,  -- Simulado
                RANDOM() * 100 as clicks,        -- Simulado
                RANDOM() * 10 as cost,           -- Simulado
                RANDOM() * 5 as conversions      -- Simulado
            FROM products p
            JOIN sales_metrics sm ON p.asin = sm.asin
            WHERE sm.date >= CURRENT_DATE - INTERVAL '%s days'
            AND p.active = true
            AND p.marketplace = 'amazon'
        )
        SELECT 
            *,
            CASE WHEN impressions > 0 THEN clicks / impressions * 100 ELSE 0 END as ctr,
            CASE WHEN clicks > 0 THEN conversions / clicks * 100 ELSE 0 END as cvr,
            CASE WHEN clicks > 0 THEN cost / clicks ELSE 0 END as cpc,
            CASE WHEN ordered_product_sales > 0 THEN cost / ordered_product_sales ELSE 0 END as acos
        FROM campaign_data
        """
        
        with self.get_connection() as conn:
            df = pd.read_sql(query, conn, params=(lookback_days,))
            
        return df
    
    def get_keyword_data(self, lookback_days=30):
        """Busca dados de keywords (simulado por enquanto)"""
        # Quando tivermos a Advertising API, buscar dados reais
        # Por agora, simular baseado em produtos
        query = """
        SELECT 
            kp.*,
            p.name as product_name,
            p.price
        FROM keywords_performance kp
        JOIN products p ON kp.asin = p.asin
        WHERE kp.date >= CURRENT_DATE - INTERVAL '%s days'
        """
        
        with self.get_connection() as conn:
            try:
                df = pd.read_sql(query, conn, params=(lookback_days,))
            except:
                # Se tabela não existir, retornar DataFrame vazio
                df = pd.DataFrame()
                
        return df
    
    def analyze_keyword_clusters(self, df):
        """Agrupa keywords similares para identificar padrões"""
        if df.empty or len(df) < 10:
            return []
            
        # Features para clustering
        features = ['ctr', 'cvr', 'cpc', 'acos', 'impressions', 'clicks']
        X = df[features].fillna(0)
        
        # Normalizar
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Clustering
        kmeans = KMeans(n_clusters=min(5, len(df) // 10), random_state=42)
        df['cluster'] = kmeans.fit_predict(X_scaled)
        
        recommendations = []
        
        # Analisar cada cluster
        for cluster_id in df['cluster'].unique():
            cluster_df = df[df['cluster'] == cluster_id]
            
            avg_acos = cluster_df['acos'].mean()
            avg_ctr = cluster_df['ctr'].mean()
            avg_cvr = cluster_df['cvr'].mean()
            
            # Classificar cluster
            if avg_acos > 0.30:  # ACOS muito alto
                rec_type = 'reduce_bids'
                action = f'Reduzir bids em {int((avg_acos - 0.25) * 100)}%'
            elif avg_ctr < 1.0:  # CTR muito baixo
                rec_type = 'pause_keywords'
                action = 'Pausar keywords com baixo CTR'
            elif avg_cvr > 10 and avg_acos < 0.15:  # Alta conversão, baixo ACOS
                rec_type = 'increase_bids'
                action = 'Aumentar bids em 20% para ganhar mais tráfego'
            else:
                continue
                
            recommendations.append({
                'type': 'keyword',
                'subtype': rec_type,
                'priority': 'high' if avg_acos > 0.40 or avg_ctr < 0.5 else 'medium',
                'title': f'Otimizar {len(cluster_df)} keywords similares',
                'description': f'Cluster com ACOS médio {avg_acos:.1%}, CTR {avg_ctr:.1%}',
                'action': action,
                'keywords': cluster_df['keyword'].head(10).tolist() if 'keyword' in cluster_df else [],
                'metrics': {
                    'avg_acos': round(avg_acos, 3),
                    'avg_ctr': round(avg_ctr, 2),
                    'avg_cvr': round(avg_cvr, 2),
                    'total_cost': round(cluster_df['cost'].sum(), 2),
                    'total_sales': round(cluster_df['ordered_product_sales'].sum(), 2)
                }
            })
            
        return recommendations
    
    def find_negative_keywords(self, df):
        """Identifica keywords que devem ser negativadas"""
        if df.empty:
            return []
            
        # Keywords com alto custo e zero conversões
        negative_candidates = df[
            (df['cost'] > df['cost'].quantile(0.7)) &
            (df['conversions'] == 0) &
            (df['clicks'] >= 10)
        ]
        
        if negative_candidates.empty:
            return []
            
        return [{
            'type': 'keyword',
            'subtype': 'negative_keywords',
            'priority': 'high',
            'title': f'Adicionar {len(negative_candidates)} negative keywords',
            'description': 'Keywords com alto custo e zero conversões',
            'action': 'Adicionar como negative keywords para economizar budget',
            'keywords': negative_candidates['keyword'].tolist() if 'keyword' in negative_candidates else [],
            'metrics': {
                'total_wasted_spend': round(negative_candidates['cost'].sum(), 2),
                'avg_clicks_no_conversion': round(negative_candidates['clicks'].mean(), 1)
            }
        }]
    
    def optimize_bids_ml(self, df):
        """Usa ML para sugerir bid optimization"""
        if df.empty or len(df) < 50:
            return []
            
        # Preparar dados para modelo
        features = ['current_bid', 'quality_score', 'position', 'impressions', 
                   'ctr', 'competition_level']
        
        # Simular algumas features que não temos ainda
        df['current_bid'] = df['cpc'] * 1.2  # Estimativa
        df['quality_score'] = np.random.randint(5, 10, len(df))  # Simulado
        df['position'] = np.random.uniform(1, 5, len(df))  # Simulado
        df['competition_level'] = np.random.uniform(0.5, 1, len(df))  # Simulado
        
        # Features disponíveis
        available_features = [f for f in features if f in df.columns]
        
        if len(available_features) < 3:
            return []
            
        X = df[available_features].fillna(0)
        y = df['acos'].fillna(0)
        
        # Dividir dados
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Treinar modelo
        rf = RandomForestRegressor(n_estimators=50, random_state=42)
        rf.fit(X_train, y_train)
        
        # Prever ACOS ideal
        df['predicted_acos'] = rf.predict(X)
        
        # Sugerir ajustes de bid
        recommendations = []
        
        # Keywords que podem reduzir bid
        high_acos = df[df['acos'] > 0.30]
        if not high_acos.empty:
            avg_reduction = min(30, (high_acos['acos'].mean() - 0.25) * 100)
            recommendations.append({
                'type': 'campaign',
                'subtype': 'bid_optimization',
                'priority': 'high',
                'title': f'Reduzir bids em {len(high_acos)} keywords',
                'description': f'Keywords com ACOS acima de 30%',
                'action': f'Reduzir bids em média {avg_reduction:.0f}%',
                'metrics': {
                    'keywords_affected': len(high_acos),
                    'current_avg_acos': round(high_acos['acos'].mean(), 3),
                    'potential_savings': round(high_acos['cost'].sum() * (avg_reduction/100), 2)
                }
            })
        
        # Keywords que podem aumentar bid
        low_acos_high_conv = df[(df['acos'] < 0.15) & (df['cvr'] > 5)]
        if not low_acos_high_conv.empty:
            recommendations.append({
                'type': 'campaign',
                'subtype': 'bid_optimization',
                'priority': 'medium',
                'title': f'Aumentar bids em {len(low_acos_high_conv)} keywords de alta performance',
                'description': 'Keywords com baixo ACOS e alta conversão',
                'action': 'Aumentar bids em 20-30% para capturar mais tráfego',
                'metrics': {
                    'keywords_affected': len(low_acos_high_conv),
                    'current_avg_acos': round(low_acos_high_conv['acos'].mean(), 3),
                    'avg_conversion_rate': round(low_acos_high_conv['cvr'].mean(), 1)
                }
            })
            
        return recommendations
    
    def analyze_dayparting(self, df):
        """Analisa performance por hora do dia"""
        if df.empty or 'date' not in df.columns:
            return []
            
        # Simular hora do dia (quando tivermos dados reais)
        df['hour'] = np.random.randint(0, 24, len(df))
        
        # Agrupar por hora
        hourly = df.groupby('hour').agg({
            'acos': 'mean',
            'cvr': 'mean',
            'cost': 'sum',
            'ordered_product_sales': 'sum'
        }).reset_index()
        
        # Identificar melhores e piores horas
        best_hours = hourly.nsmallest(6, 'acos')['hour'].tolist()
        worst_hours = hourly.nlargest(6, 'acos')['hour'].tolist()
        
        if hourly['acos'].std() > 0.05:  # Variação significativa
            return [{
                'type': 'campaign',
                'subtype': 'dayparting',
                'priority': 'medium',
                'title': 'Implementar dayparting para otimizar budget',
                'description': f'Performance varia significativamente por hora do dia',
                'action': f'Aumentar bids nas horas {best_hours} e reduzir nas horas {worst_hours}',
                'metrics': {
                    'best_hours_acos': round(hourly.loc[hourly['hour'].isin(best_hours), 'acos'].mean(), 3),
                    'worst_hours_acos': round(hourly.loc[hourly['hour'].isin(worst_hours), 'acos'].mean(), 3),
                    'potential_improvement': round(
                        (hourly.loc[hourly['hour'].isin(worst_hours), 'cost'].sum() * 0.3), 2
                    )
                }
            }]
            
        return []
    
    def suggest_campaign_structure(self, df):
        """Sugere melhorias na estrutura de campanhas"""
        recommendations = []
        
        # Verificar se há muitos produtos em uma campanha
        if 'campaign_name' in df.columns:
            products_per_campaign = df.groupby('campaign_name')['asin'].nunique()
            
            overcrowded = products_per_campaign[products_per_campaign > 20]
            if not overcrowded.empty:
                recommendations.append({
                    'type': 'campaign',
                    'subtype': 'structure',
                    'priority': 'medium',
                    'title': 'Dividir campanhas muito grandes',
                    'description': f'{len(overcrowded)} campanhas têm mais de 20 produtos',
                    'action': 'Criar campanhas separadas por categoria ou performance',
                    'metrics': {
                        'campaigns_to_split': len(overcrowded),
                        'max_products_in_campaign': int(products_per_campaign.max())
                    }
                })
        
        # Sugerir campanhas por tipo de match
        recommendations.append({
            'type': 'campaign',
            'subtype': 'structure',
            'priority': 'low',
            'title': 'Criar estrutura de campanhas por match type',
            'description': 'Separar exact, phrase e broad match em campanhas diferentes',
            'action': 'Criar 3 campanhas para cada produto: Exact, Phrase, Broad',
            'metrics': {
                'current_campaign_count': df['campaign_name'].nunique() if 'campaign_name' in df else 1,
                'recommended_structure': 'Single Keyword Ad Groups (SKAG)'
            }
        })
        
        return recommendations
    
    def analyze_campaigns(self, params):
        """Executa análise completa de campanhas"""
        lookback_days = params.get('lookback_days', 30)
        acos_target = params.get('acos_target', 0.25)
        
        # Buscar dados
        campaign_df = self.get_campaign_data(lookback_days)
        keyword_df = self.get_keyword_data(lookback_days)
        
        all_recommendations = []
        
        # 1. Análise de clusters de keywords
        if not keyword_df.empty:
            cluster_recs = self.analyze_keyword_clusters(keyword_df)
            all_recommendations.extend(cluster_recs)
        else:
            # Usar dados de campanha como fallback
            cluster_recs = self.analyze_keyword_clusters(campaign_df)
            all_recommendations.extend(cluster_recs)
        
        # 2. Identificar negative keywords
        neg_keywords = self.find_negative_keywords(campaign_df)
        all_recommendations.extend(neg_keywords)
        
        # 3. Otimização de bids com ML
        bid_recs = self.optimize_bids_ml(campaign_df)
        all_recommendations.extend(bid_recs)
        
        # 4. Análise de dayparting
        daypart_recs = self.analyze_dayparting(campaign_df)
        all_recommendations.extend(daypart_recs)
        
        # 5. Sugestões de estrutura
        structure_recs = self.suggest_campaign_structure(campaign_df)
        all_recommendations.extend(structure_recs)
        
        # 6. Análise de budget allocation
        if not campaign_df.empty:
            total_cost = campaign_df['cost'].sum()
            total_sales = campaign_df['ordered_product_sales'].sum()
            overall_acos = total_cost / total_sales if total_sales > 0 else 0
            
            if overall_acos > acos_target:
                all_recommendations.append({
                    'type': 'campaign',
                    'subtype': 'budget_optimization',
                    'priority': 'high',
                    'title': 'Realocar budget para campanhas mais eficientes',
                    'description': f'ACOS geral ({overall_acos:.1%}) acima do target ({acos_target:.1%})',
                    'action': 'Mover budget de campanhas com alto ACOS para campanhas com baixo ACOS',
                    'metrics': {
                        'current_acos': round(overall_acos, 3),
                        'target_acos': acos_target,
                        'total_spend': round(total_cost, 2),
                        'potential_savings': round(total_cost * (overall_acos - acos_target), 2)
                    }
                })
        
        # Ordenar por prioridade
        priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        all_recommendations.sort(
            key=lambda x: (priority_order.get(x['priority'], 99), -x.get('metrics', {}).get('potential_savings', 0))
        )
        
        return {
            'success': True,
            'data': {
                'recommendations': all_recommendations[:20],  # Top 20
                'total_recommendations': len(all_recommendations),
                'summary': {
                    'total_spend_analyzed': round(campaign_df['cost'].sum(), 2) if not campaign_df.empty else 0,
                    'overall_acos': round(overall_acos, 3) if not campaign_df.empty else 0,
                    'products_analyzed': campaign_df['asin'].nunique() if not campaign_df.empty else 0,
                    'date_range': f'{lookback_days} days'
                },
                'timestamp': datetime.now().isoformat()
            }
        }

def main():
    """Função principal"""
    # Ler input do Node.js
    input_data = json.loads(sys.stdin.read())
    
    analyzer = CampaignAnalyzer()
    
    if input_data.get('command') == 'analyze_campaigns':
        result = analyzer.analyze_campaigns(input_data.get('params', {}))
    else:
        result = {
            'success': False,
            'error': f'Unknown command: {input_data.get("command")}'
        }
    
    # Retornar resultado
    print(json.dumps(result))

if __name__ == '__main__':
    main()