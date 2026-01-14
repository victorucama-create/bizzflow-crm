// ==============================================
// BIZZFLOW CRM - FUNÇÕES COMPLETAS (CORRIGIDAS)
// ==============================================
// Arquivo: js/functions.js
// Versão: 1.1.0 (Corrigida)
// Data: 2024-01-14
// ==============================================

// ========== CORREÇÕES DE EMERGÊNCIA ==========
console.log('🚀 Inicializando BizzFlow CRM com correções...');

// ========== CORREÇÃO ESPECÍFICA PARA salesChart ==========
console.log('🎯 Aplicando correção específica para salesChart.destroy...');

// 1. VERIFICAR E CARREGAR CHART.JS
function ensureChartJS() {
    return new Promise((resolve) => {
        if (typeof Chart !== 'undefined') {
            console.log('✅ Chart.js já carregado');
            resolve(true);
            return;
        }
        
        console.log('📥 Chart.js não encontrado, carregando...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
        script.async = true;
        
        script.onload = () => {
            console.log('✅ Chart.js carregado com sucesso');
            initCharts();
            resolve(true);
        };
        
        script.onerror = () => {
            console.error('❌ Falha ao carregar Chart.js');
            createMockCharts();
            resolve(false);
        };
        
        document.head.appendChild(script);
    });
}

// 2. INICIALIZAR GRÁFICOS REAIS SE CHART.JS ESTIVER DISPONÍVEL
function initCharts() {
    console.log('📈 Inicializando gráficos reais...');
    
    // Obter elementos canvas
    const salesCanvas = document.getElementById('salesChart');
    const productsCanvas = document.getElementById('productsChart');
    
    // Inicializar salesChart se canvas existir
    if (salesCanvas && typeof Chart !== 'undefined') {
        try {
            window.salesChart = new Chart(salesCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Vendas',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
            console.log('✅ salesChart inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao criar salesChart:', error);
            createMockCharts();
        }
    } else {
        createMockCharts();
    }
}

// 3. CRIAR GRÁFICOS MOCK (SEGURANÇA)
function createMockCharts() {
    console.log('🛡️ Criando gráficos mock para segurança...');
    
    window.salesChart = {
        destroy: function() { 
            console.log('✅ salesChart.destroy() [mock]'); 
        },
        update: function() { 
            console.log('✅ salesChart.update() [mock]'); 
            return this;
        },
        clear: function() { return this; },
        stop: function() { return this; },
        resize: function() { return this; },
        toBase64Image: function() { return ''; },
        data: { datasets: [], labels: [] },
        options: {},
        config: {}
    };
    
    window.productsChart = {
        destroy: function() { 
            console.log('✅ productsChart.destroy() [mock]'); 
        },
        update: function() { 
            console.log('✅ productsChart.update() [mock]'); 
            return this;
        }
    };
    
    console.log('✅ Gráficos mock criados - sem erros!');
}

// 4. SUBSTITUIR FUNÇÃO updateCharts PROBLEMÁTICA
function createSafeUpdateCharts() {
    console.log('🔄 Criando updateCharts segura...');
    
    // Salvar referência à função original se existir
    const originalUpdateCharts = window.updateCharts;
    
    // Criar nova função segura
    window.updateCharts = function() {
        console.log('📊 updateCharts() chamada (com segurança)');
        
        // Verificar se Chart.js está disponível
        if (typeof Chart === 'undefined') {
            console.warn('⚠️ Chart.js não disponível');
            return Promise.resolve(false);
        }
        
        // Verificar se salesChart existe
        if (!window.salesChart || typeof window.salesChart.destroy !== 'function') {
            console.warn('⚠️ salesChart não inicializado, inicializando...');
            initCharts();
        }
        
        // Se temos uma função original, tentar executá-la
        if (typeof originalUpdateCharts === 'function') {
            try {
                return originalUpdateCharts();
            } catch (error) {
                console.error('❌ Erro na updateCharts original:', error);
                return false;
            }
        }
        
        // Se não há função original, fazer algo básico
        console.log('✅ updateCharts executada com segurança');
        return true;
    };
}

// 5. INICIALIZAR TUDO QUANDO O DOM CARREGAR
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🏁 DOM carregado, configurando gráficos...');
    
    // Primeiro garantir que Chart.js existe
    await ensureChartJS();
    
    // Depois inicializar gráficos
    initCharts();
    
    // Finalmente criar função segura
    createSafeUpdateCharts();
    
    console.log('✅ Sistema de gráficos configurado com segurança');
});

