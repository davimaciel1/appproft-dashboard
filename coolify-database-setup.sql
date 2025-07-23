-- SQL para executar no PostgreSQL do Coolify
-- Execute todos os comandos de uma vez

-- 1. Criar tabelas principais
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    marketplace VARCHAR(50) NOT NULL,
    marketplace_product_id VARCHAR(255) NOT NULL,
    sku VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'BRL',
    image_url TEXT,
    category VARCHAR(255),
    brand VARCHAR(255),
    available_quantity INTEGER DEFAULT 0,
    sold_quantity INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(marketplace, marketplace_product_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    marketplace VARCHAR(50) NOT NULL,
    marketplace_order_id VARCHAR(255) NOT NULL,
    order_date TIMESTAMP NOT NULL,
    status VARCHAR(50),
    total_amount DECIMAL(10,2),
    currency VARCHAR(10) DEFAULT 'BRL',
    buyer_name VARCHAR(255),
    buyer_email VARCHAR(255),
    shipping_address TEXT,
    items_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(marketplace, marketplace_order_id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    sku VARCHAR(255),
    title VARCHAR(500),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    commission DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, service)
);

CREATE TABLE IF NOT EXISTS daily_metrics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    marketplace VARCHAR(50),
    total_sales DECIMAL(10,2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    units_sold INTEGER DEFAULT 0,
    net_profit DECIMAL(10,2) DEFAULT 0,
    acos DECIMAL(5,2),
    new_orders INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date, marketplace)
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders(user_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace ON orders(marketplace);
CREATE INDEX IF NOT EXISTS idx_products_user_marketplace ON products(user_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_date ON daily_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

-- 3. Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Criar triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_tokens_updated_at ON api_tokens;
CREATE TRIGGER update_api_tokens_updated_at BEFORE UPDATE ON api_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Verificar se tudo foi criado
SELECT 'Tabelas criadas:' as info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 6. Criar usuário de teste (opcional)
-- Senha: 123456 (já hasheada com bcrypt)
INSERT INTO users (email, password, name) 
VALUES ('admin@appproft.com', '$2a$10$YKqPqExtrj3sZqNlKfZPOeRxpWj5D7xQd4JQdEOPjqKPHoREtoC0y', 'Admin')
ON CONFLICT (email) DO NOTHING;

SELECT 'Setup concluído com sucesso!' as status;