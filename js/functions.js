// ==============================================
// BIZZFLOW CRM - FUNÇÕES COMPLETAS (CORRIGIDAS)
// Arquivo: js/functions.js
// Versão: 2.0.0 (Completa e Corrigida)
// Data: 2024-01-15
// ==============================================

console.log('🚀 Inicializando BizzFlow CRM v2.0...');

// Configuração da API
const API_URL = window.location.hostname.includes('render.com') 
    ? 'https://bizzflow-crm.onrender.com/api'
    : 'http://localhost:5000/api';

console.log('🔧 API_URL configurada:', API_URL);

// ==============================================
// FUNÇÕES DE NOTIFICAÇÃO
// ==============================================

/**
 * Mostra uma notificação na tela
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 */
function showNotification(message, type = 'info') {
    console.log(`📢 Notificação [${type}]: ${message}`);
    
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
    
    return notification;
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
// FUNÇÕES DE VENDAS
// ==============================================

/**
 * Atualiza o resumo da venda
 * @returns {object} Totais da venda
 */
function updateSaleSummary() {
    try {
        console.log('💰 Calculando resumo da venda...');
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
        
        console.log('📊 Totais:', { subtotal, discount, tax, total });
        
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
 * Atualiza tabela de itens da venda
 */
function updateSaleItemsTable() {
    try {
        console.log('🛒 Atualizando tabela de itens da venda...');
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
        
        console.log('✅ Tabela de itens atualizada:', items.length, 'itens');
        
    } catch (error) {
        console.error('❌ Erro em updateSaleItemsTable:', error);
    }
}

/**
 * Ajusta a quantidade de um item na venda
 * @param {string} itemId - ID do item
 * @param {number} change - Quantidade a adicionar/subtrair
 */
function adjustSaleQuantity(itemId, change) {
    try {
        console.log('🔄 Ajustando quantidade do item:', itemId, 'change:', change);
        
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
    console.log('✏️ Atualizando quantidade do item:', itemId, 'para:', newQuantity);
    
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
    console.log('🗑️ Removendo item da venda:', itemId);
    
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
 * Atualiza tabela de vendas/pedidos
 * @param {Array} orders - Array de vendas
 * @param {string} elementId - ID da tabela
 */
function updateOrdersTable(orders = [], elementId = 'orders-table') {
    console.log('📊 Atualizando tabela de vendas:', orders.length, 'vendas, elemento:', elementId);
    
    const tableElement = document.getElementById(elementId);
    if (!tableElement) {
        console.error(`❌ Elemento #${elementId} não encontrado`);
        return;
    }
    
    // Limpar conteúdo atual
    const tbody = tableElement.querySelector('tbody');
    if (!tbody) {
        console.error('❌ TBody não encontrado na tabela');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!orders || orders.length === 0) {
        // Mostrar mensagem de "sem dados"
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                    <h3 style="margin: 0 0 10px 0;">Nenhuma venda encontrada</h3>
                    <p style="margin: 0;">Realize sua primeira venda para ver os dados aqui.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Adicionar cada venda à tabela
    orders.forEach((order, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.sale_number || `V${index + 1}`}</td>
            <td>${order.client_name || 'Cliente não informado'}</td>
            <td>${formatCurrency(order.final_amount || 0)}</td>
            <td>
                <span class="badge ${order.payment_method === 'cash' ? 'badge-success' : 
                                 order.payment_method === 'card' ? 'badge-info' : 
                                 order.payment_method === 'transfer' ? 'badge-warning' : 'badge-secondary'}">
                    ${getPaymentMethodLabel(order.payment_method)}
                </span>
            </td>
            <td>${formatDate(order.sale_date || order.created_at)}</td>
            <td>
                <span class="badge ${order.status === 'completed' ? 'badge-success' : 
                                 order.status === 'pending' ? 'badge-warning' : 
                                 order.status === 'cancelled' ? 'badge-danger' : 'badge-secondary'}">
                    ${getStatusLabel(order.status)}
                </span>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewSale('${order.id}')" title="Ver detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${order.status === 'pending' ? `
                        <button class="btn btn-sm btn-outline-success" onclick="completeSale('${order.id}')" title="Completar">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSale('${order.id}', '${order.sale_number || ''}')" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Atualizar contador se existir
    const countElement = document.querySelector('.orders-count');
    if (countElement) {
        countElement.textContent = orders.length;
    }
    
    console.log('✅ Tabela de vendas atualizada com sucesso');
}

/**
 * Carrega todas as vendas
 */
async function loadAllSales() {
    console.log('📥 Carregando todas as vendas...');
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para ver vendas', 'error');
            return;
        }
        
        const response = await fetch(`${API_URL}/sales?limit=100`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.sales) {
            updateOrdersTable(data.sales, 'all-sales-table');
            showNotification(`Carregadas ${data.sales.length} vendas`, 'success');
        } else {
            showNotification('Nenhuma venda encontrada', 'info');
            updateOrdersTable([], 'all-sales-table');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
        showNotification('Erro ao carregar vendas', 'error');
        updateOrdersTable([], 'all-sales-table');
    }
}

/**
 * Visualiza uma venda específica
 * @param {string|number} saleId - ID da venda
 */
async function viewSale(saleId) {
    console.log('👁️ Visualizando venda:', saleId);
    
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
 * Abre modal com detalhes da venda
 * @param {object} sale - Objeto da venda
 */
function openSaleDetailsModal(sale) {
    console.log('📋 Abrindo modal de detalhes da venda:', sale.sale_number);
    
    // Fechar modal existente
    const existingModal = document.getElementById('saleDetailsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
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
 * Exclui uma venda
 * @param {string|number} saleId - ID da venda
 * @param {string} saleNumber - Número da venda (para confirmação)
 */
async function deleteSale(saleId, saleNumber = '') {
    console.log('🗑️ Excluindo venda:', saleId, saleNumber);
    
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
            // Recarregar lista de vendas
            setTimeout(loadAllSales, 500);
        } else {
            showNotification(data.message || 'Erro ao excluir venda', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em deleteSale:', error);
        showNotification('Erro ao excluir venda', 'error');
    }
}

/**
 * Completa uma venda pendente
 * @param {string|number} saleId - ID da venda
 */
async function completeSale(saleId) {
    console.log('✅ Completando venda:', saleId);
    
    if (!confirm('Marcar esta venda como concluída?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para completar vendas', 'error');
            return;
        }
        
        showNotification('Completando venda...', 'info');
        
        // Nota: Esta função requer um endpoint específico para completar vendas
        // Por enquanto, apenas mostra uma notificação
        showNotification('Funcionalidade de completar venda em desenvolvimento', 'info');
        
    } catch (error) {
        console.error('❌ Erro em completeSale:', error);
        showNotification('Erro ao completar venda', 'error');
    }
}

// ==============================================
// FUNÇÕES DE CLIENTES
// ==============================================

/**
 * Carrega todos os clientes
 */
async function loadAllClients() {
    console.log('👥 Carregando todos os clientes...');
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para ver clientes', 'error');
            return;
        }
        
        const response = await fetch(`${API_URL}/clients`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.clients) {
            updateClientsTable(data.clients);
            showNotification(`Carregados ${data.clients.length} clientes`, 'success');
        } else {
            showNotification('Nenhum cliente encontrado', 'info');
            updateClientsTable([]);
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar clientes:', error);
        showNotification('Erro ao carregar clientes', 'error');
        updateClientsTable([]);
    }
}

/**
 * Atualiza tabela de clientes
 * @param {Array} clients - Array de clientes
 */
function updateClientsTable(clients) {
    console.log('📋 Atualizando tabela de clientes:', clients.length, 'clientes');
    
    const tableElement = document.getElementById('clients-table');
    if (!tableElement) {
        console.error('❌ Tabela de clientes não encontrada');
        return;
    }
    
    const tbody = tableElement.querySelector('tbody');
    if (!tbody) {
        console.error('❌ TBody não encontrado na tabela de clientes');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!clients || clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; opacity: 0.5;">👥</div>
                    <p style="margin-top: 10px;">Nenhum cliente cadastrado</p>
                </td>
            </tr>
        `;
        return;
    }
    
    clients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.name}</td>
            <td>${client.email || 'N/A'}</td>
            <td>${client.phone || 'N/A'}</td>
            <td>
                <span class="badge ${client.category === 'VIP' ? 'badge-warning' : 
                                 client.category === 'corporate' ? 'badge-info' : 'badge-secondary'}">
                    ${client.category || 'normal'}
                </span>
            </td>
            <td>${formatCurrency(client.total_spent || 0)}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editClient(${client.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteClient(${client.id}, '${client.name}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log('✅ Tabela de clientes atualizada');
}

/**
 * Edita um cliente
 * @param {string|number} clientId - ID do cliente
 */
async function editClient(clientId) {
    console.log('✏️ Editando cliente:', clientId);
    
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
 * Abre modal para editar cliente
 * @param {object} client - Objeto do cliente
 */
function openEditClientModal(client) {
    console.log('📝 Abrindo modal de edição do cliente:', client.name);
    
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
    console.log('💾 Salvando alterações do cliente:', clientId);
    
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
            setTimeout(loadAllClients, 500);
        } else {
            showNotification(data.message || 'Erro ao atualizar cliente', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em saveClientChanges:', error);
        showNotification('Erro ao salvar alterações', 'error');
    }
}

/**
 * Exclui um cliente
 * @param {string|number} clientId - ID do cliente
 * @param {string} clientName - Nome do cliente (para confirmação)
 */
async function deleteClient(clientId, clientName = '') {
    console.log('🗑️ Excluindo cliente:', clientId, clientName);
    
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
            setTimeout(loadAllClients, 500);
        } else {
            showNotification(data.message || 'Erro ao excluir cliente', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em deleteClient:', error);
        showNotification('Erro ao excluir cliente', 'error');
    }
}

// ==============================================
// FUNÇÕES DE PRODUTOS
// ==============================================

/**
 * Carrega todos os produtos
 */
async function loadAllProducts() {
    console.log('📦 Carregando todos os produtos...');
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para ver produtos', 'error');
            return;
        }
        
        const response = await fetch(`${API_URL}/products`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.products) {
            updateProductsTable(data.products);
            showNotification(`Carregados ${data.products.length} produtos`, 'success');
        } else {
            showNotification('Nenhum produto encontrado', 'info');
            updateProductsTable([]);
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        showNotification('Erro ao carregar produtos', 'error');
        updateProductsTable([]);
    }
}

/**
 * Atualiza tabela de produtos
 * @param {Array} products - Array de produtos
 */
function updateProductsTable(products) {
    console.log('📋 Atualizando tabela de produtos:', products.length, 'produtos');
    
    const tableElement = document.getElementById('products-table');
    if (!tableElement) {
        console.error('❌ Tabela de produtos não encontrada');
        return;
    }
    
    const tbody = tableElement.querySelector('tbody');
    if (!tbody) {
        console.error('❌ TBody não encontrado na tabela de produtos');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!products || products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; opacity: 0.5;">📦</div>
                    <p style="margin-top: 10px;">Nenhum produto cadastrado</p>
                </td>
            </tr>
        `;
        return;
    }
    
    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.code}</td>
            <td>${product.name}</td>
            <td>${product.category || 'N/A'}</td>
            <td>${formatCurrency(product.unit_price)}</td>
            <td>
                <span class="badge ${product.stock <= product.min_stock ? 'badge-danger' : 'badge-success'}">
                    ${product.stock} unidades
                </span>
            </td>
            <td>${product.supplier || 'N/A'}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${product.id}, '${product.name}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log('✅ Tabela de produtos atualizada');
}

/**
 * Edita um produto
 * @param {string|number} productId - ID do produto
 */
async function editProduct(productId) {
    console.log('✏️ Editando produto:', productId);
    
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
 * Abre modal para editar produto
 * @param {object} product - Objeto do produto
 */
function openEditProductModal(product) {
    console.log('📝 Abrindo modal de edição do produto:', product.name);
    
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
    console.log('💾 Salvando alterações do produto:', productId);
    
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
            setTimeout(loadAllProducts, 500);
        } else {
            showNotification(data.message || 'Erro ao atualizar produto', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em saveProductChanges:', error);
        showNotification('Erro ao salvar alterações', 'error');
    }
}

/**
 * Exclui um produto
 * @param {string|number} productId - ID do produto
 * @param {string} productName - Nome do produto (para confirmação)
 */
async function deleteProduct(productId, productName = '') {
    console.log('🗑️ Excluindo produto:', productId, productName);
    
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
            setTimeout(loadAllProducts, 500);
        } else {
            showNotification(data.message || 'Erro ao excluir produto', 'error');
        }
        
    } catch (error) {
        console.error('❌ Erro em deleteProduct:', error);
        showNotification('Erro ao excluir produto', 'error');
    }
}

// ==============================================
// FUNÇÕES DE DASHBOARD
// ==============================================

/**
 * Carrega dados do dashboard
 */
async function loadDashboardData() {
    console.log('📈 Carregando dados do dashboard...');
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showNotification('Faça login para ver o dashboard', 'error');
            return;
        }
        
        // Carregar métricas
        const response = await fetch(`${API_URL}/dashboard/metrics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.metrics) {
            updateDashboardMetrics(data.metrics);
            showNotification('Dashboard atualizado', 'success');
        } else {
            showNotification('Erro ao carregar dashboard', 'error');
            useMockDashboardData();
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar dashboard:', error);
        showNotification('Erro ao carregar dashboard', 'error');
        useMockDashboardData();
    }
}

/**
 * Atualiza métricas do dashboard
 * @param {object} metrics - Objeto com métricas
 */
function updateDashboardMetrics(metrics) {
    console.log('📊 Atualizando métricas do dashboard:', metrics);
    
    // Atualizar cada métrica se o elemento existir
    const elements = {
        'sales-today': metrics.sales_today,
        'revenue-today': formatCurrency(metrics.revenue_today),
        'total-clients': metrics.total_clients,
        'total-products': metrics.total_products,
        'low-stock': metrics.low_stock_items
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
        }
    });
    
    // Atualizar crescimento
    const growthElement = document.getElementById('growth-percentage');
    if (growthElement && metrics.growth_percentage !== undefined) {
        growthElement.textContent = `${metrics.growth_percentage}%`;
        growthElement.className = metrics.growth_percentage >= 0 ? 'text-success' : 'text-danger';
    }
}

/**
 * Usa dados mock para o dashboard (fallback)
 */
function useMockDashboardData() {
    console.log('🔄 Usando dados mock para dashboard');
    
    const mockMetrics = {
        sales_today: 8,
        revenue_today: 12500,
        total_clients: 42,
        total_products: 156,
        low_stock_items: 12,
        growth_percentage: 15.5
    };
    
    updateDashboardMetrics(mockMetrics);
}

// ==============================================
// FUNÇÕES DE NAVEGAÇÃO E PÁGINAS
// ==============================================

/**
 * Atualiza dados da página atual
 * @param {string} page - Nome da página
 */
function updatePageData(page) {
    console.log(`🔄 Atualizando dados da página: ${page}`);
    
    switch(page) {
        case 'dashboard':
            loadDashboardData();
            break;
            
        case 'sales':
            loadAllSales();
            break;
            
        case 'clients':
            loadAllClients();
            break;
            
        case 'products':
            loadAllProducts();
            break;
            
        case 'reports':
            loadReportsData();
            break;
            
        default:
            console.log(`Página ${page} não requer atualização automática`);
    }
}

/**
 * Mostra uma página específica
 * @param {string} pageId - ID da página
 */
function showPage(pageId) {
    console.log(`📄 Mostrando página: ${pageId}`);
    
    // Esconder todas as páginas
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => {
        page.style.display = 'none';
    });
    
    // Remover classe active de todos os links do menu
    const menuLinks = document.querySelectorAll('.nav-link');
    menuLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Mostrar página selecionada
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.style.display = 'block';
        
        // Ativar link do menu correspondente
        const menuLink = document.querySelector(`[data-page="${pageId}"]`);
        if (menuLink) {
            menuLink.classList.add('active');
        }
        
        // Atualizar dados da página
        setTimeout(() => {
            updatePageData(pageId);
        }, 100);
        
        // Atualizar título da página
        updatePageTitle(pageId);
        
        console.log(`✅ Página ${pageId} exibida`);
    } else {
        console.error(`❌ Página #${pageId}-page não encontrada`);
        showNotification(`Página "${pageId}" não encontrada`, 'error');
    }
}

/**
 * Atualiza título da página
 * @param {string} pageId - ID da página
 */
function updatePageTitle(pageId) {
    const titles = {
        'dashboard': 'Dashboard',
        'sales': 'Vendas',
        'clients': 'Clientes',
        'products': 'Produtos',
        'reports': 'Relatórios',
        'settings': 'Configurações'
    };
    
    const titleElement = document.getElementById('page-title');
    if (titleElement) {
        titleElement.textContent = titles[pageId] || pageId;
    }
    
    // Atualizar título da aba do navegador
    document.title = `${titles[pageId] || pageId} - BizzFlow CRM`;
}

/**
 * Carrega dados de relatórios (placeholder)
 */
function loadReportsData() {
    console.log('📊 Carregando dados de relatórios...');
    showNotification('Módulo de relatórios em desenvolvimento', 'info');
}

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

/**
 * Fecha um modal
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
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        
        return new Intl.DateTimeFormat('pt-MZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    } catch (error) {
        return dateString;
    }
}

/**
 * Retorna label do método de pagamento
 * @param {string} method - Método de pagamento
 * @returns {string} Label formatado
 */
function getPaymentMethodLabel(method) {
    const methods = {
        'cash': 'Dinheiro',
        'card': 'Cartão',
        'transfer': 'Transferência',
        'credit': 'Crédito',
        'debit': 'Débito'
    };
    return methods[method] || method || 'Não informado';
}

/**
 * Retorna label do status
 * @param {string} status - Status
 * @returns {string} Label formatado
 */
function getStatusLabel(status) {
    const statuses = {
        'completed': 'Concluída',
        'pending': 'Pendente',
        'cancelled': 'Cancelada',
        'processing': 'Processando'
    };
    return statuses[status] || status || 'Desconhecido';
}

/**
 * Imprime uma venda (placeholder)
 * @param {string} saleId - ID da venda
 */
function printSale(saleId) {
    showNotification('Funcionalidade de impressão em desenvolvimento', 'info');
}

// ==============================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ==============================================

/**
 * Inicializa event listeners
 */
function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
    
    // Menu navigation
    const menuLinks = document.querySelectorAll('[data-page]');
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            showPage(page);
        });
    });
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            filterTable(searchTerm);
        });
    }
    
    console.log('✅ Event listeners configurados');
}