// Inicializar imediatamente se DOM já carregado
if (document.readyState !== 'loading') {
    setTimeout(() => {
        ensureChartJS().then(() => {
            initCharts();
            createSafeUpdateCharts();
        });
    }, 100);
}

console.log('✅ Correção para salesChart.destroy aplicada!');
// ========== FIM DA CORREÇÃO ==========
// 1. GARANTIR QUE CHART.JS EXISTA
if (typeof Chart === 'undefined') {
    console.warn('📊 Chart.js não encontrado, inicializando objetos seguros...');
    
    // Criar objetos mock para gráficos
    window.salesChart = {
        destroy: function() { console.log('salesChart.destroy() [safe mock]'); },
        update: function() { return this; },
        clear: function() { return this; },
        data: { datasets: [], labels: [] },
        options: {}
    };
    
    window.productsChart = {
        destroy: function() { console.log('productsChart.destroy() [safe mock]'); },
        update: function() { return this; }
    };
    
    // Tentar carregar Chart.js dinamicamente
    const chartScript = document.createElement('script');
    chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    chartScript.async = true;
    chartScript.onload = function() {
        console.log('✅ Chart.js carregado dinamicamente');
        // Reexecutar funções que dependem de Chart.js
        if (typeof window.updateCharts === 'function') {
            setTimeout(() => {
                try {
                    window.updateCharts();
                } catch (e) {
                    console.warn('Ainda não possível atualizar gráficos:', e.message);
                }
            }, 1000);
        }
    };
    document.head.appendChild(chartScript);
} else {
    console.log('✅ Chart.js já carregado');
    // Inicializar objetos se não existirem
    window.salesChart = window.salesChart || {
        destroy: function() { console.log('salesChart.destroy() [placeholder]'); },
        update: function() { return this; }
    };
}

// 2. FUNÇÃO SEGURA PARA RESET DE FORMULÁRIOS
window.safeFormReset = function(formId) {
    const form = document.getElementById(formId);
    if (form && typeof form.reset === 'function') {
        form.reset();
        console.log('✅ Formulário resetado:', formId);
        return true;
    } else {
        console.warn('⚠️ Formulário não encontrado ou sem reset():', formId);
        return false;
    }
};

// 3. SUBSTITUIR FUNÇÕES PROBLEMÁTICAS
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 DOM carregado, aplicando correções...');
    
    // Substituir event listeners problemáticos
    setTimeout(() => {
        // Encontrar botões com reset problemático
        const buttons = document.querySelectorAll('button[onclick*="reset"], button[onclick*=".reset()"]');
        buttons.forEach(btn => {
            const oldOnClick = btn.getAttribute('onclick');
            if (oldOnClick && oldOnClick.includes('reset')) {
                console.log('🔄 Substituindo onclick problemático:', oldOnClick);
                
                // Extrair ID do formulário
                const formMatch = oldOnClick.match(/getElementById\(['"]([^'"]+)['"]\)/);
                if (formMatch && formMatch[1]) {
                    const formId = formMatch[1];
                    btn.setAttribute('onclick', `safeFormReset('${formId}')`);
                    console.log(`✅ Botão atualizado para safeFormReset('${formId}')`);
                }
            }
        });
    }, 100);
});

console.log('✅ Correções de emergência aplicadas');
// ========== FIM DAS CORREÇÕES ==========

