// js/api.js
console.log('📡 Inicializando API BizzFlow...');

const API_URL = window.location.origin; // Usa a mesma origem do servidor

class BizzFlowAPI {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || '{}');
    }

    // Headers padrão
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    // Tratamento de erros
    handleError(error) {
        console.error('API Error:', error);
        
        if (error.status === 401) {
            // Token expirado
            this.logout();
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            return { success: false, message: 'Sessão expirada' };
        }
        
        return { 
            success: false, 
            message: error.message || 'Erro na comunicação com o servidor' 
        };
    }

    // Login
    async login(email, password) {
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success && data.token) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                return { success: true, data };
            } else {
                return { success: false, message: data.message || 'Login falhou' };
            }
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Validar token
    async validateToken() {
        if (!this.token) return { success: false, valid: false };
        
        try {
            const response = await fetch(`${API_URL}/api/auth/validate`, {
                headers: this.getHeaders()
            });

            const data = await response.json();
            return data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Logout
    logout() {
        this.token = null;
        this.user = {};
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    // Clientes
    async getClients(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/clients${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createClient(clientData) {
        try {
            const response = await fetch(`${API_URL}/api/clients`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(clientData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateClient(id, clientData) {
        try {
            const response = await fetch(`${API_URL}/api/clients/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(clientData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async deleteClient(id) {
        try {
            const response = await fetch(`${API_URL}/api/clients/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Produtos
    async getProducts(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/products${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createProduct(productData) {
        try {
            const response = await fetch(`${API_URL}/api/products`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(productData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateProduct(id, productData) {
        try {
            const response = await fetch(`${API_URL}/api/products/${id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(productData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async deleteProduct(id) {
        try {
            const response = await fetch(`${API_URL}/api/products/${id}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Vendas
    async getSales(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/sales${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getSale(id) {
        try {
            const response = await fetch(`${API_URL}/api/sales/${id}`, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createSale(saleData) {
        try {
            const response = await fetch(`${API_URL}/api/sales`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(saleData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Fornecedores
    async getSuppliers(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/suppliers${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createSupplier(supplierData) {
        try {
            const response = await fetch(`${API_URL}/api/suppliers`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(supplierData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Equipa
    async getTeam(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/team${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createTeamMember(memberData) {
        try {
            const response = await fetch(`${API_URL}/api/team`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(memberData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Relatórios
    async getSalesReport(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/reports/sales${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getProductsReport(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/reports/products${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getClientsReport(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/reports/clients${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getFinancialReport(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/reports/financial${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Inventário
    async getInventory(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/inventory${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getInventoryMovements(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/inventory/movements${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createInventoryMovement(movementData) {
        try {
            const response = await fetch(`${API_URL}/api/inventory/movements`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(movementData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Encomendas
    async getOrders(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${API_URL}/api/orders${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async createOrder(orderData) {
        try {
            const response = await fetch(`${API_URL}/api/orders`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(orderData)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateOrderStatus(id, status) {
        try {
            const response = await fetch(`${API_URL}/api/orders/${id}/status`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ status })
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Configurações
    async getSettings() {
        try {
            const response = await fetch(`${API_URL}/api/settings`, {
                headers: this.getHeaders()
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async updateSettings(settings) {
        try {
            const response = await fetch(`${API_URL}/api/settings`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(settings)
            });

            return await response.json();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Dashboard
    async getDashboardMetrics() {
        try {
            // Buscar dados para dashboard
            const [salesResponse, clientsResponse, productsResponse, inventoryResponse] = await Promise.all([
                this.getSales({ limit: 5 }),
                this.getClients({ limit: 5 }),
                this.getProducts({ limit: 5 }),
                this.getInventory({ low_stock: 'true' })
            ]);

            const today = new Date().toISOString().split('T')[0];
            const todaySales = await this.getSales({ start_date: today });

            return {
                success: true,
                metrics: {
                    total_sales: salesResponse.success ? salesResponse.pagination?.total || 0 : 0,
                    total_clients: clientsResponse.success ? clientsResponse.pagination?.total || 0 : 0,
                    total_products: productsResponse.success ? productsResponse.pagination?.total || 0 : 0,
                    sales_today: todaySales.success ? todaySales.sales?.length || 0 : 0,
                    revenue_today: todaySales.success ? 
                        todaySales.sales.reduce((sum, sale) => sum + (sale.final_amount || 0), 0) : 0,
                    low_stock_items: inventoryResponse.success ? inventoryResponse.summary?.low_stock_count || 0 : 0
                },
                recent_sales: salesResponse.success ? salesResponse.sales : [],
                recent_clients: clientsResponse.success ? clientsResponse.clients : [],
                low_stock_products: inventoryResponse.success ? inventoryResponse.inventory : []
            };
        } catch (error) {
            return this.handleError(error);
        }
    }
}

// Instância global da API
window.API = new BizzFlowAPI();

// Funções auxiliares
function formatCurrency(value) {
    if (!value) return '0,00 MZN';
    return new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN'
    }).format(value);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-MZ');
}

function showNotification(message, type = 'info') {
    // Implementação da função de notificação
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Aqui você pode implementar um sistema de notificações visuais
    // Por enquanto, vamos usar alert para debug
    if (type === 'error') {
        alert(`Erro: ${message}`);
    } else if (type === 'success') {
        alert(`Sucesso: ${message}`);
    }
}

console.log('✅ API BizzFlow inicializada');