/**
 * Faz logout do sistema
 */
function logout() {
    console.log('👋 Realizando logout...');
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('saleItems');
    
    showNotification('Sessão encerrada com sucesso', 'success');
    
    setTimeout(() => {
        window.location.href = '/';
    }, 1500);
}

/**
 * Filtra tabela por termo de busca
 * @param {string} searchTerm - Termo de busca
 */
function filterTable(searchTerm) {
    const tables = document.querySelectorAll('.data-table tbody');
    
    tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

/**
 * Verifica autenticação
 * @returns {boolean} True se autenticado
 */
function checkAuth() {
    const token = localStorage.getItem('token');
    const currentPath = window.location.pathname;
    
    // Se não está na página de login e não tem token, redirecionar
    if (!currentPath.includes('index.html') && !token && currentPath !== '/' && !currentPath.includes('login')) {
        console.warn('🔒 Usuário não autenticado, redirecionando...');
        window.location.href = '/';
        return false;
    }
    
    // Se está na página de login e tem token, redirecionar para dashboard
    if ((currentPath.includes('index.html') || currentPath === '/') && token) {
        console.log('🔑 Usuário já autenticado, redirecionando para dashboard...');
        window.location.href = '/dashboard';
        return true;
    }
    
    return !!token;
}

// ==============================================
// CARREGAMENTO INICIAL
// ==============================================

// Inicializar quando DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📄 DOM carregado, inicializando sistema...');
        
        // Verificar autenticação
        checkAuth();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Inicializar tabela de itens se existir
        if (document.getElementById('saleItemsBody')) {
            updateSaleItemsTable();
            updateSaleSummary();
        }
        
        // Mostrar página inicial (dashboard por padrão)
        const initialPage = localStorage.getItem('currentPage') || 'dashboard';
        showPage(initialPage);
        
        console.log('✅ Sistema inicializado com sucesso!');
    });
} else {
    console.log('📄 DOM já carregado, inicializando...');
    
    checkAuth();
    setupEventListeners();
    
    if (document.getElementById('saleItemsBody')) {
        updateSaleItemsTable();
        updateSaleSummary();
    }
    
    const initialPage = localStorage.getItem('currentPage') || 'dashboard';
    showPage(initialPage);
}

