/**
 * Retail Store Inventory and Sales Analysis System
 * Inventory & Stock Management Module (Functional Requirements 1, 3, 5)
 * - Maintain product details (ID, name, category, price, available stock).
 * - Restock & stock adjustment modal (Workers & Admins).
 * - Add, Edit, Delete product modals (Admin only).
 */

const Inventory = {
    products: [],
    selectedProductForRestock: null,
    selectedProductForEdit: null,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const searchInput = document.getElementById('inv-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterAndRenderTable());
        }

        const catFilter = document.getElementById('inv-category-filter');
        if (catFilter) {
            catFilter.addEventListener('change', () => this.filterAndRenderTable());
        }

        const statusFilter = document.getElementById('inv-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterAndRenderTable());
        }

        // Add Product Form (Admin)
        const addProductForm = document.getElementById('add-product-form');
        if (addProductForm) {
            addProductForm.addEventListener('submit', (e) => this.handleAddProduct(e));
        }

        // Edit Product Form (Admin)
        const editProductForm = document.getElementById('edit-product-form');
        if (editProductForm) {
            editProductForm.addEventListener('submit', (e) => this.handleEditProduct(e));
        }

        // Restock Form (Worker & Admin)
        const restockForm = document.getElementById('restock-form');
        if (restockForm) {
            restockForm.addEventListener('submit', (e) => this.handleRestockSubmit(e));
        }
    },

    async loadInventory() {
        try {
            const res = await fetch(`${App.apiBase}/api/products`);
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                this.products = data.data;
                this.populateCategoryFilter();
                this.filterAndRenderTable();
            }
        } catch (e) {
            App.showToast('Failed to load inventory data', 'error');
        }
    },

    populateCategoryFilter() {
        const catFilter = document.getElementById('inv-category-filter');
        if (!catFilter) return;

        const categories = [...new Set(this.products.map(p => p.category))];
        catFilter.innerHTML = '<option value="ALL">All Categories</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
    },

    filterAndRenderTable() {
        const searchInput = document.getElementById('inv-search-input');
        const catFilter = document.getElementById('inv-category-filter');
        const statusFilter = document.getElementById('inv-status-filter');

        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const cat = catFilter ? catFilter.value : 'ALL';
        const status = statusFilter ? statusFilter.value : 'ALL';

        const filtered = this.products.filter(p => {
            const matchSearch = !query ||
                p.name.toLowerCase().includes(query) ||
                p.product_code.toLowerCase().includes(query);
            const matchCat = cat === 'ALL' || p.category.toLowerCase() === cat.toLowerCase();

            let matchStatus = true;
            if (status === 'LOW') {
                matchStatus = p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0;
            } else if (status === 'OUT') {
                matchStatus = p.stock_quantity === 0;
            } else if (status === 'HEALTHY') {
                matchStatus = p.stock_quantity > p.low_stock_threshold;
            }

            return matchSearch && matchCat && matchStatus;
        });

        this.renderTable(filtered);
    },

    renderTable(items) {
        const tbody = document.getElementById('inv-table-body');
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 30px;">No inventory records match the filter criteria.</td></tr>`;
            return;
        }

        const isAdmin = App.currentUser && App.currentUser.role === 'ADMIN';

        tbody.innerHTML = items.map(p => {
            const isOut = p.stock_quantity === 0;
            const isLow = p.stock_quantity <= p.low_stock_threshold && !isOut;

            let badge = `<span class="badge badge-instock">Healthy (${p.stock_quantity})</span>`;
            if (isOut) {
                badge = `<span class="badge badge-outofstock">Out of Stock (0)</span>`;
            } else if (isLow) {
                badge = `<span class="badge badge-lowstock">Low Stock (${p.stock_quantity})</span>`;
            }

            return `
                <tr>
                    <td style="font-weight: 700; color: var(--primary);">${p.product_code}</td>
                    <td>
                        <div style="font-weight: 600;">${p.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-dim);">${p.description || ''}</div>
                    </td>
                    <td><span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted);">${p.category}</span></td>
                    <td style="font-weight: 600;">$${Number(p.price).toFixed(2)}</td>
                    <td>${badge}</td>
                    <td style="color: var(--text-dim); font-size: 0.8rem;">Min: ${p.low_stock_threshold}</td>
                    <td style="font-weight: 600; color: #ffffff;">$${(p.stock_quantity * p.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm btn-secondary" onclick="Inventory.openRestockModal(${p.id})">Restock</button>
                            ${isAdmin ? `
                                <button class="btn btn-sm btn-secondary" onclick="Inventory.openEditModal(${p.id})">Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="Inventory.deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')">✕</button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Restock Modal
    openRestockModal(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        this.selectedProductForRestock = prod;
        document.getElementById('restock-product-name').textContent = `${prod.product_code} - ${prod.name}`;
        document.getElementById('restock-current-stock').textContent = prod.stock_quantity;
        document.getElementById('restock-qty-input').value = '10';
        document.getElementById('restock-notes-input').value = 'Inventory restock';

        document.getElementById('restock-modal').classList.add('active');
    },

    async handleRestockSubmit(e) {
        e.preventDefault();
        if (!this.selectedProductForRestock) return;

        const qty = parseInt(document.getElementById('restock-qty-input').value, 10);
        const changeType = document.getElementById('restock-type-select').value;
        const notes = document.getElementById('restock-notes-input').value;

        if (isNaN(qty) || qty === 0) {
            App.showToast('Please enter a valid non-zero quantity', 'warning');
            return;
        }

        try {
            const res = await fetch(`${App.apiBase}/api/stock/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: this.selectedProductForRestock.id,
                    quantity: qty,
                    change_type: changeType,
                    changed_by: App.currentUser ? (App.currentUser.full_name || App.currentUser.username) : 'Staff',
                    notes: notes
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                App.showToast(`Stock updated for ${this.selectedProductForRestock.name}. New Stock: ${data.new_stock}`, 'success');
                this.closeModal('restock-modal');
                this.loadInventory();
                if (window.Billing) Billing.loadProducts();
            } else {
                App.showToast(`Error updating stock: ${data.message}`, 'error');
            }
        } catch (e) {
            App.showToast(`Server communication error: ${e.message}`, 'error');
        }
    },

    // Edit Product Modal (Admin)
    openEditModal(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        this.selectedProductForEdit = prod;
        document.getElementById('edit-prod-id').value = prod.id;
        document.getElementById('edit-prod-code').value = prod.product_code;
        document.getElementById('edit-prod-name').value = prod.name;
        document.getElementById('edit-prod-category').value = prod.category;
        document.getElementById('edit-prod-price').value = prod.price;
        document.getElementById('edit-prod-threshold').value = prod.low_stock_threshold;
        document.getElementById('edit-prod-desc').value = prod.description || '';

        document.getElementById('edit-product-modal').classList.add('active');
    },

    async handleEditProduct(e) {
        e.preventDefault();
        const id = document.getElementById('edit-prod-id').value;
        const name = document.getElementById('edit-prod-name').value;
        const category = document.getElementById('edit-prod-category').value;
        const price = document.getElementById('edit-prod-price').value;
        const threshold = document.getElementById('edit-prod-threshold').value;
        const desc = document.getElementById('edit-prod-desc').value;

        try {
            const res = await fetch(`${App.apiBase}/api/products/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    name: name,
                    category: category,
                    price: price,
                    low_stock_threshold: threshold,
                    description: desc
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                App.showToast('Product updated successfully', 'success');
                this.closeModal('edit-product-modal');
                this.loadInventory();
                if (window.Billing) Billing.loadProducts();
            } else {
                App.showToast(`Update error: ${data.message}`, 'error');
            }
        } catch (e) {
            App.showToast(`Server communication error: ${e.message}`, 'error');
        }
    },

    // Add Product Modal (Admin)
    openAddModal() {
        document.getElementById('add-product-form').reset();
        document.getElementById('add-product-modal').classList.add('active');
    },

    async handleAddProduct(e) {
        e.preventDefault();
        const code = document.getElementById('add-prod-code').value.trim();
        const name = document.getElementById('add-prod-name').value.trim();
        const category = document.getElementById('add-prod-category').value.trim();
        const price = document.getElementById('add-prod-price').value;
        const stock = document.getElementById('add-prod-stock').value;
        const threshold = document.getElementById('add-prod-threshold').value;
        const desc = document.getElementById('add-prod-desc').value.trim();

        try {
            const res = await fetch(`${App.apiBase}/api/products/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_code: code,
                    name: name,
                    category: category,
                    price: price,
                    stock_quantity: stock,
                    low_stock_threshold: threshold,
                    description: desc
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                App.showToast(`Product "${name}" created successfully`, 'success');
                this.closeModal('add-product-modal');
                this.loadInventory();
                if (window.Billing) Billing.loadProducts();
            } else {
                App.showToast(`Add product error: ${data.message}`, 'error');
            }
        } catch (e) {
            App.showToast(`Server communication error: ${e.message}`, 'error');
        }
    },

    async deleteProduct(productId, productName) {
        if (!confirm(`Are you sure you want to delete product "${productName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`${App.apiBase}/api/products/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId })
            });

            const data = await res.json();
            if (data.status === 'success') {
                App.showToast(`Product "${productName}" deleted`, 'info');
                this.loadInventory();
                if (window.Billing) Billing.loadProducts();
            } else {
                App.showToast(`Delete failed: ${data.message}`, 'error');
            }
        } catch (e) {
            App.showToast(`Server communication error: ${e.message}`, 'error');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }
};

window.Inventory = Inventory;
document.addEventListener('DOMContentLoaded', () => Inventory.init());
