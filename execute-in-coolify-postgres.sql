-- Execute este SQL no PostgreSQL do Coolify

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de produtos (simplificada)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    marketplace VARCHAR(50) NOT NULL,
    marketplace_product_id VARCHAR(255) NOT NULL,
    sku VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    price DECIMAL(10,2),
    image_url TEXT,
    available_quantity INTEGER DEFAULT 0,
    sold_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de pedidos (simplificada)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    marketplace VARCHAR(50) NOT NULL,
    marketplace_order_id VARCHAR(255) NOT NULL,
    order_date TIMESTAMP NOT NULL,
    status VARCHAR(50),
    total_amount DECIMAL(10,2),
    buyer_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);