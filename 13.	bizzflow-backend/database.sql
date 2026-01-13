-- Banco de dados: bizzflow_crm

-- Tabela de usuários
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Tabela de clientes
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    province VARCHAR(50),
    category VARCHAR(50) DEFAULT 'normal',
    total_spent DECIMAL(12, 2) DEFAULT 0,
    last_purchase DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Tabela de produtos
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    unit_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2),
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 10,
    supplier VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Tabela de vendas
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    sale_number VARCHAR(50) UNIQUE NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    seller_id INTEGER REFERENCES users(id),
    total_amount DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) DEFAULT 0,
    tax DECIMAL(12, 2) DEFAULT 0,
    final_amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    status VARCHAR(20) DEFAULT 'completed',
    notes TEXT,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de itens da venda
CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_category ON clients(category);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_client ON sales(client_id);
CREATE INDEX idx_sales_seller ON sales(seller_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir admin padrão
INSERT INTO users (name, email, password, role) 
VALUES ('Administrador', 'admin@bizzflow.com', '$2a$10$YourHashedPasswordHere', 'admin');

-- Inserir alguns dados de exemplo
INSERT INTO clients (name, email, phone, category) VALUES
('João Silva', 'joao@email.com', '+258841234567', 'VIP'),
('Maria Santos', 'maria@email.com', '+258842345678', 'normal'),
('Empresa XYZ', 'contato@xyz.com', '+258843456789', 'corporate');

INSERT INTO products (code, name, category, unit_price, stock) VALUES
('PROD001', 'Arroz 5kg', 'Alimentos', 350.00, 100),
('PROD002', 'Azeite 1L', 'Alimentos', 850.00, 50),
('PROD003', 'Detergente', 'Limpeza', 45.00, 200),
('PROD004', 'Sabonete', 'Higiene', 25.00, 150);
