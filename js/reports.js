// js/reports.js
console.log('📊 Inicializando módulo de relatórios...');

const Reports = {
    // Tipos de relatório disponíveis
    reportTypes: {
        sales: 'Vendas',
        products: 'Produtos',
        clients: 'Clientes',
        financial: 'Financeiro'
    },

    // Inicializar
    init: function() {
        console.log('📈 Módulo de relatórios inicializado');
        this.setupEventListeners();
        this.loadReportData();
    },

    // Configurar event listeners
    setupEventListeners: function() {
        // Botão de gerar relatório
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateReport());
        }

        // Seletor de tipo de relatório
        const reportTypeSelect = document.getElementById('reportType');
        if (reportTypeSelect) {
            reportTypeSelect.addEventListener('change', (e) => this.onReportTypeChange(e.target.value));
        }

        // Botão de exportar
        const exportBtn = document.getElementById('exportReportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }
    },

    // Carregar dados para relatório
    loadReportData: async function() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                showNotification('Faça login para acessar relatórios', 'error');
                return;
            }

            // Carregar dados iniciais (vendas dos últimos 30 dias)
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            const startDateStr = startDate.toISOString().split('T')[0];

            const response = await fetch(`${API_URL}/sales?start_date=${startDateStr}&end_date=${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.displaySalesReport(data.sales);
                }
            }
        } catch (error) {
            console.error('Erro ao carregar dados do relatório:', error);
            showNotification('Erro ao carregar dados', 'error');
        }
    },

    // Gerar relatório baseado no tipo selecionado
    generateReport: async function() {
        const reportType = document.getElementById('reportType')?.value || 'sales';
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                showNotification('Faça login para gerar relatórios', 'error');
                return;
            }

            showNotification('Gerando relatório...', 'info');

            switch(reportType) {
                case 'sales':
                    await this.generateSalesReport(startDate, endDate);
                    break;
                case 'products':
                    await this.generateProductsReport(startDate, endDate);
                    break;
                case 'clients':
                    await this.generateClientsReport(startDate, endDate);
                    break;
                case 'financial':
                    await this.generateFinancialReport(startDate, endDate);
                    break;
                default:
                    showNotification('Tipo de relatório inválido', 'error');
            }
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            showNotification('Erro ao gerar relatório', 'error');
        }
    },

    // Gerar relatório de vendas
    generateSalesReport: async function(startDate, endDate) {
        let url = `${API_URL}/sales`;
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                this.displaySalesReport(data.sales);
                showNotification('Relatório de vendas gerado com sucesso!', 'success');
            }
        }
    },

    // Exibir relatório de vendas
    displaySalesReport: function(sales) {
        const reportContainer = document.getElementById('reportResults');
        if (!reportContainer) return;

        if (!sales || sales.length === 0) {
            reportContainer.innerHTML = `
                <div class="alert alert-info">
                    <h4>📭 Nenhuma venda encontrada</h4>
                    <p>Não há dados de vendas para o período selecionado.</p>
                </div>
            `;
            return;
        }

        // Calcular totais
        let totalRevenue = 0;
        let totalSales = sales.length;
        let avgSaleValue = 0;

        sales.forEach(sale => {
            totalRevenue += parseFloat(sale.final_amount) || 0;
        });

        if (totalSales > 0) {
            avgSaleValue = totalRevenue / totalSales;
        }

        // Gerar HTML do relatório
        reportContainer.innerHTML = `
            <div class="report-summary">
                <h4>📊 Resumo do Relatório</h4>
                <div class="summary-cards">
                    <div class="summary-card">
                        <h5>Total de Vendas</h5>
                        <p class="value">${totalSales}</p>
                    </div>
                    <div class="summary-card">
                        <h5>Receita Total</h5>
                        <p class="value">${formatCurrency(totalRevenue)}</p>
                    </div>
                    <div class="summary-card">
                        <h5>Valor Médio por Venda</h5>
                        <p class="value">${formatCurrency(avgSaleValue)}</p>
                    </div>
                </div>
            </div>

            <div class="report-table">
                <h4>📋 Detalhes das Vendas</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Número</th>
                            <th>Cliente</th>
                            <th>Data</th>
                            <th>Valor</th>
                            <th>Pagamento</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sales.map(sale => `
                            <tr>
                                <td>${sale.sale_number || 'N/A'}</td>
                                <td>${sale.client_name || 'Não informado'}</td>
                                <td>${formatDate(sale.sale_date)}</td>
                                <td>${formatCurrency(sale.final_amount)}</td>
                                <td><span class="badge badge-${sale.payment_method === 'cash' ? 'success' : 'info'}">${getPaymentMethodLabel(sale.payment_method)}</span></td>
                                <td><span class="badge badge-${sale.status === 'completed' ? 'success' : 'warning'}">${getStatusLabel(sale.status)}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // Gerar relatório de produtos
    generateProductsReport: async function(startDate, endDate) {
        showNotification('Relatório de produtos em desenvolvimento', 'info');
        // Implementação futura
    },

    // Gerar relatório de clientes
    generateClientsReport: async function(startDate, endDate) {
        showNotification('Relatório de clientes em desenvolvimento', 'info');
        // Implementação futura
    },

    // Gerar relatório financeiro
    generateFinancialReport: async function(startDate, endDate) {
        showNotification('Relatório financeiro em desenvolvimento', 'info');
        // Implementação futura
    },

    // Exportar relatório
    exportReport: function() {
        const reportType = document.getElementById('reportType')?.value || 'sales';
        const reportTitle = this.reportTypes[reportType] || 'Relatório';
        
        showNotification(`Exportando ${reportTitle}...`, 'info');
        
        // Simular exportação (implementação futura)
        setTimeout(() => {
            showNotification(`${reportTitle} exportado com sucesso!`, 'success');
        }, 1500);
    },

    // Quando o tipo de relatório muda
    onReportTypeChange: function(type) {
        console.log('Tipo de relatório alterado para:', type);
        
        // Mostrar/ocultar campos específicos
        const dateFields = document.getElementById('dateFields');
        if (dateFields) {
            dateFields.style.display = type === 'sales' ? 'block' : 'none';
        }
    }
};

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('reports-page')) {
        Reports.init();
    }
});

// Exportar para escopo global
window.loadReportsData = function() {
    if (typeof Reports !== 'undefined') {
        Reports.init();
    }
};

console.log('✅ Módulo de relatórios carregado');
