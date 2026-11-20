/**
 * Retail Store Inventory and Sales Analysis System
 * POS Billing & Checkout Terminal (Functional Requirements 2, 3, 4)
 * - Checks stock availability before adding or updating cart items.
 * - Prevents sales exceeding available stock.
 * - Automatically updates stock via atomic backend transaction.
 * - Generates printable thermal invoice receipts.
 */

const Billing = {
    products: [],
    cart: [],
    activeCategory: 'ALL',
    searchQuery: '',

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderProductGrid();
            });
        }

        const checkoutBtn = document.getElementById('pos-checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.processCheckout());
        }

        const clearCartBtn = document.getElementById('pos-clear-cart-btn');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', () => this.clearCart());
        }

        // Cart discount input
        const discountSelect = document.getElementById('pos-discount-select');
        if (discountSelect) {
            discountSelect.addEventListener('change', () => this.updateCartTotals());
        }
    },

    async loadProducts() {
        try {
            const res = await fetch(`${App.apiBase}/api/products`);
            const data = await res.json();
            if (data.status === 'success' && data.data) {
                this.products = data.data;
                this.renderCategories();
                this.renderProductGrid();
            }
        } catch (e) {
            App.showToast('Failed to load products for POS terminal', 'error');
        }
    },

    renderCategories() {
        const catContainer = document.getElementById('pos-category-pills');
        if (!catContainer) return;

        const categories = ['ALL', ...new Set(this.products.map(p => p.category))];
        catContainer.innerHTML = categories.map(cat => `
            <div class="category-pill ${this.activeCategory === cat ? 'active' : ''}" data-cat="${cat}">
                ${cat}
            </div>
        `).join('');

        catContainer.querySelectorAll('.category-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this.activeCategory = pill.getAttribute('data-cat');
                catContainer.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.renderProductGrid();
            });
        });
    },

    renderProductGrid() {
        const grid = document.getElementById('pos-product-grid');
        if (!grid) return;

        const filtered = this.products.filter(p => {
            const matchCat = this.activeCategory === 'ALL' || p.category.toLowerCase() === this.activeCategory.toLowerCase();
            const matchSearch = !this.searchQuery ||
                p.name.toLowerCase().includes(this.searchQuery) ||
                p.product_code.toLowerCase().includes(this.searchQuery);
            return matchCat && matchSearch;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 40px;">No matching products found.</div>`;
            return;
        }

        grid.innerHTML = filtered.map(p => {
            const isOutOfStock = p.stock_quantity <= 0;
            const isLowStock = p.stock_quantity <= p.low_stock_threshold && !isOutOfStock;

            let badgeClass = 'badge-instock';
            let badgeText = `${p.stock_quantity} in stock`;
            if (isOutOfStock) {
                badgeClass = 'badge-outofstock';
                badgeText = 'OUT OF STOCK';
            } else if (isLowStock) {
                badgeClass = 'badge-lowstock';
                badgeText = `${p.stock_quantity} left (Low)`;
            }

            return `
                <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${p.id}">
                    <div>
                        <div class="product-code">${p.product_code}</div>
                        <div class="product-name" title="${p.name}">${p.name}</div>
                        <span class="badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <div class="product-meta">
                        <div class="product-price">$${Number(p.price).toFixed(2)}</div>
                        <button class="btn btn-sm btn-primary" ${isOutOfStock ? 'disabled' : ''}>+ Add</button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind clicks to add to cart
        grid.querySelectorAll('.product-card:not(.out-of-stock)').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.getAttribute('data-id'), 10);
                this.addToCart(id);
            });
        });
    },

    /**
     * Requirement 4: Check stock availability before adding to cart.
     */
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const existing = this.cart.find(item => item.product_id === productId);
        const currentInCart = existing ? existing.quantity : 0;

        if (currentInCart + 1 > product.stock_quantity) {
            App.showToast(`Cannot add more "${product.name}". Only ${product.stock_quantity} available in stock!`, 'warning');
            return;
        }

        if (existing) {
            existing.quantity += 1;
            existing.subtotal = Number((existing.quantity * existing.price).toFixed(2));
        } else {
            this.cart.push({
                product_id: product.id,
                product_code: product.product_code,
                name: product.name,
                category: product.category,
                price: Number(product.price),
                stock_quantity: product.stock_quantity,
                quantity: 1,
                subtotal: Number(product.price)
            });
        }

        App.showToast(`Added ${product.name} to cart`, 'info');
        this.renderCart();
    },

    updateCartQuantity(productId, delta) {
        const item = this.cart.find(i => i.product_id === productId);
        if (!item) return;

        const product = this.products.find(p => p.id === productId);
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
            this.removeFromCart(productId);
            return;
        }

        // Prevent exceeding available stock
        if (product && newQty > product.stock_quantity) {
            App.showToast(`Maximum stock limit reached! Only ${product.stock_quantity} available.`, 'warning');
            return;
        }

        item.quantity = newQty;
        item.subtotal = Number((item.quantity * item.price).toFixed(2));
        this.renderCart();
    },

    removeFromCart(productId) {
        this.cart = this.cart.filter(i => i.product_id !== productId);
        this.renderCart();
    },

    clearCart() {
        this.cart = [];
        this.renderCart();
    },

    renderCart() {
        const cartList = document.getElementById('pos-cart-items');
        if (!cartList) return;

        if (this.cart.length === 0) {
            cartList.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 40px;">Cart is empty. Click items to add.</div>`;
            this.updateCartTotals();
            return;
        }

        cartList.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name" title="${item.name}">${item.name}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)} × ${item.quantity} = $${item.subtotal.toFixed(2)}</div>
                </div>
                <div class="qty-counter">
                    <button class="qty-btn" onclick="Billing.updateCartQuantity(${item.product_id}, -1)">−</button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn" onclick="Billing.updateCartQuantity(${item.product_id}, 1)">+</button>
                </div>
                <button class="btn btn-sm btn-danger" style="margin-left: 8px; padding: 4px 8px;" onclick="Billing.removeFromCart(${item.product_id})">✕</button>
            </div>
        `).join('');

        this.updateCartTotals();
    },

    updateCartTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);

        const discountSelect = document.getElementById('pos-discount-select');
        const discountPct = discountSelect ? parseFloat(discountSelect.value || 0) : 0;
        const discountAmount = Number(((subtotal * discountPct) / 100).toFixed(2));

        const taxRate = 0.08; // 8% standard tax
        const taxableAmount = Math.max(0, subtotal - discountAmount);
        const taxAmount = Number((taxableAmount * taxRate).toFixed(2));

        const finalTotal = Number((taxableAmount + taxAmount).toFixed(2));

        document.getElementById('pos-subtotal').textContent = App.formatCurrency(subtotal);
        document.getElementById('pos-discount-amt').textContent = `-$${discountAmount.toFixed(2)}`;
        document.getElementById('pos-tax-amt').textContent = `$${taxAmount.toFixed(2)}`;
        document.getElementById('pos-grand-total').textContent = App.formatCurrency(finalTotal);

        const checkoutBtn = document.getElementById('pos-checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = this.cart.length === 0;
        }
    },

    /**
     * Requirement 2 & 3: Record sale transaction, automatically update stock quantities in DB.
     */
    async processCheckout() {
        if (this.cart.length === 0) {
            App.showToast('Please add items to cart before checkout', 'warning');
            return;
        }

        const custNameInput = document.getElementById('pos-customer-name');
        const custPhoneInput = document.getElementById('pos-customer-phone');
        const payMethodSelect = document.getElementById('pos-payment-method');
        const discountSelect = document.getElementById('pos-discount-select');

        const customerName = custNameInput && custNameInput.value.trim() ? custNameInput.value.trim() : 'Walk-in Customer';
        const customerPhone = custPhoneInput ? custPhoneInput.value.trim() : '';
        const paymentMethod = payMethodSelect ? payMethodSelect.value : 'CASH';

        const subtotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
        const discountPct = discountSelect ? parseFloat(discountSelect.value || 0) : 0;
        const discountAmount = Number(((subtotal * discountPct) / 100).toFixed(2));
        const taxAmount = Number(((subtotal - discountAmount) * 0.08).toFixed(2));
        const finalAmount = Number((subtotal - discountAmount + taxAmount).toFixed(2));

        const now = new Date();
        const invoiceNum = `INV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const payload = {
            invoice_number: invoiceNum,
            worker_id: App.currentUser ? App.currentUser.id : 1,
            worker_name: App.currentUser ? (App.currentUser.full_name || App.currentUser.username) : 'Staff Associate',
            customer_name: customerName,
            customer_phone: customerPhone,
            total_amount: subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            final_amount: finalAmount,
            payment_method: paymentMethod,
            items: this.cart.map(i => ({
                product_id: i.product_id,
                quantity: i.quantity
            }))
        };

        const checkoutBtn = document.getElementById('pos-checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.innerHTML = `<span class="spinner"></span> Processing...`;
            checkoutBtn.disabled = true;
        }

        try {
            const res = await fetch(`${App.apiBase}/api/sales/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (res.status === 200 && result.status === 'success') {
                App.showToast(`Sale recorded successfully! Invoice: ${invoiceNum}`, 'success');

                // Launch printable thermal receipt modal
                this.showReceiptModal({
                    invoice_number: invoiceNum,
                    date: now.toLocaleString(),
                    worker_name: payload.worker_name,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    payment_method: paymentMethod,
                    items: [...this.cart],
                    subtotal: subtotal,
                    discount: discountAmount,
                    tax: taxAmount,
                    total: finalAmount
                });

                // Clear cart and reload inventory
                this.clearCart();
                if (custNameInput) custNameInput.value = '';
                if (custPhoneInput) custPhoneInput.value = '';
                this.loadProducts();

            } else if (res.status === 409 || result.code === 'INSUFFICIENT_STOCK') {
                // Stock Check prevented the sale!
                App.showToast(`Checkout Rejection: ${result.message}`, 'error');
                // Refresh products to show updated stock
                this.loadProducts();
            } else {
                App.showToast(`Sale error: ${result.message || 'Unknown error'}`, 'error');
            }

        } catch (e) {
            App.showToast(`Server communication error: ${e.message}`, 'error');
        } finally {
            if (checkoutBtn) {
                checkoutBtn.innerHTML = `Complete Sale & Print Receipt`;
                checkoutBtn.disabled = this.cart.length === 0;
            }
        }
    },

    showReceiptModal(receiptData) {
        const modal = document.getElementById('receipt-modal');
        const container = document.getElementById('receipt-print-area');
        if (!modal || !container) return;

        container.innerHTML = `
            <div class="receipt-paper">
                <div class="receipt-header">
                    <div class="receipt-store-name">METRO RETAIL STORE</div>
                    <div style="font-size: 0.75rem; color: #4b5563;">100 Retail Plaza, Tech Avenue</div>
                    <div style="font-size: 0.75rem; color: #4b5563;">Tax ID: RT-98745210 • Phone: (555) 019-2834</div>
                    <div style="margin-top: 10px; font-weight: bold; border-top: 1px dashed #9ca3af; padding-top: 6px;">
                        SALES INVOICE: ${receiptData.invoice_number}
                    </div>
                    <div style="font-size: 0.75rem; color: #4b5563;">Date: ${receiptData.date}</div>
                    <div style="font-size: 0.75rem; color: #4b5563;">Cashier: ${receiptData.worker_name}</div>
                    <div style="font-size: 0.75rem; color: #4b5563;">Customer: ${receiptData.customer_name} ${receiptData.customer_phone ? '(' + receiptData.customer_phone + ')' : ''}</div>
                </div>

                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th>Item Description</th>
                            <th style="text-align: center;">Qty</th>
                            <th style="text-align: right;">Price</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${receiptData.items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td style="text-align: center;">${item.quantity}</td>
                                <td style="text-align: right;">$${item.price.toFixed(2)}</td>
                                <td style="text-align: right;">$${item.subtotal.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="receipt-totals">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Subtotal:</span>
                        <span>$${receiptData.subtotal.toFixed(2)}</span>
                    </div>
                    ${receiptData.discount > 0 ? `
                        <div style="display: flex; justify-content: space-between; color: #dc2626;">
                            <span>Discount:</span>
                            <span>-$${receiptData.discount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between;">
                        <span>Sales Tax (8%):</span>
                        <span>$${receiptData.tax.toFixed(2)}</span>
                    </div>
                    <div class="receipt-grand-total">
                        <span>TOTAL PAID (${receiptData.payment_method}):</span>
                        <span>$${receiptData.total.toFixed(2)}</span>
                    </div>
                </div>

                <div class="receipt-footer">
                    <div>*** INVENTORY AUTOMATICALLY DEDUCTED ***</div>
                    <div style="margin-top: 4px;">Thank you for shopping with us! Please retain this receipt for returns within 30 days.</div>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }
};

window.Billing = Billing;
document.addEventListener('DOMContentLoaded', () => Billing.init());