// Configuração da API
const API_URL = window.location.hostname.includes('render.com') 
    ? 'https://bizzflow-crm.onrender.com/api'
    : 'http://localhost:5000/api';

console.log('🔧 functions.js carregado! API_URL:', API_URL);

// ==============================================
// FUNÇÕES DE NOTIFICAÇÃO
// ==============================================

/**
 * Mostra uma notificação na tela
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 */
function showNotification(message, type = 'info') {
    // Remover notificações anteriores
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        if (notification.parentElement) {
            notification.remove();
        }
    });
    
    // Criar elemento da notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-text">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                &times;
            </button>
        </div>
    `;
    
    // Estilos CSS dinâmicos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        min-width: 300px;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    // Adicionar ao corpo
    document.body.appendChild(notification);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
    
    // Adicionar animações CSS se não existirem
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .notification-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .notification-icon {
                margin-right: 10px;
                font-size: 18px;
            }
            .notification-text {
                flex: 1;
                font-size: 14px;
                line-height: 1.4;
            }
            .notification-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                margin-left: 10px;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s;
            }
            .notification-close:hover {
                background: rgba(255,255,255,0.2);
            }
        `;
        document.head.appendChild(style);
    }
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '💡';
    }
}

function getNotificationColor(type) {
    switch(type) {
        case 'success': return '#10B981';
        case 'error': return '#EF4444';
        case 'warning': return '#F59E0B';
        case 'info': return '#3B82F6';
        default: return '#6B7280';
    }
}

// ==============================================
// FUNÇÕES DE VENDAS (COM CORREÇÕES)
// ==============================================

/**
 * Atualiza o resumo da venda
 * @returns {object} Totais da venda
 */
function updateSaleSummary() {
    try {
        const items = JSON.parse(localStorage.getItem('saleItems') || '[]');
        let subtotal = 0;
        
        // Calcular subtotal
        items.forEach(item => {
            subtotal += (item.price || 0) * (item.quantity || 1);
        });
        
        // Obter valores dos campos
        const discountInput = document.getElementById('saleDiscount');
        const taxInput = document.getElementById('saleTax');
        
        const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
        const tax = taxInput ? parseFloat(taxInput.value) || 0 : 0;
        const total = subtotal - discount + tax;
        
        // Atualizar elementos na tela
        const elements = {
            subtotal: document.getElementById('subtotalAmount'),
            discount: document.getElementById('discountAmount'),
            tax: document.getElementById('taxAmount'),
            total: document.getElementById('totalAmount')
        };
        
        // Atualizar valores
        if (elements.subtotal) elements.subtotal.textContent = formatCurrency(subtotal);
        if (elements.discount) elements.discount.textContent = formatCurrency(discount);
        if (elements.tax) elements.tax.textContent = formatCurrency(tax);
        if (elements.total) elements.total.textContent = formatCurrency(total);
        
        // Atualizar contador de itens
        const itemCountElement = document.getElementById('saleItemCount');
        if (itemCountElement) {
            itemCountElement.textContent = items.length;
            itemCountElement.style.display = items.length > 0 ? 'inline-block' : 'none';
        }
        
        // Habilitar/desabilitar botão de finalizar
        const finishButton = document.getElementById('finishSaleButton');
        if (finishButton) {
            finishButton.disabled = items.length === 0 || total <= 0;
        }
        
        return {
            subtotal,
            discount,
            tax,
            total,
            itemCount: items.length
        };
        
    } catch (error) {
        console.error('❌ Erro em updateSaleSummary:', error);
        showNotification('Erro ao calcular resumo da venda', 'error');
        return { subtotal: 0, discount: 0, tax: 0, total: 0, itemCount: 0 };
    }
}

/**
 * Ajusta a quantidade de um item na venda
 * @param {string} itemId - ID do item
 * @param {number} change - Quantidade a adicionar/subtrair
 */
