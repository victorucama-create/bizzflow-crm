// ==============================================
// BIZZFLOW CRM - FUNÇÕES COMPLETAS
// ==============================================
// Arquivo: js/functions.js
// Data: 2024
// Autor: BizzFlow CRM
// Descrição: Todas as funções faltantes do sistema
// ==============================================

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
// FUNÇÕES DE VENDAS
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
 * Abre modal com detalhes da venda
 * @param {object} sale - Objeto da venda
 */
function openSaleDetailsModal(sale) {
    // Criar modal
    const modalHTML = `
        <div class="modal-overlay" id="saleDetailsModal">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>📋 Detalhes da Venda #${sale.sale_number || sale.id}</h3>
                    <button class="modal-close" onclick="closeModal('saleDetailsModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="sale-details-grid">
                        <div class="detail-group">
                            <label>Data:</label>
                            <span>${formatDate(sale.sale_date || sale.created_at)}</span>
                        </div>
                        <div class="detail-group">
                            <label>Cliente:</label>
                            <span>${sale.client_name || 'Não informado'}</span>
                        </div>
                        <div class="detail-group">
                            <label>Vendedor:</label>
                            <span>${sale.seller_name || 'Sistema'}</span>
                        </div>
                        <div class="detail-group">
                            <label>Pagamento:</label>
                            <span class="payment-method ${sale.payment_method}">
                                ${getPaymentMethodLabel(sale.payment_method)}
                            </span>
                        </div>
                        <div class="detail-group">
                            <label>Status:</label>
                            <span class="sale-status ${sale.status}">${sale.status || 'Completa'}</span>
                        </div>
                    </div>
                    
                    <h4 style="margin-top: 20px;">Itens da Venda</h4>
                    <div class="table-responsive">
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Código</th>
                                    <th>Quantidade</th>
                                    <th>Preço Unit.</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody id="saleItemsDetails">
                                ${(sale.items || []).map(item => `
                                    <tr>
                                        <td>${item.product_name || 'Produto'}</td>
                                        <td>${item.product_code || 'N/A'}</td>
                                        <td>${item.quantity}</td>
                                        <td>${formatCurrency(item.unit_price)}</td>
                                        <td>${formatCurrency(item.total_price)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="sale-totals" style="margin-top: 20px; text-align: right;">
                        <div class="total-row">
                            <span>Subtotal:</span>
                            <strong>${formatCurrency(sale.total_amount)}</strong>
                        </div>
                        <div class="total-row">
                            <span>Desconto:</span>
                            <strong class="text-danger">-${formatCurrency(sale.discount)}</strong>
                        </div>
                        <div class="total-row">
                            <span>Taxa:</span>
                            <strong class="text-info">+${formatCurrency(sale.tax)}</strong>
                        </div>
                        <div class="total-row grand-total">
                            <span>TOTAL:</span>
                            <strong class="text-success">${formatCurrency(sale.final_amount)}</strong>
                        </div>
                    </div>
                    
                    ${sale.notes ? `
                    <div class="sale-notes" style="margin-top: 20px;">
                        <h4>Observações</h4>
                        <p>${sale.notes}</p>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="closeModal('saleDetailsModal')">Fechar</button>
                    <button class="btn-primary" onclick="printSale('${sale.id}')">🖨️ Imprimir</button>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar ao corpo
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Visualiza uma venda específica
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
                loadSales();
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
// FUNÇÕES DE CLIENTES
// ==============================================

/**
 * Abre modal para editar cliente
 * @param {object} client - Objeto do cliente
 */
function openEditClientModal(client) {
    const modalHTML = `
        <div class="modal-overlay" id="editClientModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Editar Cliente</h3>
                    <button class="modal-close" onclick="closeModal('editClientModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editClientForm" onsubmit="saveClientChanges(event, '${client.id}')">
                        <div class="form-group">
                            <label for="editClientName">Nome *</label>
                            <input type="text" id="editClientName" value="${client.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editClientEmail">Email</label>
                            <input type="email" id="editClientEmail" value="${client.email || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editClientPhone">Telefone</label>
                            <input type="tel" id="editClientPhone" value="${client.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editClientCategory">Categoria</label>
                            <select id="editClientCategory">
                                <option value="normal" ${client.category === 'normal' ? 'selected' : ''}>Normal</option>
                                <option value="VIP" ${client.category === 'VIP' ? 'selected' : ''}>VIP</option>
                                <option value="corporate" ${client.category === 'corporate' ? 'selected' : ''}>Corporate</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editClientAddress">Endereço</label>
                            <textarea id="editClientAddress" rows="3">${client.address || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="editClientCity">Cidade</label>
                            <input type="text" id="editClientCity" value="${client.city || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editClientProvince">Província</label>
                            <input type="text" id="editClientProvince" value="${client.province || ''}">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" onclick="closeModal('editClientModal')">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
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
            category: document.getElementById('editClientCategory').value,
            address: document.getElementById('editClientAddress').value.trim() || null,
            city: document.getElementById('editClientCity').value.trim() || null,
            province: document.getElementById('editClientProvince').value.trim() || null
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
                loadClients();
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
            // Recarregar lista de clientes se existir
            if (typeof loadClients === 'function') {
                loadClients();
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
// FUNÇÕES DE PRODUTOS
// ==============================================

/**
 * Abre modal para editar produto
 * @param {object} product - Objeto do produto
 */
function openEditProductModal(product) {
    const modalHTML = `
        <div class="modal-overlay" id="editProductModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Editar Produto</h3>
                    <button class="modal-close" onclick="closeModal('editProductModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editProductForm" onsubmit="saveProductChanges(event, '${product.id}')">
                        <div class="form-group">
                            <label for="editProductCode">Código *</label>
                            <input type="text" id="editProductCode" value="${product.code || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editProductName">Nome *</label>
                            <input type="text" id="editProductName" value="${product.name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editProductDescription">Descrição</label>
                            <textarea id="editProductDescription" rows="3">${product.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="editProductCategory">Categoria</label>
                            <input type="text" id="editProductCategory" value="${product.category || ''}">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editProductPrice">Preço Unitário *</label>
                                <input type="number" id="editProductPrice" step="0.01" min="0" 
                                       value="${product.unit_price || 0}" required>
                            </div>
                            <div class="form-group">
                                <label for="editProductCost">Preço de Custo</label>
                                <input type="number" id="editProductCost" step="0.01" min="0" 
                                       value="${product.cost_price || 0}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editProductStock">Estoque Atual</label>
                                <input type="number" id="editProductStock" min="0" 
                                       value="${product.stock || 0}">
                            </div>
                            <div class="form-group">
                                <label for="editProductMinStock">Estoque Mínimo</label>
                                <input type="number" id="editProductMinStock" min="0" 
                                       value="${product.min_stock || 10}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="editProductSupplier">Fornecedor</label>
                            <input type="text" id="editProductSupplier" value="${product.supplier || ''}">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" onclick="closeModal('editProductModal')">Cancelar</button>
                            <button type="submit" class="btn-primary">Salvar Alterações</button>
                        </div>
                    </form>
                </div>
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
            description: document.getElementById('editProductDescription').value.trim() || null,
            category: document.getElementById('editProductCategory').value.trim() || null,
            unit_price: parseFloat(document.getElementById('editProductPrice').value),
            cost_price: parseFloat(document.getElementById('editProductCost').value) || null,
            stock: parseInt(document.getElementById('editProductStock').value) || 0,
            min_stock: parseInt(document.getElementById('editProductMinStock').value) || 10,
            supplier: document.getElementById('editProductSupplier').value.trim() || null
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
                loadProducts();
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
            // Recarregar lista de produtos se existir
            if (typeof loadProducts === 'function') {
                loadProducts();
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
// FUNÇÕES AUXILIARES GERAIS
// ==============================================

/**
 * Fecha um modal
 * @param {string} modalId - ID do modal
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
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
        minimumFractionDigits: 2
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
 * Obtém label do método de pagamento
 * @param {string} method - Código do método
 * @returns {string} Label em português
 */
function getPaymentMethodLabel(method) {
    const methods = {
        'cash': 'Dinheiro',
        'card': 'Cartão',
        'transfer': 'Transferência',
        'check': 'Cheque',
        'multicaixa': 'Multicaixa'
    };
    return methods[method] || method;
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
                    <td colspan="6" class="text-center text-muted">
                        <div style="padding: 40px;">
                            <i style="font-size: 48px; opacity: 0.5;">🛒</i>
                            <p style="margin-top: 10px;">Nenhum item adicionado à venda</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <strong>${item.code || 'N/A'}</strong><br>
                    <small class="text-muted">${item.name}</small>
                </td>
                <td>
                    <div class="quantity-control" style="display: flex; align-items: center; gap: 5px;">
                        <button class="btn-quantity" onclick="adjustSaleQuantity('${item.id}', -1)" 
                                style="width: 30px; height: 30px; border-radius: 50%;">-</button>
                        <input type="number" value="${item.quantity}" min="1" 
                               onchange="updateSaleItemQuantity('${item.id}', this.value)"
                               style="width: 60px; text-align: center; padding: 5px;">
                        <button class="btn-quantity" onclick="adjustSaleQuantity('${item.id}', 1)"
                                style="width: 30px; height: 30px; border-radius: 50%;">+</button>
                    </div>
                </td>
                <td>${formatCurrency(item.price)}</td>
                <td><strong>${formatCurrency(item.total)}</strong></td>
                <td>
                    <button class="btn-remove" onclick="removeSaleItem('${item.id}')" 
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
 * Imprime uma venda
 * @param {string} saleId - ID da venda
 */
function printSale(saleId) {
    showNotification('Funcionalidade de impressão em desenvolvimento', 'info');
    // Implementação futura
}

// ==============================================
// INICIALIZAÇÃO
// ==============================================

console.log('✅ Todas as funções foram carregadas!');

// Exportar funções para uso global
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

// Inicializar se necessário
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
    // DOM já carregado
    console.log('📄 DOM já carregado');
    if (document.getElementById('saleItemsBody')) {
        updateSaleItemsTable();
        updateSaleSummary();
    }
}
