-- ===============================================
-- CONSULTA DE VENDAS POR ASIN COM FILTROS
-- Para usar em: https://appproft.com/database  
-- ===============================================

-- 1. CONSULTA ORIGINAL (Todos os períodos) - 50 produtos
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
ORDER BY total_vendas DESC
LIMIT 50;

-- ===============================================
-- 2. ÚLTIMOS 30 DIAS
-- ===============================================
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
ORDER BY total_vendas DESC
LIMIT 50;

-- ===============================================
-- 3. ÚLTIMOS 7 DIAS
-- ===============================================
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  AND o.order_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
ORDER BY total_vendas DESC
LIMIT 50;

-- ===============================================
-- 4. ANO ESPECÍFICO (2024)
-- ===============================================
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  AND EXTRACT(YEAR FROM o.order_date) = 2024
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
ORDER BY total_vendas DESC
LIMIT 50;

-- ===============================================
-- 5. PERÍODO ESPECÍFICO (Janeiro a Junho 2024)
-- ===============================================
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  AND o.order_date >= '2024-01-01'
  AND o.order_date <= '2024-06-30'
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
ORDER BY total_vendas DESC
LIMIT 50;

-- ===============================================
-- 6. MÊS ESPECÍFICO (Dezembro 2024)
-- ===============================================
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  AND EXTRACT(YEAR FROM o.order_date) = 2024
  AND EXTRACT(MONTH FROM o.order_date) = 12
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
ORDER BY total_vendas DESC
LIMIT 50;

-- ===============================================
-- 7. ESTE MÊS (Mês atual)
-- ===============================================
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM o.order_date) = EXTRACT(MONTH FROM CURRENT_DATE)
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
ORDER BY total_vendas DESC
LIMIT 50;

-- ===============================================
-- 8. ESTE ANO (Ano atual)
-- ===============================================
SELECT 
  p.asin,
  p.image_url,
  p.name AS product_name,
  COALESCE(SUM(oi.quantity), 0) AS total_vendas,
  COUNT(DISTINCT o.id) AS total_pedidos,
  ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2) AS total_revenue,
  p.marketplace,
  p.country_code
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE p.asin IS NOT NULL 
  AND p.asin != ''
  AND EXTRACT(YEAR FROM o.order_date) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY p.asin, p.image_url, p.name, p.marketplace, p.country_code
ORDER BY total_vendas DESC
LIMIT 50;

-- ===============================================
-- TEMPLATES PERSONALIZÁVEIS
-- ===============================================

-- Para usar qualquer período específico, substitua as datas:
-- AND o.order_date >= 'YYYY-MM-DD'
-- AND o.order_date <= 'YYYY-MM-DD'

-- Para intervalos relativos:
-- Últimos N dias: AND o.order_date >= CURRENT_DATE - INTERVAL 'N days'
-- Últimas N semanas: AND o.order_date >= CURRENT_DATE - INTERVAL 'N weeks' 
-- Últimos N meses: AND o.order_date >= CURRENT_DATE - INTERVAL 'N months'

-- Para anos/meses específicos:
-- Ano: AND EXTRACT(YEAR FROM o.order_date) = 2024
-- Mês: AND EXTRACT(MONTH FROM o.order_date) = 1 (Janeiro = 1, Dezembro = 12)
-- Trimestre: AND EXTRACT(QUARTER FROM o.order_date) = 1 (Q1, Q2, Q3, Q4)