function adjustSaleQuantity(itemId, change) {
    try {
        let items = JSON.parse(localStorage.getItem('saleItems') || '[]');
        const itemIndex = items.findIndex(item => item.id === itemId);
        
        if (itemIndex === -1) {
            showNotification('Item não encontrado na venda', 'error');
            return;
        }
        
        const newQuantity = items[itemIndex].quantity + change;
        
        if (newQuantity < 1) {
            // Remover item se quantidade for 0
            items.splice(itemIndex, 1);
            showNotification('Item removido da venda', 'info');
        } else {
            // Atualizar quantidade
            items[itemIndex].quantity = newQuantity;
            items[itemIndex].total = items[itemIndex].price * newQuantity;
            showNotification(`Quantidade atualizada: ${newQuantity}`, 'success');
        }
        
        // Salvar no localStorage
        localStorage.setItem('saleItems', JSON.stringify(items));
        
        // Atualizar interface
        updateSaleItemsTable();
        updateSaleSummary();
        
    } catch (error) {
        console.error('❌ Erro em adjustSaleQuantity:', error);
        showNotification('Erro ao ajustar quantidade', 'error');
    }
}

/**
 * Atualiza a quantidade específica de um item
 * @param {string} itemId - ID do item
 * @param {number|string} newQuantity - Nova quantidade
 */
function updateSaleItemQuantity(itemId, newQuantity) {
    newQuantity = parseInt(newQuantity);
    
    if (isNaN(newQuantity) || newQuantity < 1) {
        removeSaleItem(itemId);
        return;
    }
    
    try {
        let items = JSON.parse(localStorage.getItem('saleItems') || '[]');
        const itemIndex = items.findIndex(item => item.id === itemId);
        
        if (itemIndex !== -1) {
            items[itemIndex].quantity = newQuantity;
            items[itemIndex].total = items[itemIndex].price * newQuantity;
            
            localStorage.setItem('saleItems', JSON.stringify(items));
            updateSaleItemsTable();
            updateSaleSummary();
            
            showNotification('Quantidade atualizada', 'success');
        }
    } catch (error) {
        console.error('❌ Erro em updateSaleItemQuantity:', error);
        showNotification('Erro ao atualizar quantidade', 'error');
    }
}

/**
 * Remove um item da venda
 * @param {string} itemId - ID do item a ser removido
 */
function removeSaleItem(itemId) {
    try {
        let items = JSON.parse(localStorage.getItem('saleItems') || '[]');
        const item = items.find(item => item.id === itemId);
        
        if (!item) {
            showNotification('Item não encontrado', 'error');
            return;
        }
        
        if (!confirm(`Remover "${item.name}" da venda?`)) {
            return;
        }
        
        items = items.filter(item => item.id !== itemId);
        localStorage.setItem('saleItems', JSON.stringify(items));
        
        updateSaleItemsTable();
        updateSaleSummary();
        
        showNotification('Item removido da venda', 'success');
        
    } catch (error) {
        console.error('❌ Erro em removeSaleItem:', error);
        showNotification('Erro ao remover item', 'error');
    }
}

/**
 * Abre modal com detalhes da venda (VERSÃO SEGURA)
 * @param {object} sale - Objeto da venda
 */