// ==============================================
// EXPORTAÇÃO DE FUNÇÕES PARA ESCOPO GLOBAL
// ==============================================

window.updateSaleSummary = updateSaleSummary;
window.updateSaleItemsTable = updateSaleItemsTable;
window.adjustSaleQuantity = adjustSaleQuantity;
window.updateSaleItemQuantity = updateSaleItemQuantity;
window.removeSaleItem = removeSaleItem;
window.updateOrdersTable = updateOrdersTable;
window.loadAllSales = loadAllSales;
window.viewSale = viewSale;
window.deleteSale = deleteSale;
window.completeSale = completeSale;
window.loadAllClients = loadAllClients;
window.updateClientsTable = updateClientsTable;
window.editClient = editClient;
window.saveClientChanges = saveClientChanges;
window.deleteClient = deleteClient;
window.loadAllProducts = loadAllProducts;
window.updateProductsTable = updateProductsTable;
window.editProduct = editProduct;
window.saveProductChanges = saveProductChanges;
window.deleteProduct = deleteProduct;
window.loadDashboardData = loadDashboardData;
window.updateDashboardMetrics = updateDashboardMetrics;
window.updatePageData = updatePageData;
window.showPage = showPage;
window.updatePageTitle = updatePageTitle;
window.loadReportsData = loadReportsData;
window.showNotification = showNotification;
window.closeModal = closeModal;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.getPaymentMethodLabel = getPaymentMethodLabel;
window.getStatusLabel = getStatusLabel;
window.printSale = printSale;

console.log('🎉 functions.js v2.0 carregado com sucesso! Todas as funções disponíveis.');
