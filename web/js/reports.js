/**
 * Retail Store Inventory and Sales Analysis System
 * Reports Center Module (Functional Requirement 5)
 * - Daily Sales Reports (gross, tax, discounts, net, itemized breakdown)
 * - Product Availability Reports (stock counts, category valuation, stock health)
 * - Low-Stock Alerts (critical deficits, 1-click reorder restock)
 */

const Reports = {
    currentTab: 'daily',

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Report Tab switching
        document.querySelectorAll('.report-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });

        // Daily report date picker change
        const datePicker = document.getElementById('rep-daily-date');
        if (datePicker) {
            datePicker.value = new Date().toISOString().split('T')[0];
            datePicker.addEventListener('change', () => this.loadDailyReport());
        }
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.report-tab-btn').forEach(b => {
            if (b.getAttribute('data-tab') === tabName) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        document.querySelectorAll('.report-tab-pane').forEach(p => {
            p.classList.remove('active');
        });

        const targetPane = document.getElementById(`rep-pane-${tabName}`);
        if (targetPane) {
            targetPane.classList.add('active');
        }

        if (tabName === 'daily') {
            this.loadDailyReport();
        } else if (tabName === 'availability') {
            this.loadAvailabilityReport();
        } else if (tabName === 'low-stock') {
            this.loadLowStockReport();
        }
    },

    // 1. Daily Sales Report
    async loadDailyReport() {
        const datePicker = document.getElementById('rep-daily-date');
        const date = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

        try {
            const res = await fetch(`${App.apiBase}/api/reports/daily?date=${date}`);
            const data = await res.json();

            if (data.status === 'success') {
                const s = data.summary && data.summary.data && data.summary.data[0] ? data.summary.data[0] : {};
                document.getElementById('rep-daily-tx-count').textContent = s.total_transactions || 0;
                document.getElementById('rep-daily-gross').textContent = `$${Number(s.gross_sales || 0).toFixed(2)}`;
                document.getElementById('rep-daily-discount').textContent = `-$${Number(s.total_discounts || 0).toFixed(2)}`;
                document.getElementById('rep-daily-tax').textContent = `$${Number(s.total_tax || 0).toFixed(2)}`;
                document.getElementById('rep-daily-net').textContent = `$${Number(s.net_sales || 0).toFixed(2)}`;

                // Top items list
                const topItemsList = document.getElementById('rep-daily-top-items');
                if (topItemsList && data.top_items && data.top_items.data) {
                    if (data.top_items.data.length === 0) {
                        topItemsList.innerHTML = `<li style="color: var(--text-dim);">No items sold on this date.</li>`;
                    } else {
                        topItemsList.innerHTML = data.top_items.data.map(item => `
                            <li style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
                                <span>${item.product_name} (${item.category})</span>
                                <span style="font-weight: 600; color: var(--success);">${item.total_qty} units / $${Number(item.total_rev).toFixed(2)}</span>
                            </li>
                        `).join('');
                    }
                }

                // Transactions Table
                const tbody = document.getElementById('rep-daily-table-body');
                if (tbody && data.transactions && data.transactions.data) {
                    if (data.transactions.data.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 24px;">No transactions recorded for ${date}.</td></tr>`;
                    } else {
                        tbody.innerHTML = data.transactions.data.map(t => `
                            <tr>
                                <td style="font-weight: 700; color: var(--primary);">${t.invoice_number}</td>
                                <td>${t.customer_name}</td>
                                <td>${t.worker_name}</td>
                                <td><span class="badge" style="background: rgba(255,255,255,0.08);">${t.payment_method}</span></td>
                                <td style="font-weight: 600; color: var(--success);">$${Number(t.final_amount).toFixed(2)}</td>
                                <td>${new Date(t.sale_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                            </tr>
                        `).join('');
                    }
                }
            }
        } catch (e) {
            App.showToast('Failed to load daily sales report', 'error');
        }
    },

    // 2. Product Availability Report
    async loadAvailabilityReport() {
        try {
            const res = await fetch(`${App.apiBase}/api/reports/availability`);
            const data = await res.json();

            if (data.status === 'success') {
                const kpi = data.kpis && data.kpis.data && data.kpis.data[0] ? data.kpis.data[0] : {};
                document.getElementById('rep-avail-total-skus').textContent = kpi.total_products || 0;
                document.getElementById('rep-avail-total-units').textContent = Number(kpi.total_stock_units || 0).toLocaleString();
                document.getElementById('rep-avail-inventory-val').textContent = `$${Number(kpi.total_inventory_value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                document.getElementById('rep-avail-low-count').textContent = kpi.low_stock_items || 0;
                document.getElementById('rep-avail-out-count').textContent = kpi.out_of_stock_items || 0;

                // Category breakdown table
                const tbody = document.getElementById('rep-avail-table-body');
                if (tbody && data.categories && data.categories.data) {
                    tbody.innerHTML = data.categories.data.map(cat => `
                        <tr>
                            <td style="font-weight: 600;">${cat.category}</td>
                            <td>${cat.product_count}</td>
                            <td style="font-weight: 600;">${Number(cat.total_stock).toLocaleString()} units</td>
                            <td style="font-weight: 600; color: var(--primary);">$${Number(cat.category_value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        </tr>
                    `).join('');
                }
            }
        } catch (e) {
            App.showToast('Failed to load product availability report', 'error');
        }
    },

    // 3. Low-Stock Alerts Report
    async loadLowStockReport() {
        try {
            const res = await fetch(`${App.apiBase}/api/reports/low-stock`);
            const data = await res.json();

            const tbody = document.getElementById('rep-lowstock-table-body');
            if (tbody && data.data) {
                if (data.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--success); padding: 30px;">✅ Excellent! All products are stocked above safety thresholds.</td></tr>`;
                    return;
                }

                tbody.innerHTML = data.data.map(item => {
                    const isCritical = item.alert_level === 'CRITICAL';
                    const badge = isCritical
                        ? `<span class="badge badge-outofstock">CRITICAL (${item.stock_quantity})</span>`
                        : `<span class="badge badge-lowstock">LOW (${item.stock_quantity})</span>`;

                    return `
                        <tr>
                            <td style="font-weight: 700; color: var(--primary);">${item.product_code}</td>
                            <td style="font-weight: 600;">${item.name}</td>
                            <td>${item.category}</td>
                            <td style="font-weight: 600;">$${Number(item.price).toFixed(2)}</td>
                            <td>${badge}</td>
                            <td>Min: ${item.low_stock_threshold} (Deficit: -${item.deficit_units})</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="Inventory.openRestockModal(${item.id})">Restock Now</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (e) {
            App.showToast('Failed to load low stock alerts', 'error');
        }
    },

    printCurrentReport() {
        window.print();
    }
};

window.Reports = Reports;
document.addEventListener('DOMContentLoaded', () => Reports.init());
