/**
 * Retail Store Inventory and Sales Analysis System
 * Core App Architecture: Session Management, Navigation, Role-Based Access Control, Toasts
 */

const App = {
    currentUser: null,
    apiBase: '', // Same-origin REST API served by Java backend

    init() {
        this.checkAuth();
        this.bindGlobalEvents();
        this.startClock();
    },

    // Session Verification
    checkAuth() {
        const stored = localStorage.getItem('retail_user');
        if (stored) {
            try {
                this.currentUser = JSON.parse(stored);
                this.applyRolePermissions();
            } catch (e) {
                this.logout();
            }
        } else {
            // If on dashboard and not authenticated, redirect to login
            if (window.location.pathname.includes('dashboard.html') || window.location.pathname === '/') {
                window.location.href = 'login.html';
            }
        }
    },

    // Set user session upon successful login
    setUser(user) {
        this.currentUser = user;
        localStorage.setItem('retail_user', JSON.stringify(user));
        this.applyRolePermissions();
    },

    logout() {
        localStorage.removeItem('retail_user');
        this.currentUser = null;
        window.location.href = 'login.html';
    },

    // Role-Based UI Visibility Enforcement
    applyRolePermissions() {
        if (!this.currentUser) return;

        const role = this.currentUser.role.toUpperCase();
        const userNameEl = document.getElementById('user-full-name');
        const userRoleEl = document.getElementById('user-role-badge');
        const userAvatarEl = document.getElementById('user-avatar-initials');

        if (userNameEl) userNameEl.textContent = this.currentUser.full_name || this.currentUser.username;
        if (userRoleEl) {
            userRoleEl.textContent = role;
            userRoleEl.className = `badge ${role === 'ADMIN' ? 'badge-admin' : 'badge-worker'}`;
        }
        if (userAvatarEl) {
            const name = this.currentUser.full_name || this.currentUser.username;
            userAvatarEl.textContent = name.substring(0, 2).toUpperCase();
        }

        // Restrict Admin-only sections for Workers
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            if (role === 'ADMIN') {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });

        // Default view: Admin -> Overview, Worker -> Billing POS Terminal
        if (role === 'WORKER') {
            this.switchView('pos-view');
        } else {
            this.switchView('overview-view');
        }
    },

    // View Navigation Switcher
    switchView(viewId) {
        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-view') === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update dashboard view display
        document.querySelectorAll('.dashboard-view').forEach(view => {
            view.classList.remove('active');
        });

        const target = document.getElementById(viewId);
        if (target) {
            target.classList.add('active');
            
            // Trigger view-specific data refresh
            if (viewId === 'overview-view') {
                this.loadOverviewKPIs();
            } else if (viewId === 'pos-view') {
                if (window.Billing) Billing.loadProducts();
            } else if (viewId === 'inventory-view') {
                if (window.Inventory) Inventory.loadInventory();
            } else if (viewId === 'analytics-view') {
                if (window.Analytics) Analytics.initAnalytics();
            } else if (viewId === 'reports-view') {
                if (window.Reports) Reports.loadDailyReport();
            }
        }
    },

    bindGlobalEvents() {
        // Navigation item clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = item.getAttribute('data-view');
                if (view) this.switchView(view);
            });
        });

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    },

    // Load High-Level KPI Summary for Overview View
    async loadOverviewKPIs() {
        try {
            const res = await fetch(`${this.apiBase}/api/reports/availability`);
            const data = await res.json();
            if (data.status === 'success' && data.kpis && data.kpis.data && data.kpis.data.length > 0) {
                const kpi = data.kpis.data[0];
                document.getElementById('kpi-total-skus').textContent = kpi.total_products || 0;
                document.getElementById('kpi-total-stock').textContent = (kpi.total_stock_units || 0).toLocaleString();
                document.getElementById('kpi-inventory-val').textContent = `$${(kpi.total_inventory_value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                document.getElementById('kpi-low-stock-count').textContent = kpi.low_stock_items || 0;
            }

            // Also load today's sales
            const today = new Date().toISOString().split('T')[0];
            const salesRes = await fetch(`${this.apiBase}/api/reports/daily?date=${today}`);
            const salesData = await salesRes.json();
            if (salesData.status === 'success' && salesData.summary && salesData.summary.data && salesData.summary.data.length > 0) {
                const s = salesData.summary.data[0];
                document.getElementById('kpi-today-revenue').textContent = `$${(s.net_sales || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                document.getElementById('kpi-today-tx').textContent = s.total_transactions || 0;
            }
        } catch (e) {
            console.error('Failed to load overview KPIs:', e);
        }
    },

    startClock() {
        const clockEl = document.getElementById('live-clock');
        if (!clockEl) return;
        const update = () => {
            const now = new Date();
            clockEl.textContent = now.toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        };
        update();
        setInterval(update, 1000);
    },

    // Toast Notification System
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span>${icon}</span>
            <div style="flex: 1;">${message}</div>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    formatCurrency(num) {
        return `$${Number(num || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
