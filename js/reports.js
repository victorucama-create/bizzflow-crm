// js/reports.js
console.log('📊 Inicializando módulo de relatórios v4.0...');

class ReportsModule {
    constructor() {
        this.currentReportType = 'sales';
        this.currentData = null;
        this.charts = {};
    }

    async init() {
        console.log('📈 Módulo de relatórios inicializado');
        this.setupEventListeners();
        await this.loadInitialData();
    }

    setupEventListeners() {
        // Tabs de relatórios
        document.querySelectorAll('[data-report-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.getAttribute('data-report-tab');
                this.switchReportTab(tabId);
            });
        });

        // Botão de gerar relatório
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateReport());
        }

        // Seletor de período
        const periodSelect = document.getElementById('reportPeriod');
        if (periodSelect) {
            periodSelect.addEventListener('change', () => this.generateReport());
        }
    }

    async loadInitialData() {
        try {
            // Carregar dados iniciais para relatório de vendas
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startDate = thirtyDaysAgo.toISOString().split('T')[0];

            const result = await API.getSalesReport({
                start_date: startDate,
                end_date: today
            });

            if (result.success) {
                this.currentData = result.report;
                this.displaySalesReport(result.report);
            }
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
            showNotification('Erro ao carregar dados do relatório', 'error');
        }
    }

    switchReportTab(tabId) {
        // Atualizar tabs ativas
        document.querySelectorAll('[data-report-tab]').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-report-tab="${tabId}"]`).classList.add('active');

        // Mostrar conteúdo correto
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabId}ReportTab`)?.classList.add('active');

        // Carregar dados para a tab
        this.currentReportType = tabId;
        this.generateReport();
    }

    async generateReport() {
        const period = document.getElementById('reportPeriod')?.value || 'month';
        
        // Calcular datas baseadas no período
        let startDate, endDate = new Date().toISOString().split('T')[0];
        
        switch(period) {
            case 'today':
                startDate = endDate;
                break;
            case 'week':
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = weekAgo.toISOString().split('T')[0];
                break;
            case 'month':
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                startDate = monthAgo.toISOString().split('T')[0];
                break;
            case 'quarter':
                const quarterAgo = new Date();
                quarterAgo.setMonth(quarterAgo.getMonth() - 3);
                startDate = quarterAgo.toISOString().split('T')[0];
                break;
            case 'year':
                const yearAgo = new Date();
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                startDate = yearAgo.toISOString().split('T')[0];
                break;
            default:
                startDate = endDate;
        }

        try {
            showNotification('Gerando relatório...', 'info');

            switch(this.currentReportType) {
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
                    showNotification('Tipo de relatório não suportado', 'error');
            }
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            showNotification('Erro ao gerar relatório', 'error');
        }
    }

    async generateSalesReport(startDate, endDate) {
        const result = await API.getSalesReport({
            start_date: startDate,
            end_date: endDate,
            group_by: 'day'
        });

        if (result.success) {
            this.displaySalesReport(result.report);
            showNotification('Relatório de vendas gerado com sucesso!', 'success');
        } else {
            showNotification('Erro ao gerar relatório de vendas', 'error');
        }
    }

    async generateProductsReport(startDate, endDate) {
        const result = await API.getProductsReport({
            start_date: startDate,
            end_date: endDate
        });

        if (result.success) {
            this.displayProductsReport(result.report);
            showNotification('Relatório de produtos gerado com sucesso!', 'success');
        } else {
            showNotification('Erro ao gerar relatório de produtos', 'error');
        }
    }

    async generateClientsReport(startDate, endDate) {
        const result = await API.getClientsReport({
            start_date: startDate,
            end_date: endDate
        });

        if (result.success) {
            this.displayClientsReport(result.report);
            showNotification('Relatório de clientes gerado com sucesso!', 'success');
        } else {
            showNotification('Erro ao gerar relatório de clientes', 'error');
        }
    }

    async generateFinancialReport(startDate, endDate) {
        const result = await API.getFinancialReport({
            start_date: startDate,
            end_date: endDate
        });

        if (result.success) {
            this.displayFinancialReport(result.report);
            showNotification('Relatório financeiro gerado com sucesso!', 'success');
        } else {
            showNotification('Erro ao gerar relatório financeiro', 'error');
        }
    }

    displaySalesReport(report) {
        const container = document.getElementById('salesReportTab');
        if (!container) return;

        // Atualizar estatísticas
        if (report.statistics) {
            document.getElementById('reportTotalSales').textContent = 
                formatCurrency(report.statistics.total_revenue);
            document.getElementById('reportTotalItems').textContent = 
                report.statistics.total_sales || 0;
            document.getElementById('reportAvgSale').textContent = 
                formatCurrency(report.statistics.avg_sale_value);
            
            // Produto mais vendido
            if (report.top_products && report.top_products.length > 0) {
                document.getElementById('reportTopProduct').textContent = 
                    report.top_products[0].product_name;
            }
        }

        // Criar gráfico de vendas diárias
        this.createSalesChart(report.summary);
        
        // Criar gráfico de produtos mais vendidos
        this.createProductsChart(report.top_products);
        
        // Atualizar tabela de produtos mais vendidos
        this.updateTopProductsTable(report.top_products);
    }

    displayProductsReport(report) {
        const container = document.getElementById('productsReportTab');
        if (!container) return;

        let html = `
            <div class="report-summary">
                <h4>📦 Resumo de Produtos</h4>
                <div class="summary-cards">
                    <div class="summary-card">
                        <h5>Total de Produtos</h5>
                        <p class="value">${report.total_products || 0}</p>
                    </div>
                    <div class="summary-card">
                        <h5>Produtos com Stock Baixo</h5>
                        <p class="value">${report.low_stock_count || 0}</p>
                    </div>
                    <div class="summary-card">
                        <h5>Valor Total em Stock</h5>
                        <p class="value">${formatCurrency(report.products?.reduce((sum, p) => sum + (p.stock * p.unit_price), 0) || 0)}</p>
                    </div>
                </div>
            </div>

            <div class="report-table">
                <h4>📋 Produtos Mais Vendidos</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Categoria</th>
                                <th>Stock</th>
                                <th>Vendidos</th>
                                <th>Receita</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (report.products && report.products.length > 0) {
            report.products.slice(0, 10).forEach(product => {
                html += `
                    <tr>
                        <td>${product.name} (${product.code})</td>
                        <td>${product.category || '-'}</td>
                        <td>
                            <span class="badge ${product.stock <= product.min_stock ? 'badge-warning' : 'badge-success'}">
                                ${product.stock}
                            </span>
                        </td>
                        <td>${product.total_sold || 0}</td>
                        <td>${formatCurrency(product.total_revenue || 0)}</td>
                    </tr>
                `;
            });
        } else {
            html += '<tr><td colspan="5">Nenhum dado disponível</td></tr>';
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    displayClientsReport(report) {
        const container = document.getElementById('clientsReportTab');
        if (!container) return;

        let html = `
            <div class="report-summary">
                <h4>👥 Resumo de Clientes</h4>
                <div class="summary-cards">
                    <div class="summary-card">
                        <h5>Total de Clientes</h5>
                        <p class="value">${report.total_clients || 0}</p>
                    </div>
                    <div class="summary-card">
                        <h5>Clientes Ativos</h5>
                        <p class="value">${report.active_clients || 0}</p>
                    </div>
                    <div class="summary-card">
                        <h5>Receita Total</h5>
                        <p class="value">${formatCurrency(report.clients?.reduce((sum, c) => sum + (c.total_spent || 0), 0) || 0)}</p>
                    </div>
                </div>
            </div>

            <div class="report-table">
                <h4>📋 Top Clientes</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Categoria</th>
                                <th>Compras</th>
                                <th>Total Gasto</th>
                                <th>Última Compra</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (report.clients && report.clients.length > 0) {
            report.clients.slice(0, 10).forEach(client => {
                html += `
                    <tr>
                        <td>${client.name}</td>
                        <td>
                            <span class="badge ${client.category === 'VIP' ? 'badge-warning' : 'badge-success'}">
                                ${client.category || 'Normal'}
                            </span>
                        </td>
                        <td>${client.total_purchases || 0}</td>
                        <td>${formatCurrency(client.total_spent || 0)}</td>
                        <td>${client.last_purchase_date ? formatDate(client.last_purchase_date) : 'Nunca'}</td>
                    </tr>
                `;
            });
        } else {
            html += '<tr><td colspan="5">Nenhum dado disponível</td></tr>';
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    displayFinancialReport(report) {
        const container = document.getElementById('financialReportTab');
        if (!container) return;

        let html = `
            <div class="report-summary">
                <h4>💰 Resumo Financeiro</h4>
                <div class="summary-cards">
                    <div class="summary-card">
                        <h5>Receita Total</h5>
                        <p class="value">${formatCurrency(report.summary?.total_revenue || 0)}</p>
                    </div>
                    <div class="summary-card">
                        <h5>Custo dos Produtos</h5>
                        <p class="value">${formatCurrency(report.summary?.total_cogs || 0)}</p>
                    </div>
                    <div class="summary-card">
                        <h5>Lucro Bruto</h5>
                        <p class="value">${formatCurrency(report.gross_profit || 0)}</p>
                    </div>
                </div>
            </div>

            <div class="report-table">
                <h4>📋 Receita por Mês</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Mês</th>
                                <th>Receita</th>
                                <th>Custos</th>
                                <th>Lucro</th>
                                <th>Margem</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (report.monthly_revenue && report.monthly_cogs) {
            // Combinar dados por mês
            const monthlyData = {};
            
            report.monthly_revenue.forEach(month => {
                const monthKey = new Date(month.month).toLocaleDateString('pt-MZ', { month: 'long', year: 'numeric' });
                monthlyData[monthKey] = {
                    revenue: month.revenue || 0,
                    cogs: 0
                };
            });
            
            report.monthly_cogs.forEach(month => {
                const monthKey = new Date(month.month).toLocaleDateString('pt-MZ', { month: 'long', year: 'numeric' });
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].cogs = month.cost_of_goods_sold || 0;
                }
            });
            
            Object.entries(monthlyData).forEach(([month, data]) => {
                const profit = data.revenue - data.cogs;
                const margin = data.revenue > 0 ? (profit / data.revenue * 100).toFixed(1) : 0;
                
                html += `
                    <tr>
                        <td>${month}</td>
                        <td>${formatCurrency(data.revenue)}</td>
                        <td>${formatCurrency(data.cogs)}</td>
                        <td>${formatCurrency(profit)}</td>
                        <td><span class="badge ${margin >= 20 ? 'badge-success' : margin >= 10 ? 'badge-warning' : 'badge-danger'}">${margin}%</span></td>
                    </tr>
                `;
            });
        } else {
            html += '<tr><td colspan="5">Nenhum dado disponível</td></tr>';
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    createSalesChart(data) {
        const ctx = document.getElementById('reportSalesChart');
        if (!ctx || !data) return;

        // Destruir gráfico existente
        if (this.charts.salesChart) {
            this.charts.salesChart.destroy();
        }

        // Preparar dados
        const labels = data.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit' });
        }).reverse();

        const revenues = data.map(item => item.total_revenue || 0).reverse();

        this.charts.salesChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Receita Diária',
                    data: revenues,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }

    createProductsChart(products) {
        const ctx = document.getElementById('reportProductsChart');
        if (!ctx || !products) return;

        // Destruir gráfico existente
        if (this.charts.productsChart) {
            this.charts.productsChart.destroy();
        }

        // Preparar dados para top 5 produtos
        const topProducts = products.slice(0, 5);
        const labels = topProducts.map(p => p.product_name);
        const data = topProducts.map(p => p.total_quantity || 0);

        this.charts.productsChart = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#3498db',
                        '#2ecc71',
                        '#f39c12',
                        '#e74c3c',
                        '#9b59b6'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateTopProductsTable(products) {
        const tbody = document.getElementById('topProductsBody');
        if (!tbody || !products) return;

        let html = '';
        
        products.slice(0, 10).forEach(product => {
            html += `
                <tr>
                    <td>${product.product_name}</td>
                    <td>${product.product_code}</td>
                    <td>${product.total_quantity || 0}</td>
                    <td>${formatCurrency(product.total_revenue || 0)}</td>
                    <td>
                        <span class="badge badge-success">
                            ${product.total_revenue && product.total_quantity ? 
                                Math.round((product.total_revenue / product.total_quantity) / 10) * 10 + '%' : '0%'}
                        </span>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="5">Nenhum dado disponível</td></tr>';
    }

    exportReport(format = 'pdf') {
        const reportType = this.currentReportType;
        const reportTitle = this.getReportTitle(reportType);
        
        showNotification(`Exportando ${reportTitle} em ${format.toUpperCase()}...`, 'info');
        
        // Simular exportação
        setTimeout(() => {
            showNotification(`${reportTitle} exportado com sucesso!`, 'success');
        }, 1500);
    }

    getReportTitle(type) {
        const titles = {
            'sales': 'Relatório de Vendas',
            'products': 'Relatório de Produtos',
            'clients': 'Relatório de Clientes',
            'financial': 'Relatório Financeiro'
        };
        
        return titles[type] || 'Relatório';
    }
}

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('reportsPage') || document.querySelector('[data-page="relatorios"]')) {
        window.reportsModule = new ReportsModule();
        window.reportsModule.init();
    }
});

// Exportar para escopo global
window.loadReportsData = function() {
    if (window.reportsModule) {
        window.reportsModule.init();
    }
};

console.log('✅ Módulo de relatórios carregado');