function openSaleDetailsModal(sale) {
    // Fechar modal existente
    const existingModal = document.getElementById('saleDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Criar modal seguro
    const modalHTML = `
        <div class="modal-overlay" id="saleDetailsModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div class="modal-content" style="
                background: white;
                border-radius: 12px;
                padding: 20px;
                max-width: 800px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <div class="modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #eee;
                ">
                    <h3 style="margin: 0;">📋 Detalhes da Venda #${sale.sale_number || sale.id || 'N/A'}</h3>
                    <button onclick="closeModal('saleDetailsModal')" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                        padding: 0;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        transition: background 0.2s;
                    ">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                    ">
                        <div>
                            <label style="font-weight: 600; color: #666;">Data:</label>
                            <div>${formatDate(sale.sale_date || sale.created_at)}</div>
                        </div>
                        <div>
                            <label style="font-weight: 600; color: #666;">Cliente:</label>
                            <div>${sale.client_name || 'Não informado'}</div>
                        </div>
                        <div>
                            <label style="font-weight: 600; color: #666;">Vendedor:</label>
                            <div>${sale.seller_name || 'Sistema'}</div>
                        </div>
                        <div>
                            <label style="font-weight: 600; color: #666;">Status:</label>
                            <span style="
                                background: ${sale.status === 'completed' ? '#10B981' : '#F59E0B'};
                                color: white;
                                padding: 2px 8px;
                                border-radius: 12px;
                                font-size: 12px;
                            ">${sale.status || 'Completa'}</span>
                        </div>
                    </div>
                    
                    <h4 style="margin: 20px 0 10px 0;">Itens da Venda</h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f8f9fa;">
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Produto</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Qtd</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Preço Unit.</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(sale.items || []).map(item => `
                                    <tr>
                                        <td style="padding: 10px; border-bottom: 1px solid #eee;">
                                            <strong>${item.product_name || 'Produto'}</strong><br>
                                            <small style="color: #666;">${item.product_code || 'N/A'}</small>
                                        </td>
                                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.quantity || 0}</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${formatCurrency(item.unit_price || 0)}</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: 600;">${formatCurrency(item.total_price || 0)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 2px solid #eee;
                        text-align: right;
                    ">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Subtotal:</span>
                            <strong>${formatCurrency(sale.total_amount || 0)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Desconto:</span>
                            <strong style="color: #ef4444;">-${formatCurrency(sale.discount || 0)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Taxa:</span>
                            <strong style="color: #3b82f6;">+${formatCurrency(sale.tax || 0)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 1.2em;">
                            <span><strong>TOTAL:</strong></span>
                            <strong style="color: #10b981;">${formatCurrency(sale.final_amount || 0)}</strong>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 1px solid #eee;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                ">
                    <button onclick="closeModal('saleDetailsModal')" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                    ">Fechar</button>
                    <button onclick="printSale('${sale.id}')" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                    ">🖨️ Imprimir</button>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar ao corpo
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Visualiza uma venda específica (VERSÃO SEGURA)
 * @param {string|number} saleId - ID da venda
 */
async function viewSale(saleId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para visualizar vendas', 'error');
            return;
        }
        
        showNotification('Carregando detalhes da venda...', 'info');
        
        const response = await fetch(`${API_URL}/sales/${saleId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.sale) {
            openSaleDetailsModal(data.sale);
        } else {
            showNotification('Venda não encontrada', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em viewSale:', error);
        showNotification('Erro ao carregar detalhes da venda', 'error');
    }
}

/**
 * Exclui uma venda
 * @param {string|number} saleId - ID da venda
 * @param {string} saleNumber - Número da venda (para confirmação)
 */
async function deleteSale(saleId, saleNumber = '') {
    if (!confirm(`Tem certeza que deseja excluir a venda ${saleNumber ? '#' + saleNumber : ''}? Esta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para excluir vendas', 'error');
            return;
        }
        
        showNotification('Excluindo venda...', 'info');
        
        const response = await fetch(`${API_URL}/sales/${saleId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Venda excluída com sucesso!', 'success');
            // Recarregar lista de vendas se existir
            if (typeof loadSales === 'function') {
                setTimeout(loadSales, 500);
            }
        } else {
            showNotification(data.message || 'Erro ao excluir venda', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em deleteSale:', error);
        showNotification('Erro ao excluir venda', 'error');
    }
}

// ==============================================
// FUNÇÕES DE CLIENTES (COM CORREÇÕES)
// ==============================================

/**
 * Abre modal para editar cliente (VERSÃO SEGURA)
 * @param {object} client - Objeto do cliente
 */
function openEditClientModal(client) {
    // Fechar modal existente
    const existingModal = document.getElementById('editClientModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div class="modal-overlay" id="editClientModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div class="modal-content" style="
                background: white;
                border-radius: 12px;
                padding: 20px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <div class="modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #eee;
                ">
                    <h3 style="margin: 0;">✏️ Editar Cliente</h3>
                    <button onclick="closeModal('editClientModal')" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    ">&times;</button>
                </div>
                <form id="editClientForm" onsubmit="saveClientChanges(event, '${client.id}')">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Nome *</label>
                        <input type="text" id="editClientName" value="${(client.name || '').replace(/"/g, '&quot;')}" 
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;" required>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Email</label>
                        <input type="email" id="editClientEmail" value="${(client.email || '').replace(/"/g, '&quot;')}"
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Telefone</label>
                        <input type="tel" id="editClientPhone" value="${(client.phone || '').replace(/"/g, '&quot;')}"
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Categoria</label>
                        <select id="editClientCategory" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                            <option value="normal" ${client.category === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="VIP" ${client.category === 'VIP' ? 'selected' : ''}>VIP</option>
                            <option value="corporate" ${client.category === 'corporate' ? 'selected' : ''}>Corporate</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 20px;">
                        <button type="button" onclick="closeModal('editClientModal')" style="
                            flex: 1;
                            background: #6c757d;
                            color: white;
                            border: none;
                            padding: 12px;
                            border-radius: 6px;
                            cursor: pointer;
                        ">Cancelar</button>
                        <button type="submit" style="
                            flex: 1;
                            background: #3b82f6;
                            color: white;
                            border: none;
                            padding: 12px;
                            border-radius: 6px;
                            cursor: pointer;
                        ">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Salva alterações do cliente
 * @param {Event} event - Evento do formulário
 * @param {string} clientId - ID do cliente
 */
async function saveClientChanges(event, clientId) {
    event.preventDefault();
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para editar clientes', 'error');
            return;
        }
        
        const clientData = {
            name: document.getElementById('editClientName').value.trim(),
            email: document.getElementById('editClientEmail').value.trim() || null,
            phone: document.getElementById('editClientPhone').value.trim() || null,
            category: document.getElementById('editClientCategory').value
        };
        
        if (!clientData.name) {
            showNotification('Nome é obrigatório', 'error');
            return;
        }
        
        showNotification('Salvando alterações...', 'info');
        
        const response = await fetch(`${API_URL}/clients/${clientId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clientData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Cliente atualizado com sucesso!', 'success');
            closeModal('editClientModal');
            if (typeof loadClients === 'function') {
                setTimeout(loadClients, 500);
            }
        } else {
            showNotification(data.message || 'Erro ao atualizar cliente', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em saveClientChanges:', error);
        showNotification('Erro ao salvar alterações', 'error');
    }
}

/**
 * Edita um cliente
 * @param {string|number} clientId - ID do cliente
 */
async function editClient(clientId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para editar clientes', 'error');
            return;
        }
        
        showNotification('Carregando dados do cliente...', 'info');
        
        const response = await fetch(`${API_URL}/clients/${clientId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.client) {
            openEditClientModal(data.client);
        } else {
            showNotification('Cliente não encontrado', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em editClient:', error);
        showNotification('Erro ao carregar dados do cliente', 'error');
    }
}

/**
 * Exclui um cliente
 * @param {string|number} clientId - ID do cliente
 * @param {string} clientName - Nome do cliente (para confirmação)
 */
async function deleteClient(clientId, clientName = '') {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${clientName}"? Esta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para excluir clientes', 'error');
            return;
        }
        
        showNotification('Excluindo cliente...', 'info');
        
        const response = await fetch(`${API_URL}/clients/${clientId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Cliente excluído com sucesso!', 'success');
            if (typeof loadClients === 'function') {
                setTimeout(loadClients, 500);
            }
        } else {
            showNotification(data.message || 'Erro ao excluir cliente', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em deleteClient:', error);
        showNotification('Erro ao excluir cliente', 'error');
    }
}

// ==============================================
// FUNÇÕES DE PRODUTOS (COM CORREÇÕES)
// ==============================================

/**
 * Abre modal para editar produto (VERSÃO SEGURA)
 * @param {object} product - Objeto do produto
 */
function openEditProductModal(product) {
    // Fechar modal existente
    const existingModal = document.getElementById('editProductModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div class="modal-overlay" id="editProductModal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div class="modal-content" style="
                background: white;
                border-radius: 12px;
                padding: 20px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <div class="modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #eee;
                ">
                    <h3 style="margin: 0;">✏️ Editar Produto</h3>
                    <button onclick="closeModal('editProductModal')" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    ">&times;</button>
                </div>
                <form id="editProductForm" onsubmit="saveProductChanges(event, '${product.id}')">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Código *</label>
                        <input type="text" id="editProductCode" value="${(product.code || '').replace(/"/g, '&quot;')}" 
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;" required>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Nome *</label>
                        <input type="text" id="editProductName" value="${(product.name || '').replace(/"/g, '&quot;')}"
                               style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;" required>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Preço *</label>
                            <input type="number" id="editProductPrice" step="0.01" min="0" 
                                   value="${product.unit_price || 0}"
                                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;" required>
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Estoque</label>
                            <input type="number" id="editProductStock" min="0" 
                                   value="${product.stock || 0}"
                                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 20px;">
                        <button type="button" onclick="closeModal('editProductModal')" style="
                            flex: 1;
                            background: #6c757d;
                            color: white;
                            border: none;
                            padding: 12px;
                            border-radius: 6px;
                            cursor: pointer;
                        ">Cancelar</button>
                        <button type="submit" style="
                            flex: 1;
                            background: #3b82f6;
                            color: white;
                            border: none;
                            padding: 12px;
                            border-radius: 6px;
                            cursor: pointer;
                        ">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Salva alterações do produto
 * @param {Event} event - Evento do formulário
 * @param {string} productId - ID do produto
 */
async function saveProductChanges(event, productId) {
    event.preventDefault();
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para editar produtos', 'error');
            return;
        }
        
        const productData = {
            code: document.getElementById('editProductCode').value.trim(),
            name: document.getElementById('editProductName').value.trim(),
            unit_price: parseFloat(document.getElementById('editProductPrice').value),
            stock: parseInt(document.getElementById('editProductStock').value) || 0
        };
        
        if (!productData.code || !productData.name || productData.unit_price < 0) {
            showNotification('Código, nome e preço válido são obrigatórios', 'error');
            return;
        }
        
        showNotification('Salvando alterações...', 'info');
        
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Produto atualizado com sucesso!', 'success');
            closeModal('editProductModal');
            if (typeof loadProducts === 'function') {
                setTimeout(loadProducts, 500);
            }
        } else {
            showNotification(data.message || 'Erro ao atualizar produto', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em saveProductChanges:', error);
        showNotification('Erro ao salvar alterações', 'error');
    }
}

/**
 * Edita um produto
 * @param {string|number} productId - ID do produto
 */
async function editProduct(productId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para editar produtos', 'error');
            return;
        }
        
        showNotification('Carregando dados do produto...', 'info');
        
        const response = await fetch(`${API_URL}/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.product) {
            openEditProductModal(data.product);
        } else {
            showNotification('Produto não encontrado', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em editProduct:', error);
        showNotification('Erro ao carregar dados do produto', 'error');
    }
}

/**
 * Exclui um produto
 * @param {string|number} productId - ID do produto
 * @param {string} productName - Nome do produto (para confirmação)
 */
async function deleteProduct(productId, productName = '') {
    if (!confirm(`Tem certeza que deseja excluir o produto "${productName}"? Esta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para excluir produtos', 'error');
            return;
        }
        
        showNotification('Excluindo produto...', 'info');
        
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Produto excluído com sucesso!', 'success');
            if (typeof loadProducts === 'function') {
                setTimeout(loadProducts, 500);
            }
        } else {
            showNotification(data.message || 'Erro ao excluir produto', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em deleteProduct:', error);
        showNotification('Erro ao excluir produto', 'error');
    }
}

// ==============================================
// FUNÇÕES AUXILIARES GERAIS (COM CORREÇÕES)
// ==============================================

/**
 * Fecha um modal de forma segura
 * @param {string} modalId - ID do modal
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            if (modal.parentElement) {
                modal.remove();
            }
        }, 300);
    }
}

/**
 * Formata valor monetário
 * @param {number} value - Valor a formatar
 * @returns {string} Valor formatado
 */
function formatCurrency(value) {
    if (typeof value !== 'number') {
        value = parseFloat(value) || 0;
    }
    return new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Formata data
 * @param {string|Date} dateString - Data a formatar
 * @returns {string} Data formatada
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Data inválida';
    
    return new Intl.DateTimeFormat('pt-MZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

/**
 * Atualiza tabela de itens da venda
 */
function updateSaleItemsTable() {
    try {
        const items = JSON.parse(localStorage.getItem('saleItems') || '[]');
        const tbody = document.getElementById('saleItemsBody');
        
        if (!tbody) return;
        
        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; opacity: 0.5;">🛒</div>
                        <p style="margin-top: 10px;">Nenhum item adicionado à venda</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = items.map((item, index) => `
            <tr>
                <td style="padding: 10px;">${index + 1}</td>
                <td style="padding: 10px;">
                    <strong>${item.code || 'N/A'}</strong><br>
                    <small style="color: #666;">${item.name || ''}</small>
                </td>
                <td style="padding: 10px;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <button onclick="adjustSaleQuantity('${item.id}', -1)" 
                                style="width: 30px; height: 30px; border-radius: 50%; background: #ef4444; color: white; border: none; cursor: pointer;">-</button>
                        <input type="number" value="${item.quantity}" min="1" 
                               onchange="updateSaleItemQuantity('${item.id}', this.value)"
                               style="width: 60px; text-align: center; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                        <button onclick="adjustSaleQuantity('${item.id}', 1)"
                                style="width: 30px; height: 30px; border-radius: 50%; background: #10b981; color: white; border: none; cursor: pointer;">+</button>
                    </div>
                </td>
                <td style="padding: 10px;">${formatCurrency(item.price || 0)}</td>
                <td style="padding: 10px; font-weight: 600;">${formatCurrency(item.total || 0)}</td>
                <td style="padding: 10px;">
                    <button onclick="removeSaleItem('${item.id}')" 
                            style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                        Remover
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('❌ Erro em updateSaleItemsTable:', error);
    }
}

/**
 * Imprime uma venda (placeholder)
 * @param {string} saleId - ID da venda
 */
function printSale(saleId) {
    showNotification('Funcionalidade de impressão em desenvolvimento', 'info');
    // Implementação futura
}

// ==============================================
// INICIALIZAÇÃO E EXPORTAÇÃO
// ==============================================

// Exportar funções para uso global (VERSÃO SEGURA)
window.updateSaleSummary = updateSaleSummary;
window.adjustSaleQuantity = adjustSaleQuantity;
window.updateSaleItemQuantity = updateSaleItemQuantity;
window.removeSaleItem = removeSaleItem;
window.viewSale = viewSale;
window.deleteSale = deleteSale;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.showNotification = showNotification;
window.closeModal = closeModal;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.updateSaleItemsTable = updateSaleItemsTable;
window.printSale = printSale;
window.safeFormReset = window.safeFormReset; // Já definido no início

// Inicializar quando DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📄 DOM carregado, inicializando funções...');
        // Inicializar tabela de itens se existir
        if (document.getElementById('saleItemsBody')) {
            updateSaleItemsTable();
            updateSaleSummary();
        }
    });
} else {
    console.log('📄 DOM já carregado');
    if (document.getElementById('saleItemsBody')) {
        updateSaleItemsTable();
        updateSaleSummary();
    }
}

console.log('✅ functions.js corrigido e carregado com sucesso!');
