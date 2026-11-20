/**
 * Retail Store Inventory and Sales Analysis System
 * Dynamic Python Analytics Module (Functional Requirement 6)
 * Orchestrates dynamic filter inputs, sends requests to the Python analytics engine,
 * and renders interactive Matplotlib visualizations + Pandas preprocessed table data.
 */

const Analytics = {
    initialized: false,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const runBtn = document.getElementById('run-analytics-btn');
        if (runBtn) {
            runBtn.addEventListener('click', () => this.executeAnalysis());
        }

        const typeSelect = document.getElementById('analytics-type-select');
        if (typeSelect) {
            const updateProductLabel = () => {
                const productLabel = document.querySelector('#analytics-product-group label');
                if (productLabel) {
                    productLabel.textContent = typeSelect.value === 'product_deep_dive'
                        ? 'Product (Required)'
                        : 'Product Filter';
                }
            };
            typeSelect.addEventListener('change', updateProductLabel);
            updateProductLabel();
        }
    },

    async initAnalytics() {
        if (!this.initialized) {
            await this.loadFilterDropdowns();
            this.initialized = true;
        }
        // Run default daily trend analysis on first open
        this.executeAnalysis();
    },

    async loadFilterDropdowns() {
        try {
            // Load products for dropdown
            const prodRes = await fetch(`${App.apiBase}/api/products`);
            const prodData = await prodRes.json();
            const prodSelect = document.getElementById('analytics-product-select');
            if (prodSelect && prodData.status === 'success' && prodData.data) {
                prodSelect.innerHTML = '<option value="ALL">All Products (Global)</option>' +
                    prodData.data.map(p => `<option value="${p.id}">[${p.product_code}] ${p.name}</option>`).join('');
            }

            // Load categories
            const catRes = await fetch(`${App.apiBase}/api/products/categories`);
            const catData = await catRes.json();
            const catSelect = document.getElementById('analytics-category-select');
            if (catSelect && catData.status === 'success' && catData.data) {
                catSelect.innerHTML = '<option value="ALL">All Categories</option>' +
                    catData.data.map(c => `<option value="${c.category}">${c.category}</option>`).join('');
            }

        } catch (e) {
            console.error('Failed to load analytics filters:', e);
        }
    },

    async executeAnalysis() {
        const runBtn = document.getElementById('run-analytics-btn');
        const chartImg = document.getElementById('analytics-chart-img');
        const chartPlaceholder = document.getElementById('chart-placeholder');
        const kpiContainer = document.getElementById('analytics-kpis-bar');
        const tableContainer = document.getElementById('analytics-table-container');

        const analysisType = document.getElementById('analytics-type-select').value;
        const productId = document.getElementById('analytics-product-select').value;
        const category = document.getElementById('analytics-category-select').value;
        const dateFrom = document.getElementById('analytics-from-date').value;
        const dateTo = document.getElementById('analytics-to-date').value;

        if (dateFrom && dateTo && dateFrom > dateTo) {
            App.showToast('Start date must be on or before end date', 'warning');
            return;
        }

        if (analysisType === 'product_deep_dive' && productId === 'ALL') {
            App.showToast('Select a product for the product deep-dive analysis', 'warning');
            return;
        }

        // UI Loading state
        if (runBtn) {
            runBtn.innerHTML = `<span class="spinner"></span> Computing...`;
            runBtn.disabled = true;
        }

        const payload = {
            type: analysisType,
            product_id: productId !== 'ALL' ? productId : null,
            category: category !== 'ALL' ? category : null,
            from_date: dateFrom || null,
            to_date: dateTo || null
        };

        try {
            const res = await fetch(`${App.apiBase}/api/analytics/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (result.status === 'success') {
                App.showToast('Python analytics execution completed successfully', 'success');

                // Render Matplotlib Base64 visualization
                if (result.chart_base64) {
                    chartImg.src = result.chart_base64;
                    chartImg.style.display = 'block';
                    if (chartPlaceholder) chartPlaceholder.style.display = 'none';
                } else {
                    chartImg.removeAttribute('src');
                    chartImg.style.display = 'none';
                    if (chartPlaceholder) {
                        chartPlaceholder.textContent = result.message || 'No chart data for the selected filters.';
                        chartPlaceholder.style.display = 'block';
                    }
                }

                // Render dynamic KPIs
                this.renderKpis(result.kpis);

                // Render preprocessed Pandas table data
                this.renderTableData(result.table_data);

            } else {
                const message = result.message || 'Error running analysis';
                App.showToast(`Analytics engine error: ${message}`, 'error');
                chartImg.removeAttribute('src');
                chartImg.style.display = 'none';
                if (chartPlaceholder) {
                    chartPlaceholder.textContent = message;
                    chartPlaceholder.style.display = 'block';
                }
                this.renderKpis({});
                this.renderTableData([]);
            }

        } catch (e) {
            App.showToast(`Failed to communicate with Python analytics bridge: ${e.message}`, 'error');
        } finally {
            if (runBtn) {
                runBtn.innerHTML = `Run Python Analysis`;
                runBtn.disabled = false;
            }
        }
    },

    renderKpis(kpis) {
        if (!kpis) return;
        document.getElementById('an-kpi-revenue').textContent = `$${Number(kpis.total_revenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById('an-kpi-units').textContent = Number(kpis.total_units_sold || 0).toLocaleString();
        document.getElementById('an-kpi-orders').textContent = Number(kpis.unique_orders || 0).toLocaleString();
        document.getElementById('an-kpi-aov').textContent = `$${Number(kpis.avg_order_value || 0).toFixed(2)}`;
        document.getElementById('an-kpi-top-prod').textContent = kpis.top_product || 'N/A';
    },

    renderTableData(rows) {
        const thead = document.getElementById('an-table-head');
        const tbody = document.getElementById('an-table-body');
        if (!thead || !tbody) return;

        if (!rows || rows.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td style="text-align: center; color: var(--text-dim); padding: 24px;">No table records returned for this filter selection.</td></tr>`;
            return;
        }

        // Generate headers dynamically from object keys
        const headers = Object.keys(rows[0]);
        thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

        // Generate rows
        tbody.innerHTML = rows.map(r => `
            <tr>
                ${headers.map(h => `<td>${r[h] !== null && r[h] !== undefined ? r[h] : ''}</td>`).join('')}
            </tr>
        `).join('');
    },

    exportTableToCSV() {
        const thead = document.getElementById('an-table-head');
        const tbody = document.getElementById('an-table-body');
        if (!tbody || tbody.children.length === 0) {
            App.showToast('No table data to export', 'warning');
            return;
        }

        let csv = [];
        // headers
        const headerCols = Array.from(thead.querySelectorAll('th')).map(th => `"${th.textContent.trim()}"`);
        csv.push(headerCols.join(','));

        // rows
        tbody.querySelectorAll('tr').forEach(tr => {
            const cols = Array.from(tr.querySelectorAll('td')).map(td => `"${td.textContent.trim().replace(/"/g, '""')}"`);
            csv.push(cols.join(','));
        });

        const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `retail_sales_analysis_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        App.showToast('CSV export downloaded', 'success');
    }
};

window.Analytics = Analytics;
document.addEventListener('DOMContentLoaded', () => Analytics.init());
